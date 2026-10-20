package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.jayway.jsonpath.JsonPath;
import com.planforhome.demo.DemoDataSeeder;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Round 010, T5 part 2: the demo tasks are seeded again when the demo people already exist (the
 * production case: the demo families are there since round 003), once per title, and a missing
 * family never stops the start-up. A database of its own (like {@code
 * DemoDataSeederAtomicityTest}): these tests delete and rename rows, which the shared context of
 * the other acceptance classes must never see. Reads go through HTTP; deletes and renames through
 * JDBC (there is no API for them).
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "DEMO_PASSWORD=" + Giro010DemoTasksSeedAcceptanceTest.DEMO_PASSWORD)
@Import(AcceptanceClock.Config.class)
@Testcontainers
@ExtendWith(OutputCaptureExtension.class)
class Giro010DemoTasksSeedAcceptanceTest {

  /** Test only: never in server/src/main or infra. */
  static final String DEMO_PASSWORD = "Demo-R0-Pass-2026";

  static final String MAMMA = "Famiglia Mamma";
  static final String BABBO = "Famiglia Babbo";
  static final String BABBO_RENAMED = "Famiglia Babbo (rinominata nel test)";
  static final String LUNCH = "Prenotare il pranzo di Natale";
  static final String ID_CARD = "Rinnovare la carta d'identità di Franco";

  @Container @ServiceConnection
  static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18");

  @LocalServerPort int port;
  @Autowired DemoDataSeeder seeder;
  @Autowired JdbcTemplate jdbc;

  final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  // ---------------------------------------------------------------- HTTP

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

