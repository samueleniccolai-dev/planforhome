package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Round 000, T1: the health endpoint, black box over HTTP. The commit SHA reaches the server the
 * same way as in production: through the GIT_SHA variable (the Dockerfile's ENV), not through an
 * internal property name.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@TestPropertySource(properties = "GIT_SHA=" + Giro000HealthAcceptanceTest.SHA)
class Giro000HealthAcceptanceTest {

  static final String SHA = "0123456789abcdef0123456789abcdef01234567";

  @Container @ServiceConnection
  static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18");

  @LocalServerPort int port;

  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  private HttpResponse<String> get(String path) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
            .timeout(Duration.ofSeconds(10))
            .GET()
            .build();
    return http.send(request, HttpResponse.BodyHandlers.ofString());
  }

  @Test
  void healthIsPublicJsonWithStatusUpAndTheShaFromGitShaVariable() throws Exception {
    HttpResponse<String> response = get("/api/health");

    assertThat(response.statusCode()).isEqualTo(200);
    assertThat(response.headers().firstValue("Content-Type"))
        .hasValueSatisfying(type -> assertThat(type).startsWith("application/json"));
    assertThat((String) JsonPath.read(response.body(), "$.status")).isEqualTo("UP");
    assertThat((String) JsonPath.read(response.body(), "$.sha")).isEqualTo(SHA);
  }

  @Test
  void everythingElseUnderApiIsClosedWithoutLogin() throws Exception {
    assertThat(get("/api/qualcosa-che-non-esiste").statusCode()).isEqualTo(401);
  }

  @Test
  void noManagementEndpointIsReachable() throws Exception {
    // No Actuator (critique of round 000): the Compose healthcheck uses /api/health.
    assertThat(get("/actuator/health").statusCode()).isNotEqualTo(200);
    assertThat(get("/actuator").statusCode()).isNotEqualTo(200);
  }
}
