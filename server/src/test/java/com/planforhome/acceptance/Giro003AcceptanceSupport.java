package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Round 003, T3: what the acceptance tests of accounts and access share. One PostgreSQL and one
 * application context for all the classes (same configuration, so Spring caches the context): the
 * demo data of Appendix A are seeded once, with the test-only demo password; every test uses its
 * own e-mail addresses. Before each test the clock moves 2 hours ahead, so every attempt window
 * starts empty.
 *
 * <p>Requests come from 127.0.0.1. With {@code server.forward-headers-strategy=native} Tomcat
 * trusts {@code X-Forwarded-For} from a loopback address, so a test may set it to act as another
 * client IP (in production only Caddy, on the Docker network, is trusted).
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "DEMO_PASSWORD=" + Giro003AcceptanceSupport.DEMO_PASSWORD)
@Import(AcceptanceClock.Config.class)
abstract class Giro003AcceptanceSupport {

  /** Test only: never in server/src/main or infra. */
  static final String DEMO_PASSWORD = "Demo-R0-Pass-2026";

  static final String GOOD_PASSWORD = "Lanterna-Blu-42";
  static final String SHORT_PASSWORD = "Corta-1";
  static final String COMMON_PASSWORD = "password123";

  static final String PRINCIPALE = "Famiglia Principale";
  static final String MAMMA = "Famiglia Mamma";
  static final String BABBO = "Famiglia Babbo";

  static final List<String> DEMO_USERS =
      List.of("marco", "giulia", "anna", "pietro", "luca", "paolo", "davide", "rosa", "franco");

  @ServiceConnection static final PostgreSQLContainer POSTGRES = startPostgres();

  private static PostgreSQLContainer startPostgres() {
    PostgreSQLContainer container = new PostgreSQLContainer("postgres:18");
    container.start();
    return container;
  }

  @LocalServerPort int port;

  @Autowired AcceptanceClock clock;

  final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  @BeforeEach
  void freshAttemptWindows() {
    clock.advance(Duration.ofHours(2));
  }

  // ---------------------------------------------------------------- HTTP

  record Response(int status, String body, HttpResponse<String> raw) {

    <T> T json(String path) {
      return JsonPath.read(body, path);
    }

    String error() {
      assertThat(body).as("error body").isNotBlank();
      return JsonPath.read(body, "$.error");
    }
  }

  Response send(String method, String path, String token, String jsonBody) throws Exception {
    return send(method, path, token, jsonBody, Map.of());
  }

  Response send(
      String method, String path, String token, String jsonBody, Map<String, String> headers)
      throws Exception {
    HttpRequest.Builder builder =
        HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
            .timeout(Duration.ofSeconds(30));
    if (token != null) {
      builder.header("Authorization", "Bearer " + token);
    }
    headers.forEach(builder::header);
    if (jsonBody != null) {
      builder.header("Content-Type", "application/json");
      builder.method(method, HttpRequest.BodyPublishers.ofString(jsonBody));
    } else {
      builder.method(method, HttpRequest.BodyPublishers.noBody());
    }
    HttpResponse<String> response =
        http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    return new Response(response.statusCode(), response.body(), response);
  }

  Response get(String path, String token) throws Exception {
    return send("GET", path, token, null);
  }

  // ---------------------------------------------------------------- JSON

  static String json(Object... keysAndValues) {
    Map<String, Object> map = new LinkedHashMap<>();
    for (int i = 0; i < keysAndValues.length; i += 2) {
      map.put((String) keysAndValues[i], keysAndValues[i + 1]);
    }
    StringBuilder out = new StringBuilder("{");
    map.forEach(
        (key, value) -> {
          if (out.length() > 1) {
            out.append(',');
          }
          out.append(quote(key)).append(':');
          out.append(value == null ? "null" : quote(value.toString()));
        });
    return out.append('}').toString();
  }

  static String quote(String text) {
    StringBuilder out = new StringBuilder("\"");
    for (char c : text.toCharArray()) {
      switch (c) {
        case '"' -> out.append("\\\"");
        case '\\' -> out.append("\\\\");
        default -> {
          if (c < 0x20) {
            out.append(String.format("\\u%04x", (int) c));
          } else {
            out.append(c);
          }
        }
      }
    }
    return out.append('"').toString();
  }

  // ---------------------------------------------------------------- account helpers

  Response register(String email, String password, String familyName, String inviteCode)
      throws Exception {
    return register(email, password, "Persona di prova", familyName, inviteCode, Map.of());
  }

  Response register(
      String email,
      String password,
      String displayName,
      String familyName,
      String inviteCode,
      Map<String, String> headers)
      throws Exception {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("email", email);
    body.put("password", password);
    body.put("displayName", displayName);
    body.put("locale", "it");
    if (familyName != null) {
      body.put("familyName", familyName);
    }
    if (inviteCode != null) {
      body.put("inviteCode", inviteCode);
    }
    Object[] flat = new Object[body.size() * 2];
    int i = 0;
    for (Map.Entry<String, Object> entry : body.entrySet()) {
      flat[i++] = entry.getKey();
      flat[i++] = entry.getValue();
    }
    return send("POST", "/api/auth/register", null, json(flat), headers);
  }

  /** Registers a new manager of a new family and returns the family id. */
  String registerManager(String email, String familyName) throws Exception {
    Response created = register(email, GOOD_PASSWORD, familyName, null);
    assertThat(created.status())
        .as("registration of " + email + ": " + created.body())
        .isEqualTo(201);
    return created.json("$.families[0].id");
  }

  Response login(String email, String password) throws Exception {
    return send("POST", "/api/auth/login", null, json("email", email, "password", password));
  }

  /** Logs in and returns the token; fails with an assertion if the login is refused. */
  String token(String email, String password) throws Exception {
    Response response = login(email, password);
    assertThat(response.status()).as("login of " + email + ": " + response.body()).isEqualTo(200);
    String token = response.json("$.token");
    assertThat(token).as("token of " + email).isNotBlank();
    return token;
  }

  String demoToken(String name) throws Exception {
    return token(name + "@example.com", DEMO_PASSWORD);
  }

  /** The id of the family with this name among the families of the token's owner. */
  String familyId(String token, String familyName) throws Exception {
    Response families = get("/api/families", token);
    assertThat(families.status()).as("GET /api/families: " + families.body()).isEqualTo(200);
    List<String> ids = JsonPath.read(families.body(), "$[?(@.name == '" + familyName + "')].id");
    assertThat(ids).as("family " + familyName + " in " + families.body()).hasSize(1);
    return ids.get(0);
  }

  /** Creates an invite as a manager and returns its code. */
  String invite(String token, String familyId) throws Exception {
    Response invite = send("POST", "/api/families/" + familyId + "/invites", token, null);
    assertThat(invite.status()).as("invite: " + invite.body()).isEqualTo(201);
    String code = invite.json("$.code");
    assertThat(code).isNotBlank();
    return code;
  }
}
