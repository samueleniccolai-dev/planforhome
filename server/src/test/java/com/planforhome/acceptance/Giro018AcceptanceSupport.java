package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Round 018, T8 part 1 (server): what the acceptance tests of the shopping list share. The people
 * have the names of Appendix A, but every test registers its own accounts and families (as in
 * rounds 008 to 016): the demo families are never written.
 *
 * <ul>
 *   <li>Famiglia Mamma (Europe/Rome): Anna manager; Luca and Davide members; Giulia member.
 *   <li>Famiglia Principale (Europe/Rome): Giulia and Marco managers. Marco is not in Mamma.
 * </ul>
 *
 * <p>The only reads that are not HTTP are {@code shopping_item}, {@code change_log} and {@code
 * applied_mutation}. Every read of {@code shopping_item} comes after an assertion on an HTTP answer
 * of the round (an item added with 201), so that a missing table never hides the real failure.
 */
abstract class Giro018AcceptanceSupport extends Giro013AcceptanceSupport {

  static final String SABATO = "Spesa del sabato";
  static final String SETTIMANALE = "Spesa settimanale";
  static final String FOTO = "Ritirare le foto";

  static final String SATURDAYS = "{\"type\":\"WEEKLY\",\"days\":[\"SATURDAY\"]}";

  record World(
      String principale,
      String mamma,
      User giulia,
      User marco,
      User anna,
      User luca,
      User davide) {}

  World world() throws Exception {
    User anna = founder("Anna", MAMMA);
    String m = anna.familyId();
    User luca = withCode("Luca", invite(anna.token(), m));
    User davide = withCode("Davide", invite(anna.token(), m));
    User giulia = founder("Giulia", PRINCIPALE);
    String p = giulia.familyId();
    User marco = withCode("Marco", invite(giulia.token(), p));
    setRoleOk(giulia.token(), p, marco.personId(), "MANAGER");
    joinOk(giulia, invite(anna.token(), m));
    return new World(p, m, giulia, marco, anna, luca, davide);
  }

  // ---------------------------------------------------------------- task with a template

  /** POST of a task in the queue with a raw JSON {@code template} (left out when null). */
  Response createWithTemplate(
      String token, String familyId, String taskId, String title, String templateJson)
      throws Exception {
    List<String> fields = new ArrayList<>();
    fields.add("\"mutationId\":" + quote(id()));
    fields.add("\"id\":" + quote(taskId));
    fields.add("\"title\":" + quote(title));
    if (templateJson != null) fields.add("\"template\":" + templateJson);
    return send(
        "POST",
        "/api/families/" + familyId + "/tasks",
        token,
        "{" + String.join(",", fields) + "}");
  }

  /** A shopping list in the queue; fails with an assertion if refused. */
  String listOk(String token, String familyId, String title) throws Exception {
    String taskId = id();
    Response created = createWithTemplate(token, familyId, taskId, title, "\"SHOPPING_LIST\"");
    assertThat(created.status()).as("list " + title + ": " + created.body()).isEqualTo(201);
    return taskId;
  }

  /** A weekly shopping list, every Saturday, DATE {@code due}, in the queue. */
  String weeklyListOk(String token, String familyId, String title, String due) throws Exception {
    String taskId = id();
    String body =
        "{\"mutationId\":"
            + quote(id())
            + ",\"id\":"
            + quote(taskId)
            + ",\"title\":"
            + quote(title)
            + ",\"dueKind\":\"DATE\",\"due\":"
            + quote(due)
            + ",\"recurrence\":"
            + SATURDAYS
            + ",\"template\":\"SHOPPING_LIST\"}";
    Response created = send("POST", "/api/families/" + familyId + "/tasks", token, body);
    assertThat(created.status()).as("list " + title + ": " + created.body()).isEqualTo(201);
    return taskId;
  }

  // ---------------------------------------------------------------- the endpoints of the round

  static String itemsPath(String familyId, String taskId) {
    return "/api/families/" + familyId + "/tasks/" + taskId + "/items";
  }

  Response getItems(String token, String familyId, String taskId) throws Exception {
    return get(itemsPath(familyId, taskId), token);
  }

  /** POST of an item; {@code itemId} and {@code mutationId} are left out when null. */
  Response add(
      String token, String familyId, String taskId, String mutationId, String itemId, String text)
      throws Exception {
    List<String> fields = new ArrayList<>();
    if (mutationId != null) fields.add("\"mutationId\":" + quote(mutationId));
    if (itemId != null) fields.add("\"id\":" + quote(itemId));
    fields.add("\"text\":" + quote(text));
    return send("POST", itemsPath(familyId, taskId), token, "{" + String.join(",", fields) + "}");
  }

