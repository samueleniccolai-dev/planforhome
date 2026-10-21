package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

/**
 * Round 019, T8 part 2 (server): what the acceptance tests of «who removes the items» share
 * (contestation 018-a of decision 61). Every test registers its own accounts and families, with the
 * names of Appendix A:
 *
 * <ul>
 *   <li>Famiglia Mamma: Anna and Pietro managers; Giulia, Luca, Paolo and Davide members.
 *   <li>Famiglia Principale: Marco and Giulia managers. Marco is not in Mamma.
 * </ul>
 *
 * <p>The item view gains {@code createdBy} and {@code removedBy}. An item is alive ({@code
 * removedBy} and {@code deletedAt} null), struck by a member ({@code removedBy} set, {@code
 * deletedAt} null) or cancelled ({@code deletedAt} set). Every read of the new columns in the
 * database comes after an assertion on an HTTP answer of the round, so that a missing column never
 * hides the real failure.
 */
abstract class Giro019AcceptanceSupport extends Giro018AcceptanceSupport {

  static final String DOMENICA = "Spesa della domenica";
  static final String NONNA = "Spesa per la nonna";

  record Families(
      String mamma,
      String principale,
      User anna,
      User pietro,
      User giulia,
      User luca,
      User paolo,
      User davide,
      User marco) {}

  Families families() throws Exception {
    User anna = founder("Anna", MAMMA);
    String m = anna.familyId();
    User pietro = withCode("Pietro", invite(anna.token(), m));
    setRoleOk(anna.token(), m, pietro.personId(), "MANAGER");
    User luca = withCode("Luca", invite(anna.token(), m));
    User paolo = withCode("Paolo", invite(anna.token(), m));
    User davide = withCode("Davide", invite(anna.token(), m));
    User giulia = founder("Giulia", PRINCIPALE);
    String p = giulia.familyId();
    User marco = withCode("Marco", invite(giulia.token(), p));
    setRoleOk(giulia.token(), p, marco.personId(), "MANAGER");
    joinOk(giulia, invite(anna.token(), m));
    return new Families(m, p, anna, pietro, giulia, luca, paolo, davide, marco);
  }

  record Sabato(Families f, String list, String latte, String pane, String uova, String mele) {}

  /** «Spesa del sabato» of Luca, in Mamma: Luca adds «Latte», «Pane»; Davide «Uova», «Mele». */
  Sabato sabato() throws Exception {
    Families f = families();
    String list = listOk(f.luca().token(), f.mamma(), SABATO);
    String latte = addOk(f.luca().token(), f.mamma(), list, "Latte");
    String pane = addOk(f.luca().token(), f.mamma(), list, "Pane");
    String uova = addOk(f.davide().token(), f.mamma(), list, "Uova");
    String mele = addOk(f.davide().token(), f.mamma(), list, "Mele");
    return new Sabato(f, list, latte, pane, uova, mele);
  }

  // ---------------------------------------------------------------- the endpoints of the round

  Response remove(String token, String familyId, String taskId, String itemId, String mutationId)
      throws Exception {
    String body = mutationId == null ? "{}" : "{\"mutationId\":" + quote(mutationId) + "}";
    return send("POST", itemsPath(familyId, taskId) + "/" + itemId + "/remove", token, body);
  }

  Response remove(String token, String familyId, String taskId, String itemId) throws Exception {
    return remove(token, familyId, taskId, itemId, id());
  }

  Response restore(String token, String familyId, String taskId, String itemId, String mutationId)
      throws Exception {
    String body = mutationId == null ? "{}" : "{\"mutationId\":" + quote(mutationId) + "}";
    return send("POST", itemsPath(familyId, taskId) + "/" + itemId + "/restore", token, body);
  }

  Response restore(String token, String familyId, String taskId, String itemId) throws Exception {
    return restore(token, familyId, taskId, itemId, id());
  }

  /** The forward of round 016 (here only to move a list between families). */
  Response forwardTo(String token, String familyId, String taskId, String toFamilyId)
      throws Exception {
    return send(
        "POST",
        "/api/families/" + familyId + "/tasks/" + taskId + "/forward",
        token,
        body(id(), "toFamilyId", toFamilyId));
  }

  // ---------------------------------------------------------------- asserts on answers

  /** 200, the item is cancelled by {@code by}: deletedAt set, removedBy = by. */
  static void assertCancelled(Response response, User by) {
    assertThat(response.status()).as("remove: " + response.body()).isEqualTo(200);
    Map<String, Object> item = object(response);
    assertThat(item.get("deletedAt")).as("deletedAt of " + response.body()).isNotNull();
    assertThat(item.get("removedBy")).as("removedBy").isEqualTo(by.personId());
  }

  /** 200, the item is struck by {@code by}: deletedAt null, removedBy = by. */
  static void assertStruck(Response response, User by) {
    assertThat(response.status()).as("remove: " + response.body()).isEqualTo(200);
    Map<String, Object> item = object(response);
    assertThat(item).containsKey("removedBy");
    assertThat(item.get("removedBy")).as("removedBy").isEqualTo(by.personId());
    assertThat(item.get("deletedAt")).as("deletedAt").isNull();
  }

  static Object createdBy(Map<String, Object> item) {
    assertThat(item).as("item view").containsKey("createdBy");
    return item.get("createdBy");
  }

  static Object removedBy(Map<String, Object> item) {
    assertThat(item).as("item view").containsKey("removedBy");
    return item.get("removedBy");
  }

  static List<Object> removers(List<Map<String, Object>> items) {
    return items.stream().map(Giro019AcceptanceSupport::removedBy).toList();
  }

  // ---------------------------------------------------------------- database reads

  /** One row of shopping_item with the new columns (after an HTTP assertion of the round). */
  Map<String, Object> storedItem(String itemId) {
    return jdbc.queryForMap(
        "select id::text as id, checked, version, deleted_at, created_by::text as created_by,"
            + " removed_by::text as removed_by from shopping_item where id = ?::uuid",
        itemId);
  }
}
