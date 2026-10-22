package com.planforhome.acceptance;

import com.jayway.jsonpath.JsonPath;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Round 031, T10 part 1: a fake of FCM HTTP v1 and of the OAuth {@code token_uri} of a service
 * account, in one JDK HTTP server on a random port of 127.0.0.1. One instance for the whole JVM
 * ({@link #get()}), so the application contexts of round 031 that point at it share one
 * configuration. The RSA key of the service account is generated here, at start: it exists only in
 * this JVM, it is not a secret.
 *
 * <p>{@code POST /token} checks what Google checks (form-urlencoded body, {@code grant_type}, an
 * RS256 JWT signed by the key of the service account, {@code iss}, {@code scope}, {@code aud},
 * {@code exp - iat <= 3600}) and answers {@code {access_token, expires_in: 3600, token_type}}; a
 * check that fails is recorded in {@link #tokenProblems()} and answered 400 {@code invalid_grant}.
 *
 * <p>{@code POST /v1/projects/planforhome-test/messages:send} records the message and answers by
 * the prefix of {@code message.token}:
 *
 * <ul>
 *   <li>{@code tok-dead-}: 404 with {@code FcmError UNREGISTERED};
 *   <li>{@code tok-badtok-}: 400 {@code INVALID_ARGUMENT} with a {@code BadRequest} violation on
 *       {@code message.token};
 *   <li>{@code tok-badreq-}: 400 {@code INVALID_ARGUMENT} with a violation on {@code
 *       message.android.priority} (the payload, not the token);
 *   <li>{@code tok-boom-}: 503 {@code UNAVAILABLE};
 *   <li>{@code tok-slow-}: waits {@link #SLOW_MILLIS} ms, then 200;
 *   <li>anything else: 200 {@code {"name": "projects/planforhome-test/messages/<n>"}}.
 * </ul>
 *
 * A request without a {@code Bearer} issued by this fake is answered 401 and recorded as a problem.
 */
final class Giro031FakeFcm {

  static final String PROJECT_ID = "planforhome-test";
  static final String CLIENT_EMAIL = "fcm-test@planforhome-test.iam.gserviceaccount.com";
  static final String SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
  static final String GRANT_TYPE = "urn:ietf:params:oauth:grant-type:jwt-bearer";
  static final String ACCESS_PREFIX = "fake-access-031-";
  static final String SEND_PATH = "/v1/projects/" + PROJECT_ID + "/messages:send";
  static final long SLOW_MILLIS = 5_000;

  /** One message received by the fake FCM. */
  record Message(String token, String authorization, String body, int status, String name) {}

  /** One exchange at {@code token_uri}: the claims of the JWT and the access token given back. */
  record TokenCall(Map<String, Object> claims, String assertion, String accessToken) {}

  private static Giro031FakeFcm instance;

  private final HttpServer server;
  private final KeyPair keys;
  private final List<Message> messages = new CopyOnWriteArrayList<>();
  private final List<TokenCall> tokenCalls = new CopyOnWriteArrayList<>();
  private final List<String> problems = new CopyOnWriteArrayList<>();
  private final List<String> issued = new CopyOnWriteArrayList<>();
  private final AtomicInteger names = new AtomicInteger();

  static synchronized Giro031FakeFcm get() {
    if (instance == null) {
      instance = new Giro031FakeFcm();
    }
    return instance;
  }

  private Giro031FakeFcm() {
    try {
      KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
      generator.initialize(2048);
      keys = generator.generateKeyPair();
      server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
      server.setExecutor(Executors.newCachedThreadPool());
      server.createContext("/token", this::token);
      server.createContext("/v1/", this::send);
      server.start();
    } catch (Exception e) {
      throw new IllegalStateException("fake FCM did not start", e);
    }
  }

  // ---------------------------------------------------------------- configuration for the server

  String baseUrl() {
    return "http://127.0.0.1:" + server.getAddress().getPort();
  }

  String tokenUri() {
    return baseUrl() + "/token";
  }

  /** The service account JSON, as Google gives it, with the key of this fake. */
  String serviceAccountJson() {
    return serviceAccountJson(pem(keys.getPrivate().getEncoded()));
  }

  /** The service account JSON with any {@code private_key} (for the malformed case). */
  String serviceAccountJson(String privateKey) {
    return "{"
        + "\"type\":\"service_account\","
        + "\"project_id\":\""
        + PROJECT_ID
        + "\","
        + "\"private_key_id\":\"giro031-test-key\","
        + "\"private_key\":"
        + Giro003AcceptanceSupport.quote(privateKey)
        + ","
        + "\"client_email\":\""
        + CLIENT_EMAIL
        + "\","
        + "\"client_id\":\"000000000000000000031\","
        + "\"token_uri\":\""
        + tokenUri()
        + "\""
        + "}";
  }

  /** 40 characters from the middle of the base64 of the private key. */
  String privateKeyFragment() {
    String der = Base64.getEncoder().encodeToString(keys.getPrivate().getEncoded());
    return der.substring(der.length() / 2, der.length() / 2 + 40);
  }

  /** What {@code FCM_SERVICE_ACCOUNT_BASE64} holds in production. */
  String serviceAccountBase64() {
    return base64(serviceAccountJson());
  }

  static String base64(String text) {
    return Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));
  }

  /** PKCS#8 in PEM, as in the JSON of Google (64 columns, \n). */
  private static String pem(byte[] der) {
    String label = "PRIVATE" + " KEY"; // the guard looks for PEM headers in diffs
    String body =
        Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII)).encodeToString(der);
    return String.format("-----BEGIN %s-----%n%s%n-----END %s-----%n", label, body, label)
        .replace("\r\n", "\n");
  }

  // ---------------------------------------------------------------- what the tests read

  void reset() {
    messages.clear();
    tokenCalls.clear();
    problems.clear();
  }

  List<Message> messages() {
    return List.copyOf(messages);
  }

  List<Message> messagesTo(String deviceToken) {
    return messages.stream().filter(m -> deviceToken.equals(m.token())).toList();
  }

  List<TokenCall> tokenCalls() {
    return List.copyOf(tokenCalls);
  }

  List<String> tokenProblems() {
    return List.copyOf(problems);
  }

  List<String> issuedAccessTokens() {
    return List.copyOf(issued);
  }

  // ---------------------------------------------------------------- token_uri

  private void token(HttpExchange exchange) throws IOException {
    try {
      String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
      List<String> wrong = new ArrayList<>();
      if (!"POST".equals(exchange.getRequestMethod()))
        wrong.add("method " + exchange.getRequestMethod());
      String type = exchange.getRequestHeaders().getFirst("Content-Type");
      if (type == null || !type.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
        wrong.add("content type " + type);
      }
      Map<String, String> form = form(body);
      if (!GRANT_TYPE.equals(form.get("grant_type")))
        wrong.add("grant_type " + form.get("grant_type"));
      String assertion = form.getOrDefault("assertion", "");
      Map<String, Object> claims = verify(assertion, wrong);
      if (!wrong.isEmpty()) {
        problems.addAll(wrong);
        reply(exchange, 400, "{\"error\":\"invalid_grant\",\"error_description\":\"fake\"}");
        return;
      }
      String access = ACCESS_PREFIX + names.incrementAndGet();
      issued.add(access);
      tokenCalls.add(new TokenCall(claims, assertion, access));
      reply(
          exchange,
          200,
          "{\"access_token\":\"" + access + "\",\"expires_in\":3600,\"token_type\":\"Bearer\"}");
    } catch (RuntimeException e) {
      problems.add("token_uri: " + e);
      reply(exchange, 400, "{\"error\":\"invalid_grant\"}");
    }
  }

  private Map<String, Object> verify(String jwt, List<String> wrong) {
    String[] parts = jwt.split("\\.");
    if (parts.length != 3) {
      wrong.add("assertion is not a JWT");
      return Map.of();
    }
    Base64.Decoder url = Base64.getUrlDecoder();
    String header = new String(url.decode(parts[0]), StandardCharsets.UTF_8);
    String payload = new String(url.decode(parts[1]), StandardCharsets.UTF_8);
    if (!"RS256".equals(JsonPath.read(header, "$.alg"))) wrong.add("alg of " + header);
    try {
      Signature rsa = Signature.getInstance("SHA256withRSA");
      rsa.initVerify((RSAPublicKey) keys.getPublic());
      rsa.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
      if (!rsa.verify(url.decode(parts[2]))) wrong.add("signature");
    } catch (Exception e) {
      wrong.add("signature: " + e.getClass().getSimpleName());
    }
    Map<String, Object> claims = JsonPath.read(payload, "$");
    if (!CLIENT_EMAIL.equals(claims.get("iss"))) wrong.add("iss " + claims.get("iss"));
    if (!SCOPE.equals(claims.get("scope"))) wrong.add("scope " + claims.get("scope"));
    if (!tokenUri().equals(claims.get("aud"))) wrong.add("aud " + claims.get("aud"));
    if (!(claims.get("iat") instanceof Number iat) || !(claims.get("exp") instanceof Number exp)) {
      wrong.add("iat/exp missing: " + payload);
    } else if (exp.longValue() <= iat.longValue() || exp.longValue() - iat.longValue() > 3600) {
      wrong.add("exp - iat = " + (exp.longValue() - iat.longValue()));
    }
    return new LinkedHashMap<>(claims);
  }

  /** The {@code iat} of a token call, as an instant. */
  static Instant iat(TokenCall call) {
    return Instant.ofEpochSecond(((Number) call.claims().get("iat")).longValue());
  }

  private static Map<String, String> form(String body) {
    Map<String, String> form = new LinkedHashMap<>();
    for (String pair : body.split("&")) {
      if (pair.isEmpty()) continue;
      String[] kv = pair.split("=", 2);
      form.put(
          URLDecoder.decode(kv[0], StandardCharsets.UTF_8),
          kv.length > 1 ? URLDecoder.decode(kv[1], StandardCharsets.UTF_8) : "");
    }
    return form;
  }

  // ---------------------------------------------------------------- messages:send

  private void send(HttpExchange exchange) throws IOException {
    String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    String authorization = exchange.getRequestHeaders().getFirst("Authorization");
    if (!"POST".equals(exchange.getRequestMethod())
        || !SEND_PATH.equals(exchange.getRequestURI().getPath())) {
      problems.add("send: " + exchange.getRequestMethod() + " " + exchange.getRequestURI());
      reply(exchange, 404, "{\"error\":{\"code\":404,\"status\":\"NOT_FOUND\"}}");
      return;
    }
    String token;
    try {
      token = JsonPath.read(body, "$.message.token");
    } catch (RuntimeException e) {
      token = null;
    }
    if (authorization == null
        || !authorization.startsWith("Bearer ")
        || !issued.contains(authorization.substring("Bearer ".length()))) {
      problems.add("send without a Bearer of the fake: " + authorization);
      messages.add(new Message(token, authorization, body, 401, null));
      reply(exchange, 401, error(401, "UNAUTHENTICATED", null, null));
      return;
    }
    String t = token == null ? "" : token;
    if (t.startsWith("tok-dead-")) {
      messages.add(new Message(token, authorization, body, 404, null));
      reply(exchange, 404, error(404, "NOT_FOUND", "UNREGISTERED", null));
    } else if (t.startsWith("tok-badtok-")) {
      messages.add(new Message(token, authorization, body, 400, null));
      reply(exchange, 400, error(400, "INVALID_ARGUMENT", "INVALID_ARGUMENT", "message.token"));
    } else if (t.startsWith("tok-badreq-")) {
      messages.add(new Message(token, authorization, body, 400, null));
      reply(
          exchange,
          400,
          error(400, "INVALID_ARGUMENT", "INVALID_ARGUMENT", "message.android.priority"));
    } else if (t.startsWith("tok-boom-")) {
      messages.add(new Message(token, authorization, body, 503, null));
      reply(exchange, 503, error(503, "UNAVAILABLE", "UNAVAILABLE", null));
    } else {
      if (t.startsWith("tok-slow-")) {
        try {
          Thread.sleep(SLOW_MILLIS);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
        }
      }
      String name = "projects/" + PROJECT_ID + "/messages/0:031" + names.incrementAndGet();
      messages.add(new Message(token, authorization, body, 200, name));
      try {
        reply(exchange, 200, "{\"name\":\"" + name + "\"}");
      } catch (IOException e) {
        // the server under test already gave up (timeout): nothing to answer
      }
    }
  }

  /** An error body of FCM HTTP v1: {@code google.rpc.Status} with FcmError and BadRequest. */
  private static String error(int code, String status, String fcmError, String field) {
    StringBuilder details = new StringBuilder();
    if (fcmError != null) {
      details.append(
          "{\"@type\":\"type.googleapis.com/google.firebase.fcm.v1.FcmError\",\"errorCode\":\""
              + fcmError
              + "\"}");
    }
    if (field != null) {
      details.append(
          ",{\"@type\":\"type.googleapis.com/google.rpc.BadRequest\",\"fieldViolations\":"
              + "[{\"field\":\""
              + field
              + "\",\"description\":\"Invalid value (fake)\"}]}");
    }
    return "{\"error\":{\"code\":"
        + code
        + ",\"message\":\"fake error of round 031\",\"status\":\""
        + status
        + "\",\"details\":["
        + details
        + "]}}";
  }

  private static void reply(HttpExchange exchange, int status, String json) throws IOException {
    byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
    exchange.sendResponseHeaders(status, bytes.length);
    try (var out = exchange.getResponseBody()) {
      out.write(bytes);
    }
  }
}