  String token(String email, String password) throws Exception {
    Answer login =
        send(
            "POST",
            "/api/auth/login",
            null,
            "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
    assertThat(login.status()).as("login of " + email + ": " + login.body()).isEqualTo(200);
    return JsonPath.read(login.body(), "$.token");
  }

  String demoToken(String name) throws Exception {
    return token(name + "@example.com", DEMO_PASSWORD);
  }

  String familyId(String token, String name) throws Exception {
    Answer families = send("GET", "/api/families", token, null);
    assertThat(families.status()).as(families.body()).isEqualTo(200);
    List<String> ids = JsonPath.read(families.body(), "$[?(@.name == '" + name + "')].id");
    assertThat(ids).as("family " + name + " in " + families.body()).hasSize(1);
    return ids.get(0);
  }

  List<Map<String, Object>> titled(String token, String familyId, String title) throws Exception {
    Answer tasks = send("GET", "/api/families/" + familyId + "/tasks", token, null);
    assertThat(tasks.status()).as(tasks.body()).isEqualTo(200);
    List<Map<String, Object>> all = JsonPath.read(tasks.body(), "$");
    return all.stream().filter(t -> title.equals(t.get("title"))).toList();
  }

  int lunches() throws Exception {
    String anna = demoToken("anna");
    return titled(anna, familyId(anna, MAMMA), LUNCH).size();
  }

  int idCards() throws Exception {
    String rosa = demoToken("rosa");
    return titled(rosa, familyId(rosa, BABBO), ID_CARD).size();
  }

  // ---------------------------------------------------------------- JDBC (no API for these)

  /** Deletes the demo tasks with this title and their change_log rows. */
  void deleteDemoTasks(String title) {
    List<UUID> ids = jdbc.queryForList("select id from task where title = ?", UUID.class, title);
    for (UUID id : ids) {
      jdbc.update("delete from change_log where entity_id = ?", id);
      jdbc.update("delete from task where id = ?", id);
    }
  }

  long changeLogRows(String title) {
    return jdbc.queryForObject(
        "select count(*) from change_log c join task t on t.id = c.entity_id"
            + " where t.title = ? and c.entity = 'task' and c.op = 'UPSERT'"
            + " and c.family_id = t.family_id",
        Long.class,
        title);
  }

  void seedAgain() {
    seeder.run(new DefaultApplicationArguments());
  }

  /** Every test leaves the demo as the start-up made it: Babbo with its name, both tasks once. */
  @AfterEach
  void restoreTheDemo() {
    jdbc.update("update family set name = ? where name = ?", BABBO, BABBO_RENAMED);
    seedAgain();
  }

  // ---------------------------------------------------------------- tests

  @Test
  void seedingTwiceMoreKeepsOneTaskPerTitle() throws Exception {
    seedAgain();
    seedAgain();
    assertThat(lunches()).isEqualTo(1);
    assertThat(idCards()).isEqualTo(1);
    assertThat(changeLogRows(LUNCH)).isEqualTo(1);
    assertThat(changeLogRows(ID_CARD)).isEqualTo(1);
  }

  @Test
  void withThePeopleAlreadyThereTheMissingTasksComeBackOnce() throws Exception {
    deleteDemoTasks(LUNCH);
    deleteDemoTasks(ID_CARD);
    assertThat(lunches()).isZero();

    seedAgain();
    assertThat(lunches()).isEqualTo(1);
    assertThat(idCards()).isEqualTo(1);
    assertThat(changeLogRows(LUNCH)).isEqualTo(1);
    assertThat(changeLogRows(ID_CARD)).isEqualTo(1);

    String rosa = demoToken("rosa");
    Map<String, Object> card = titled(rosa, familyId(rosa, BABBO), ID_CARD).get(0);
    assertThat(((Number) card.get("version")).longValue()).isEqualTo(1L);
    assertThat(card.get("dueKind")).isEqualTo("DATE");

    seedAgain();
    assertThat(lunches()).isEqualTo(1);
    assertThat(idCards()).isEqualTo(1);
  }

  @Test
  void aMissingFamilySkipsItsTaskWithoutStoppingTheSeederOrNamingAnyone(CapturedOutput output)
      throws Exception {
    // A family named Babbo that Rosa is not in: the task must never land there.
    String impostorEmail = "g010-impostore-" + UUID.randomUUID() + "@example.com";
    Answer registered =
        send(
            "POST",
            "/api/auth/register",
            null,
            "{\"email\":\""
                + impostorEmail
                + "\",\"password\":\"Lanterna-Blu-42\",\"displayName\":\"Impostore\","
                + "\"locale\":\"it\",\"familyName\":\""
                + BABBO
                + "\"}");
    assertThat(registered.status()).as(registered.body()).isEqualTo(201);
    String impostor = token(impostorEmail, "Lanterna-Blu-42");
    String impostorFamily = JsonPath.read(registered.body(), "$.families[0].id");

    deleteDemoTasks(LUNCH);
    deleteDemoTasks(ID_CARD);
    String rosa = demoToken("rosa");
    String realBabbo = familyId(rosa, BABBO);
    jdbc.update("update family set name = ? where id = ?::uuid", BABBO_RENAMED, realBabbo);

    int before = output.getOut().length();
    assertThatCode(this::seedAgain).doesNotThrowAnyException();
    String logged = output.getOut().substring(before);

    // The other family is seeded anyway; Babbo's task is skipped, not put elsewhere.
    assertThat(lunches()).isEqualTo(1);
    assertThat(titled(rosa, realBabbo, ID_CARD)).isEmpty();
    assertThat(titled(impostor, impostorFamily, ID_CARD)).isEmpty();
    assertThat(
            jdbc.queryForObject("select count(*) from task where title = ?", Long.class, ID_CARD))
        .isZero();
    assertThat(logged).doesNotContain("@example.com").doesNotContain("Rosa");

    // Once the family has its name back, the next start-up seeds it in the right family.
    jdbc.update("update family set name = ? where id = ?::uuid", BABBO, realBabbo);
    seedAgain();
    assertThat(titled(rosa, realBabbo, ID_CARD)).hasSize(1);
    assertThat(titled(impostor, impostorFamily, ID_CARD)).isEmpty();
  }
}
