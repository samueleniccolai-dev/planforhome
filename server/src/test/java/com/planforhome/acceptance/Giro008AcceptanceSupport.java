package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Round 008, T5 part 1: what the acceptance tests of tasks, the queue and the return to the queue
 * share. Same application context as rounds 003 and 006. The only reads that are not HTTP are the
 * {@code change_log} rows and the foreign key in the database, through the {@link JdbcTemplate} of
 * the context: T5 asks for a database constraint and a change log that have no API yet.
 */
abstract class Giro008AcceptanceSupport extends Giro006AcceptanceSupport {

  static final String QUERCIA = "Famiglia Quercia";
  static final String ACERO = "Famiglia Acero";
  static final String NOCE = "Famiglia Noce";
  static final String BETULLA = "Famiglia Betulla";
  static final String ONTANO = "Famiglia Ontano";
  static final String ROME = "Europe/Rome";
  static final String NEW_YORK = "America/New_York";

  static final String BREAD = "Comprare il pane";
  static final String BASIL = "Annaffiare il basilico";
  static final String VET = "Portare il cane dal veterinario";
  static final String GAS = "Pagare la bolletta del gas";
  static final String BIKE = "Riparare la bici";

  @Autowired JdbcTemplate jdbc;

  static String id() {
    return UUID.randomUUID().toString();
  }

  static String email8(String name) {
    return "g008-" + name.toLowerCase() + "-" + UUID.randomUUID() + "@example.com";
  }

  /** Registers a person with a new family (default time zone, she manages it) and logs her in. */
  User founder(String name, String familyName) throws Exception {
    String email = email8(name);
    Response created = register(email, GOOD_PASSWORD, name, familyName, null, fromIp(freshIp()));
    assertThat(created.status())
        .as("registration of " + name + ": " + created.body())
        .isEqualTo(201);
    return new User(
        name,
        email,
        created.json("$.personId"),
        token(email, GOOD_PASSWORD),
        created.json("$.families[0].id"));
  }

  /** Registers a person with an invite code and logs her in. */
  User withCode(String name, String code) throws Exception {
    String email = email8(name);
    Response created = register(email, GOOD_PASSWORD, name, null, code, fromIp(freshIp()));
    assertThat(created.status())
        .as("registration of " + name + ": " + created.body())
        .isEqualTo(201);
    return new User(
        name,
        email,
        created.json("$.personId"),
        token(email, GOOD_PASSWORD),
        created.json("$.families[0].id"));
  }

  String createFamilyOk(String token, String name, String timeZone) throws Exception {
    Response created = createFamily(token, null, name, timeZone);
    assertThat(created.status()).as("family " + name + ": " + created.body()).isEqualTo(201);
    return created.json("$.id");
  }

  // ---------------------------------------------------------------- Quercia and Acero

  /**
   * Famiglia Quercia (Europe/Rome): Ugo and Vera managers, Tea and Ivo members, Pia (referent Ugo)
   * and Gino (referent Vera) resources. Famiglia Acero (America/New_York): Tea manages it.
   */
  record Quercia(
      String id, String acero, User ugo, User vera, User tea, User ivo, String pia, String gino) {}

  Quercia quercia() throws Exception {
    User ugo = founder("Ugo", QUERCIA);
    String q = ugo.familyId();
    User vera = withCode("Vera", invite(ugo.token(), q));
    setRoleOk(ugo.token(), q, vera.personId(), "MANAGER");
    User tea = withCode("Tea", invite(ugo.token(), q));
    String acero = createFamilyOk(tea.token(), ACERO, NEW_YORK);
    User ivo = withCode("Ivo", invite(ugo.token(), q));
    String pia = resourceOk(ugo.token(), q, "Pia", ugo.personId());
    String gino = resourceOk(ugo.token(), q, "Gino", vera.personId());
    return new Quercia(q, acero, ugo, vera, tea, ivo, pia, gino);
  }

  // ---------------------------------------------------------------- Noce

  /** Famiglia Noce, created by Ugo (P14); Ada and Bea each have a family of their own too. */
  record Noce(String id, User ugo, User ada, User bea) {}

  Noce noce() throws Exception {
    User ugo = founder("Ugo", QUERCIA);
    String noce = createFamilyOk(ugo.token(), NOCE, ROME);
    User ada = founder("Ada", BETULLA);
    User bea = founder("Bea", ONTANO);
    joinOk(ada, invite(ugo.token(), noce));
    joinOk(bea, invite(ugo.token(), noce));
    return new Noce(noce, ugo, ada, bea);
  }

