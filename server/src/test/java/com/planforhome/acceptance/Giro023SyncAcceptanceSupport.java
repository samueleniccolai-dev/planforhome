package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Round 023, T9 part 1 (server): what the acceptance tests of the sync API share. Every test
 * registers its own accounts and families with the names of Appendix A ({@link #families()}):
 * Famiglia Mamma (Anna and Pietro managers; Giulia, Luca, Paolo, Davide members) and Famiglia
 * Principale (Giulia and Marco managers). Famiglia Babbo (Rosa alone) is made where needed.
 *
 * <p>The contract: {@code GET /api/sync/families/{f}/snapshot} gives {@code familyId}, {@code seq},
 * {@code tasks}, {@code shoppingItems}, {@code members}; {@code GET
 * /api/sync/families/{f}/changes?after&limit} gives {@code changes} (one row per entity of the raw
 * page, the one with the highest seq), {@code lastSeq} (highest seq of the raw page) and {@code
 * hasMore}. The only reads that are not HTTP are the raw {@code change_log} seqs, always after an
 * assertion on an HTTP answer of the round.
 */
abstract class Giro023SyncAcceptanceSupport extends Giro019AcceptanceSupport {

  static final String PIANTE_BALCONE = "Annaffiare le piante del balcone";
  static final String PIANTE_GIARDINO = "Annaffiare le piante in giardino";
  static final String PRANZO = "Prenotare il pranzo di Natale";
  static final String GRONDAIA = "Pulire la grondaia";
  static final List<String> SPESA = List.of("latte", "uova", "farina");

  /** One page of changes, as read from the answer. */
  record Page(String body, List<Map<String, Object>> changes, long lastSeq, boolean hasMore) {}

  /** «Comprare il pane» with «latte», «uova», «farina», created by the given person. */
  record List3(String list, List<String> items) {}

  // ---------------------------------------------------------------- the endpoints of the round

  static String snapshotPath(String familyId) {
    return "/api/sync/families/" + familyId + "/snapshot";
  }

  static String changesPath(String familyId) {
    return "/api/sync/families/" + familyId + "/changes";
  }

  Response snapshot(String token, String familyId) throws Exception {
    return get(snapshotPath(familyId), token);
  }

  /** GET of changes with a raw query string (for instance {@code "?after=3&limit=1"}). */
  Response changes(String token, String familyId, String query) throws Exception {
    return get(changesPath(familyId) + query, token);
  }

  Map<String, Object> snapshotOk(String token, String familyId) throws Exception {
    Response snapshot = snapshot(token, familyId);
    assertThat(snapshot.status()).as("snapshot: " + snapshot.body()).isEqualTo(200);
    Map<String, Object> body = object(snapshot);
    assertThat(body).as("snapshot").containsKeys("familyId", "seq", "tasks", "shoppingItems");
    return body;
  }

  long seqOk(String token, String familyId) throws Exception {
    return number(snapshotOk(token, familyId).get("seq"));
  }

  /** One page of changes; {@code limit} is left out when null. */
  Page changesOk(String token, String familyId, long after, Integer limit) throws Exception {
    String query = "?after=" + after + (limit == null ? "" : "&limit=" + limit);
    Response changes = changes(token, familyId, query);
    assertThat(changes.status()).as("changes" + query + ": " + changes.body()).isEqualTo(200);
    Map<String, Object> body = object(changes);
    assertThat(body).as("changes").containsKeys("changes", "lastSeq", "hasMore");
    List<Map<String, Object>> rows = JsonPath.read(changes.body(), "$.changes");
    return new Page(
        changes.body(),
        rows,
        number(body.get("lastSeq")),
        Boolean.TRUE.equals(body.get("hasMore")));
  }

  /** Reads page after page from {@code after} until {@code hasMore} is false. */
  List<Page> walk(String token, String familyId, long after, Integer limit) throws Exception {
    List<Page> pages = new ArrayList<>();
    long from = after;
    for (int i = 0; i < 200; i++) {
      Page page = changesOk(token, familyId, from, limit);
      pages.add(page);
      if (!page.hasMore()) {
        return pages;
      }
      assertThat(page.lastSeq()).as("lastSeq grows: " + page.body()).isGreaterThan(from);
      from = page.lastSeq();
    }
    throw new AssertionError("more than 200 pages of changes");
  }

  /** PUT of the task with title and an optional numeric {@code version}. */
  Response updateV(
      String token, String familyId, String taskId, String mutationId, String title, Long version)
      throws Exception {
    String body =
        "{\"mutationId\":"
            + quote(mutationId)
            + ",\"title\":"
            + quote(title)
            + (version == null ? "" : ",\"version\":" + version)
            + "}";
    return updateRaw(token, familyId, taskId, body);
  }

  /** «Comprare il pane», a shopping list with «latte», «uova», «farina». */
  List3 spesa(User by, String familyId) throws Exception {
    String list = listOk(by.token(), familyId, PANE);
    List<String> items = new ArrayList<>();
    for (String text : SPESA) {
      items.add(addOk(by.token(), familyId, list, text));
    }
    return new List3(list, items);
  }

  // ---------------------------------------------------------------- reads

  static long number(Object value) {
    assertThat(value).as("number").isInstanceOf(Number.class);
    return ((Number) value).longValue();
  }

  /** The rows of an entity among the changes. */
  static List<Map<String, Object>> rowsOf(List<Map<String, Object>> changes, String entityId) {
    return changes.stream().filter(c -> entityId.equals(c.get("entityId"))).toList();
  }

  /** The only row of an entity among the changes. */
  static Map<String, Object> rowOf(List<Map<String, Object>> changes, String entityId) {
    List<Map<String, Object>> rows = rowsOf(changes, entityId);
    assertThat(rows).as("rows of " + entityId + " in " + changes).hasSize(1);
    return rows.get(0);
  }

  @SuppressWarnings("unchecked")
  static Map<String, Object> data(Map<String, Object> row) {
    assertThat(row).as("change row").containsKey("data");
    assertThat(row.get("data")).as("data of " + row).isInstanceOf(Map.class);
    return (Map<String, Object>) row.get("data");
  }

  static void assertUpsert(Map<String, Object> row, String entity) {
    assertThat(row).as("change row").containsEntry("entity", entity).containsEntry("op", "UPSERT");
    assertThat(row.get("deletedAt")).as("deletedAt of " + row).isNull();
    data(row);
  }

  static void assertDeletion(Map<String, Object> row, String entity) {
    assertThat(row).as("change row").containsEntry("entity", entity).containsEntry("op", "DELETE");
    assertThat(row).containsKey("data");
    assertThat(row.get("data")).as("data of " + row).isNull();
    assertThat(row.get("deletedAt")).as("deletedAt of " + row).isNotNull();
  }

  static List<Map<String, Object>> all(List<Page> pages) {
    return pages.stream().flatMap(p -> p.changes().stream()).toList();
  }

  @SuppressWarnings("unchecked")
  static List<Map<String, Object>> list(Map<String, Object> body, String key) {
    assertThat(body.get(key)).as(key).isInstanceOf(List.class);
    return (List<Map<String, Object>>) body.get(key);
  }

  /** The raw change_log seqs of a family after {@code after}, in order. */
  List<Long> rawSeqs(String familyId, long after) {
    return jdbc.queryForList(
        "select seq from change_log where family_id = ?::uuid and seq > ? order by seq",
        Long.class,
        familyId,
        after);
  }
}
