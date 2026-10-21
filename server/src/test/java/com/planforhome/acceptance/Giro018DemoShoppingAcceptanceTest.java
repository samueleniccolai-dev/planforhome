package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import com.planforhome.demo.DemoDataSeeder;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Round 018, T8 part 1: the demo task «Lista della spesa» of Appendix A. Famiglia Principale,
 * created by Giulia, in the queue, without due, {@code template = SHOPPING_LIST}, with «Latte»,
 * «Pane», «Mele». This test seeds a second time, so it has a database and a context of its own
 * (like {@link Giro013DemoPaperAcceptanceTest}): the shared demo data never see it.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "DEMO_PASSWORD=" + Giro018DemoShoppingAcceptanceTest.DEMO_PASSWORD)
@Import(AcceptanceClock.Config.class)
@Testcontainers
class Giro018DemoShoppingAcceptanceTest {

  /** Test only: never in server/src/main or infra. */
  static final String DEMO_PASSWORD = "Demo-R0-Pass-2026";

  static final String PRINCIPALE = "Famiglia Principale";
  static final String LIST = "Lista della spesa";

  @Container @ServiceConnection
  static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18");

  @LocalServerPort int port;
  @Autowired DemoDataSeeder seeder;
  @Autowired JdbcTemplate jdbc;

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

  String familyId(String token, String name) throws Exception {
    Answer families = send("GET", "/api/families", token, null);
    assertThat(families.status()).as(families.body()).isEqualTo(200);
    List<String> ids = JsonPath.read(families.body(), "$[?(@.name == '" + name + "')].id");
    assertThat(ids).as("family " + name + " in " + families.body()).hasSize(1);
    return ids.get(0);
  }

  List<Map<String, Object>> lists(String token, String familyId) throws Exception {
    Answer tasks = send("GET", "/api/families/" + familyId + "/tasks", token, null);
    assertThat(tasks.status()).as(tasks.body()).isEqualTo(200);
    List<Map<String, Object>> all = JsonPath.read(tasks.body(), "$");
    return all.stream().filter(t -> LIST.equals(t.get("title"))).toList();
  }

  List<Map<String, Object>> items(String token, String familyId, String taskId) throws Exception {
    Answer items =
        send("GET", "/api/families/" + familyId + "/tasks/" + taskId + "/items", token, null);
    assertThat(items.status()).as("items: " + items.body()).isEqualTo(200);
    return JsonPath.read(items.body(), "$");
  }

  static List<Object> field(List<Map<String, Object>> rows, String name) {
    return rows.stream().map(r -> r.get(name)).toList();
  }

  @Test
  void giuliaFindsTheShoppingListWithMilkBreadAndApplesAndASecondSeedDoesNotDuplicateIt()
      throws Exception {
    String giulia = demoToken("giulia");
    String giuliaId = JsonPath.read(send("GET", "/api/me", giulia, null).body(), "$.personId");
    String principale = familyId(giulia, PRINCIPALE);

    List<Map<String, Object>> seeded = lists(giulia, principale);
    assertThat(seeded).as("«" + LIST + "» in Principale").hasSize(1);
    Map<String, Object> list = seeded.get(0);
    String listId = (String) list.get("id");
    assertThat(list)
        .containsEntry("status", "OPEN")
        .containsEntry("template", "SHOPPING_LIST")
        .containsEntry("assigneePersonId", null)
        .containsEntry("dueKind", null)
        .containsEntry("createdBy", giuliaId);

    List<Map<String, Object>> items = items(demoToken("marco"), principale, listId);
    assertThat(field(items, "text")).containsExactly("Latte", "Pane", "Mele");
    assertThat(field(items, "checked")).containsOnly(false);
    for (Map<String, Object> item : items) {
      assertThat(
              jdbc.queryForList(
                  "select family_id::text as family_id, entity, op from change_log"
                      + " where entity_id = ?::uuid order by seq",
                  (String) item.get("id")))
          .containsExactly(
              Map.of("family_id", principale, "entity", "shopping_item", "op", "UPSERT"));
    }

    // Rosa is not in Principale.
    Answer rosa =
        send(
            "GET",
            "/api/families/" + principale + "/tasks/" + listId + "/items",
            demoToken("rosa"),
            null);
    assertThat(rosa.status()).isEqualTo(404);
    assertThat(rosa.body()).doesNotContain("Latte");

    seeder.run(new DefaultApplicationArguments());

    assertThat(lists(giulia, principale)).as("after a second seed").hasSize(1);
    assertThat(field(items(giulia, principale, listId), "text"))
        .containsExactly("Latte", "Pane", "Mele");
  }
}