  Response add(String token, String familyId, String taskId, String text) throws Exception {
    return add(token, familyId, taskId, id(), id(), text);
  }

  /** Adds an item with a client id; fails with an assertion if not 201; returns the id. */
  String addOk(String token, String familyId, String taskId, String text) throws Exception {
    String itemId = id();
    Response added = add(token, familyId, taskId, id(), itemId, text);
    assertThat(added.status()).as("item " + text + ": " + added.body()).isEqualTo(201);
    return itemId;
  }

  Response check(
      String token,
      String familyId,
      String taskId,
      String itemId,
      String mutationId,
      boolean checked)
      throws Exception {
    String body =
        mutationId == null
            ? "{\"checked\":" + checked + "}"
            : "{\"mutationId\":" + quote(mutationId) + ",\"checked\":" + checked + "}";
    return send("PUT", itemsPath(familyId, taskId) + "/" + itemId + "/checked", token, body);
  }

  Response check(String token, String familyId, String taskId, String itemId, boolean checked)
      throws Exception {
    return check(token, familyId, taskId, itemId, id(), checked);
  }

  void checkOk(String token, String familyId, String taskId, String itemId) throws Exception {
    Response checked = check(token, familyId, taskId, itemId, true);
    assertThat(checked.status()).as("check: " + checked.body()).isEqualTo(200);
  }

  Response order(
      String token, String familyId, String taskId, String mutationId, List<String> itemIds)
      throws Exception {
    String ids =
        itemIds.stream().map(Giro003AcceptanceSupport::quote).collect(Collectors.joining(","));
    String body =
        mutationId == null
            ? "{\"itemIds\":[" + ids + "]}"
            : "{\"mutationId\":" + quote(mutationId) + ",\"itemIds\":[" + ids + "]}";
    return send("PUT", itemsPath(familyId, taskId) + "/order", token, body);
  }

  Response order(String token, String familyId, String taskId, List<String> itemIds)
      throws Exception {
    return order(token, familyId, taskId, id(), itemIds);
  }

  Response clearChecked(String token, String familyId, String taskId, String mutationId)
      throws Exception {
    String body = mutationId == null ? "{}" : "{\"mutationId\":" + quote(mutationId) + "}";
    return send("POST", itemsPath(familyId, taskId) + "/clear-checked", token, body);
  }

  Response clearChecked(String token, String familyId, String taskId) throws Exception {
    return clearChecked(token, familyId, taskId, id());
  }

  // ---------------------------------------------------------------- reads

  /**
   * The body of an answer as a JSON object (a missing field is then an assertion, not an error).
   */
  static Map<String, Object> object(Response response) {
    assertThat(response.body()).as("body").startsWith("{");
    return JsonPath.read(response.body(), "$");
  }

  List<Map<String, Object>> items(String token, String familyId, String taskId) throws Exception {
    Response items = getItems(token, familyId, taskId);
    assertThat(items.status()).as("items: " + items.body()).isEqualTo(200);
    return JsonPath.read(items.body(), "$");
  }

  static List<String> texts(List<Map<String, Object>> items) {
    return items.stream().map(i -> (String) i.get("text")).toList();
  }

  static List<Integer> positions(List<Map<String, Object>> items) {
    return items.stream().map(i -> ((Number) i.get("position")).intValue()).toList();
  }

  static List<Object> checks(List<Map<String, Object>> items) {
    return items.stream().map(i -> i.get("checked")).toList();
  }

  static Map<String, Object> item(List<Map<String, Object>> items, String itemId) {
    return items.stream()
        .filter(i -> itemId.equals(i.get("id")))
        .findFirst()
        .orElseThrow(() -> new AssertionError("item " + itemId + " not in " + items));
  }

  /** The rows of shopping_item of a task, cancelled ones too, in order of position. */
  List<Map<String, Object>> storedItems(String taskId) {
    return jdbc.queryForList(
        "select id::text as id, text, checked, position, version, deleted_at"
            + " from shopping_item where task_id = ?::uuid order by position, created_at",
        taskId);
  }

  /** The change_log rows of the items of a task: family_id, entity, op, in seq order. */
  List<Map<String, Object>> itemsLog(String taskId) {
    return jdbc.queryForList(
        "select c.family_id::text as family_id, c.entity, c.op from change_log c"
            + " join shopping_item s on s.id = c.entity_id"
            + " where s.task_id = ?::uuid order by c.seq",
        taskId);
  }

  int shoppingLogRows() {
    Integer count =
        jdbc.queryForObject(
            "select count(*) from change_log where entity = 'shopping_item'", Integer.class);
    return count == null ? 0 : count;
  }

  static Map<String, Object> itemRow(String familyId, String op) {
    return Map.of("family_id", familyId, "entity", "shopping_item", "op", op);
  }
}
