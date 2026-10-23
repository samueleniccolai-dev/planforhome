package com.planforhome.push;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * FCM HTTP v1 with the JDK only: the access token comes from the JWT of the service account
 * (RS256), kept in memory until a minute before it expires. Nothing secret is ever logged: only the
 * HTTP status and the FCM {@code errorCode}.
 */
@Component
public class FcmClient {

  /** {@code rejected}: the device token is not valid any more and must be deleted. */
  public record Outcome(String result, boolean rejected) {}

  static final String DISABLED_WARNING = "FCM disabled: the service account is not usable";
  private static final String SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
  private static final String GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer";
  private static final Logger LOG = LoggerFactory.getLogger(FcmClient.class);
  private static final JsonMapper JSON = JsonMapper.builder().build();

  private final Clock clock;
  private final String baseUrl;
  private final Duration timeout;
  private final HttpClient http;
  private String projectId;
  private String clientEmail;
  private String tokenUri;
  private PrivateKey key;
  private String accessToken;
  private Instant renewAt = Instant.MIN;

  public FcmClient(
      Clock clock,
      @Value("${planforhome.fcm.service-account-base64:}") String secret,
      @Value("${planforhome.fcm.base-url}") String baseUrl,
      @Value("${planforhome.fcm.timeout}") Duration timeout) {
    this.clock = clock;
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.http =
        HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(timeout)
            .build();
    if (!secret.isBlank()) {
      try {
        load(secret.trim());
      } catch (Exception e) {
        key = null;
        LOG.warn(DISABLED_WARNING);
      }
    }
  }

  private void load(String secret) throws Exception {
    JsonNode account =
        JSON.readTree(new String(Base64.getDecoder().decode(secret), StandardCharsets.UTF_8));
    projectId = text(account, "project_id");
    clientEmail = text(account, "client_email");
    tokenUri = text(account, "token_uri");
    String pem = text(account, "private_key").replaceAll("-+(?:BEGIN|END)[^-]*-+", "");
    byte[] der = Base64.getMimeDecoder().decode(pem);
    key = KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(der));
  }

  private static String text(JsonNode node, String field) {
    String value = node.path(field).asString("");
    if (value.isBlank()) {
      throw new IllegalArgumentException(field);
    }
    return value;
  }

  public boolean enabled() {
    return key != null;
  }

  /** Sends the generic reminder to one device token; never throws. */
  public Outcome send(String deviceToken, String taskId, String title, String body) {
    try {
      String access = accessToken();
      Map<String, Object> message =
          Map.of(
              "token", deviceToken,
              "data", Map.of("taskId", taskId),
              "notification", Map.of("title", title, "body", body),
              "android", Map.of("priority", "high"));
      HttpRequest request =
          HttpRequest.newBuilder(
                  URI.create(baseUrl + "/v1/projects/" + projectId + "/messages:send"))
              .timeout(timeout)
              .header("Authorization", "Bearer " + access)
              .header("Content-Type", "application/json")
              .POST(
                  HttpRequest.BodyPublishers.ofString(
                      JSON.writeValueAsString(Map.of("message", message))))
              .build();
      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
      return outcome(response.statusCode(), response.body());
    } catch (HttpTimeoutException e) {
      return new Outcome("error:timeout", false);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return new Outcome("error:network", false);
    } catch (AccessTokenException e) {
      return new Outcome(e.result, false);
    } catch (Exception e) {
      return new Outcome("error:network", false);
    }
  }

  private Outcome outcome(int status, String body) {
    if (status == 200) {
      try {
        return new Outcome(JSON.readTree(body).path("name").asString(""), false);
      } catch (RuntimeException e) {
        return new Outcome("error:200", false);
      }
    }
    String code = null;
    boolean badToken = false;
    try {
      for (JsonNode detail : JSON.readTree(body).path("error").path("details")) {
        if (detail.has("errorCode")) {
          code = detail.path("errorCode").asString("");
        }
        for (JsonNode violation : detail.path("fieldViolations")) {
          badToken |= "message.token".equals(violation.path("field").asString(""));
        }
      }
    } catch (RuntimeException e) {
      // an unreadable body is just an error with a status
    }
    boolean safe = code != null && code.matches("[A-Z_]{1,40}");
    LOG.warn("FCM send failed: {}{}", status, safe ? " " + code : "");
    boolean rejected =
        (status == 404 && "UNREGISTERED".equals(code)) || (status == 400 && badToken);
    return rejected ? new Outcome("token_rejected", true) : new Outcome("error:" + status, false);
  }

  private static final class AccessTokenException extends RuntimeException {
    private final String result;

    AccessTokenException(String result) {
      super(result, null, false, false);
      this.result = result;
    }
  }

  /** One renewal at a time: a second caller waits and then finds the new token. */
  private synchronized String accessToken() throws Exception {
    Instant now = clock.instant();
    if (accessToken != null && now.isBefore(renewAt)) {
      return accessToken;
    }
    String form =
        "grant_type="
            + URLEncoder.encode(GRANT, StandardCharsets.UTF_8)
            + "&assertion="
            + URLEncoder.encode(jwt(now), StandardCharsets.UTF_8);
    HttpRequest request =
        HttpRequest.newBuilder(URI.create(tokenUri))
            .timeout(timeout)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(form))
            .build();
    HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() != 200) {
      LOG.warn("FCM token request failed: {}", response.statusCode());
      throw new AccessTokenException("error:" + response.statusCode());
    }
    JsonNode answer = JSON.readTree(response.body());
    String token = answer.path("access_token").asString("");
    long expiresIn = answer.path("expires_in").asLong(0);
    if (token.isEmpty()) {
      throw new AccessTokenException("error:network");
    }
    accessToken = token;
    renewAt = now.plusSeconds(expiresIn - 60);
    return token;
  }

  private String jwt(Instant now) throws Exception {
    Base64.Encoder url = Base64.getUrlEncoder().withoutPadding();
    String header =
        url.encodeToString("{\"alg\":\"RS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
    String claims =
        url.encodeToString(
            JSON.writeValueAsBytes(
                Map.of(
                    "iss", clientEmail,
                    "scope", SCOPE,
                    "aud", tokenUri,
                    "iat", now.getEpochSecond(),
                    "exp", now.getEpochSecond() + 3600)));
    Signature rsa = Signature.getInstance("SHA256withRSA");
    rsa.initSign(key);
    rsa.update((header + "." + claims).getBytes(StandardCharsets.US_ASCII));
    return header + "." + claims + "." + url.encodeToString(rsa.sign());
  }
}
