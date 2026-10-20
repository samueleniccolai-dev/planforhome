package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Round 013, T6 part 1, case 12: the demo task «Mettere fuori la carta» of Appendix A. Famiglia
 * Principale, created by Marco and assigned to him, every Tuesday, due the first Tuesday from the
 * day of the seed. The seed ran at {@link AcceptanceClock#START} (Monday 6 January 2031), so the
 * first due is Tuesday 7 January. This test marks a demo task done, so it has a database and a
 * context of its own (like {@link Giro010DemoTasksSeedAcceptanceTest}): the shared demo data never
 * see it.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "DEMO_PASSWORD=" + Giro013DemoPaperAcceptanceTest.DEMO_PASSWORD)
@Import(AcceptanceClock.Config.class)
@Testcontainers
class Giro013DemoPaperAcceptanceTest {

  /** Test only: never in server/src/main or infra. */
  static final String DEMO_PASSWORD = "Demo-R0-Pass-2026";

  static final String PRINCIPALE = "Famiglia Principale";
  static final String PAPER = "Mettere fuori la carta";

  @Container @ServiceConnection
  static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18");

  @LocalServerPort int port;
  @Autowired AcceptanceClock clock;

  final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  record Answer(int status, String body) {}

  Answer send(String method, String path, String token, String body) throws Exception {
    HttpRequest.Builder builder =
        HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
            .timeout(Duration.ofSeconds(30));
    if (token != null) builder.header("Authorization", "Bearer " + token);
    if (body != null) {
      builder.header("Content-Type", "application/json");
      builder.method(method, HttpRequest.BodyPublishers.ofString(body));
    } else {
      builder.method(method, HttpRequest.BodyPublishers.noBody());
    }
    HttpResponse<String> response =
        http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    return new Answer(response.statusCode(), response.body());
  }

  String demoToken(String name) throws Exception {
    Answer login =
        send(
            "POST",
            "/api/auth/login",
            null,
            "{\"email\":\"" + name + "@example.com\",\"password\":\"" + DEMO_PASSWORD + "\"}");
    assertThat(login.status()).as("login of " + name + ": " + login.body()).isEqualTo(200);
    return JsonPath.read(login.body(), "$.token");
  }

  String read(String token, String path, String jsonPath) throws Exception {
    Answer answer = send("GET", path, token, null);
    assertThat(answer.status()).as(path + ": " + answer.body()).isEqualTo(200);
    return JsonPath.read(answer.body(), jsonPath);
  }

  String familyId(String token, String name) throws Exception {
    Answer families = send("GET", "/api/families", token, null);
    assertThat(families.status()).as(families.body()).isEqualTo(200);
    List<String> ids = JsonPath.read(families.body(), "$[?(@.name == '" + name + "')].id");
    assertThat(ids).as("family " + name + " in " + families.body()).hasSize(1);
    return ids.get(0);
  }

  List<Map<String, Object>> papers(String token, String familyId) throws Exception {
    Answer tasks = send("GET", "/api/families/" + familyId + "/tasks", token, null);
    assertThat(tasks.status()).as(tasks.body()).isEqualTo(200);
    List<Map<String, Object>> all = JsonPath.read(tasks.body(), "$");
    return all.stream().filter(t -> PAPER.equals(t.get("title"))).toList();
  }

  @Test
  void case12MarcoSeesThePaperEveryTuesdayAndDoneOnThursdayItComesBackNextTuesday()
      throws Exception {
    String marco = demoToken("marco");
    String marcoId = read(marco, "/api/me", "$.personId");
    String principale = familyId(marco, PRINCIPALE);

    List<Map<String, Object>> seeded = papers(marco, principale);
    assertThat(seeded).as("«" + PAPER + "» in Principale").hasSize(1);
    Map<String, Object> paper = seeded.get(0);
    String paperId = (String) paper.get("id");
    assertThat(paper)
        .containsEntry("status", "OPEN")
        .containsEntry("dueKind", "DATE")
        .containsEntry("due", "2031-01-07")
        .containsEntry("assigneePersonId", marcoId)
        .containsEntry("createdBy", marcoId)
        .containsEntry("seriesId", paperId);
    assertThat(paper.get("recurrence"))
        .isEqualTo(Map.of("type", "WEEKLY", "days", List.of("TUESDAY")));

    // Thursday 9 January: Marco puts the paper out late.
    clock.setTo(Instant.parse("2031-01-09T08:00:00Z"));
    Answer done =
        send(
            "POST",
            "/api/families/" + principale + "/tasks/" + paperId + "/done",
            marco,
            "{\"mutationId\":\"" + UUID.randomUUID() + "\"}");
    assertThat(done.status()).as(done.body()).isEqualTo(200);

    List<Map<String, Object>> open =
        papers(marco, principale).stream().filter(t -> "OPEN".equals(t.get("status"))).toList();
    assertThat(open).as("open «" + PAPER + "»").hasSize(1);
    assertThat(open.get(0))
        .containsEntry("due", "2031-01-14")
        .containsEntry("assigneePersonId", marcoId)
        .containsEntry("createdBy", marcoId)
        .containsEntry("seriesId", paperId);
    assertThat(((Number) open.get(0).get("version")).longValue()).isEqualTo(1L);

    // Giulia, manager of Principale, sees it too; Rosa (not in Principale) does not.
    assertThat(papers(demoToken("giulia"), principale)).hasSize(2);
    Answer rosa = send("GET", "/api/families/" + principale + "/tasks", demoToken("rosa"), null);
    assertThat(rosa.status()).isEqualTo(404);
    assertThat(rosa.body()).doesNotContain(PAPER);
  }
}