  // ---------------------------------------------------------------- the endpoints of the round

  /** A body with {@code mutationId} first (left out when null), then the given pairs. */
  static String body(String mutationId, Object... keysAndValues) {
    List<Object> all = new ArrayList<>();
    if (mutationId != null) {
      all.add("mutationId");
      all.add(mutationId);
    }
    all.addAll(Arrays.asList(keysAndValues)); // values may be null (back to the queue)
    return json(all.toArray());
  }

  Response createTask(String token, String familyId, String mutationId, Object... fields)
      throws Exception {
    return send("POST", "/api/families/" + familyId + "/tasks", token, body(mutationId, fields));
  }

  /** Creates a task with a client id, in the queue, and returns its id. */
  String taskOk(String token, String familyId, String title) throws Exception {
    String taskId = id();
    Response created = createTask(token, familyId, id(), "id", taskId, "title", title);
    assertThat(created.status()).as("task " + title + ": " + created.body()).isEqualTo(201);
    return taskId;
  }

  /** Creates a task with a client id, assigned to {@code assignee}, and returns its id. */
  String taskOk(String token, String familyId, String title, String assignee) throws Exception {
    String taskId = id();
    Response created =
        createTask(
            token, familyId, id(), "id", taskId, "title", title, "assigneePersonId", assignee);
    assertThat(created.status()).as("task " + title + ": " + created.body()).isEqualTo(201);
    return taskId;
  }

  Response setAssignee(
      String token, String familyId, String taskId, String mutationId, String assignee)
      throws Exception {
    return send(
        "PUT",
        "/api/families/" + familyId + "/tasks/" + taskId + "/assignee",
        token,
        body(mutationId, "assigneePersonId", assignee));
  }

  Response setAssignee(String token, String familyId, String taskId, String assignee)
      throws Exception {
    return setAssignee(token, familyId, taskId, id(), assignee);
  }

  Response take(String token, String familyId, String taskId, String mutationId) throws Exception {
    return send(
        "POST",
        "/api/families/" + familyId + "/tasks/" + taskId + "/take",
        token,
        body(mutationId));
  }

  Response take(String token, String familyId, String taskId) throws Exception {
    return take(token, familyId, taskId, id());
  }

  // ---------------------------------------------------------------- reads

  List<Map<String, Object>> tasks(String token, String familyId) throws Exception {
    Response tasks = get("/api/families/" + familyId + "/tasks", token);
    assertThat(tasks.status()).as("tasks: " + tasks.body()).isEqualTo(200);
    return JsonPath.read(tasks.body(), "$");
  }

  List<Map<String, Object>> myTasks(String token) throws Exception {
    Response tasks = get("/api/tasks", token);
    assertThat(tasks.status()).as("my tasks: " + tasks.body()).isEqualTo(200);
    return JsonPath.read(tasks.body(), "$");
  }

  static List<String> ids(List<Map<String, Object>> tasks) {
    return tasks.stream().map(t -> (String) t.get("id")).toList();
  }

  static Map<String, Object> find(List<Map<String, Object>> tasks, String taskId) {
    return tasks.stream()
        .filter(t -> taskId.equals(t.get("id")))
        .findFirst()
        .orElseThrow(() -> new AssertionError("task " + taskId + " not in " + tasks));
  }

  Map<String, Object> task(String token, String familyId, String taskId) throws Exception {
    return find(tasks(token, familyId), taskId);
  }

  static long version(Map<String, Object> task) {
    return ((Number) task.get("version")).longValue();
  }

  static long version(Response response) {
    return ((Number) response.json("$.version")).longValue();
  }

  /** The change_log rows of an entity, in seq order: family_id, entity, op. */
  List<Map<String, Object>> changeLog(String entityId) {
    return jdbc.queryForList(
        "select family_id::text as family_id, entity, op from change_log"
            + " where entity_id = ?::uuid order by seq",
        entityId);
  }

  static void assertError(Response response, int status, String error) {
    assertThat(response.status()).as(response.body()).isEqualTo(status);
    assertThat(response.error()).isEqualTo(error);
  }

  String personIdOfDemo(String name) throws Exception {
    return personIdOf(demoToken(name));
  }
}
