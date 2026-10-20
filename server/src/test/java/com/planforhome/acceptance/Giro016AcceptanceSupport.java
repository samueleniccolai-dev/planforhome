package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Round 016, T7: what the acceptance tests of the forward of a task between families share. The
 * people have the names of Appendix A, but every test registers its own accounts and families (as
 * in rounds 008 to 014): the demo families are never written.
 *
 * <ul>
 *   <li>Famiglia Principale (Europe/Rome): Giulia and Marco managers; Leo a resource without
 *       account, referent Giulia.
 *   <li>Famiglia Mamma (Europe/Rome): Anna manager; Giulia and Luca members.
 *   <li>Famiglia Babbo (Europe/Rome): Rosa manager; Marco member.
 * </ul>
 *
 * <p>The only reads that are not HTTP are {@code task}, {@code task_event}, {@code change_log} and
 * {@code applied_mutation}: the history of a task has no API in this round (out of scope). Every
 * read of {@code task_event} comes after an assertion on a forward answered 200, so that a missing
 * table never hides the real failure.
 */
abstract class Giro016AcceptanceSupport extends Giro013AcceptanceSupport {

  static final String FOTO = "Ritirare le foto";
  static final String REGALO = "Comprare il regalo per la nonna";
  static final String DENTISTA = "Portare Leo dal dentista";
  static final String SIEPE = "Tagliare la siepe";
  static final String CARTA = "Mettere fuori la carta";
  static final String DOCUMENTO = "Rinnovare la carta d'identità di Franco";
  static final String PRANZO = "Prenotare il pranzo di Natale";

  static final String TUESDAYS = "{\"type\":\"WEEKLY\",\"days\":[\"TUESDAY\"]}";

  record World(
      String principale,
      String mamma,
      String babbo,
      User giulia,
      User marco,
      User anna,
      User luca,
      User rosa,
      String leo) {}

  World world() throws Exception {
    User giulia = founder("Giulia", PRINCIPALE);
    String p = giulia.familyId();
    User marco = withCode("Marco", invite(giulia.token(), p));
    setRoleOk(giulia.token(), p, marco.personId(), "MANAGER");
    String leo = resourceOk(giulia.token(), p, "Leo", giulia.personId());
    User anna = founder("Anna", MAMMA);
    String m = anna.familyId();
    joinOk(giulia, invite(anna.token(), m));
    User luca = withCode("Luca", invite(anna.token(), m));
    User rosa = founder("Rosa", BABBO);
    String b = rosa.familyId();
    joinOk(marco, invite(rosa.token(), b));
    return new World(p, m, b, giulia, marco, anna, luca, rosa, leo);
  }

  /** «Ritirare le foto»: Principale, created by Marco, assigned to Marco. */
  String foto(World w) throws Exception {
    return taskOk(w.marco().token(), w.principale(), FOTO, w.marco().personId());
  }

  // ---------------------------------------------------------------- the endpoint of the round

  static String forwardPath(String familyId, String taskId) {
    return "/api/families/" + familyId + "/tasks/" + taskId + "/forward";
  }

  Response forward(
      String token, String familyId, String taskId, String mutationId, String toFamilyId)
      throws Exception {
    return send(
        "POST", forwardPath(familyId, taskId), token, body(mutationId, "toFamilyId", toFamilyId));
  }

  Response forward(String token, String familyId, String taskId, String toFamilyId)
      throws Exception {
    return forward(token, familyId, taskId, id(), toFamilyId);
  }

  Response forwardRaw(String token, String familyId, String taskId, String rawBody)
      throws Exception {
    return send("POST", forwardPath(familyId, taskId), token, rawBody);
  }

  // ---------------------------------------------------------------- database reads

  /** The task_event rows of a task, in order of {@code at}. */
  List<Map<String, Object>> events(String taskId) {
    return jdbc.queryForList(
        "select type, actor_person_id::text as actor, data->>'fromFamilyId' as from_family,"
            + " data->>'toFamilyId' as to_family, data->>'assigneeKept' as assignee_kept"
            + " from task_event where task_id = ?::uuid order by at",
        taskId);
  }

  /** The family and the version of a task, straight from the table. */
  Map<String, Object> stored(String taskId) {
    return jdbc.queryForMap(
        "select family_id::text as family_id, version, assignee_person_id::text as assignee"
            + " from task where id = ?::uuid",
        taskId);
  }

  Instant storedDueAt(String taskId) {
    Timestamp due =
        jdbc.queryForObject("select due_at from task where id = ?::uuid", Timestamp.class, taskId);
    assertThat(due).as("due_at of " + taskId).isNotNull();
    return due.toInstant();
  }

  int appliedRows(String mutationId) {
    Integer count =
        jdbc.queryForObject(
            "select count(*) from applied_mutation where mutation_id = ?::uuid",
            Integer.class,
            mutationId);
    return count == null ? 0 : count;
  }

  static Map<String, Object> row(String familyId, String op) {
    return Map.of("family_id", familyId, "entity", "task", "op", op);
  }

  /** The task is where it was, with the version it had and as many change_log rows as before. */
  void assertUntouched(String taskId, String familyId, long version, int logRows) {
    Map<String, Object> now = stored(taskId);
    assertThat(now.get("family_id")).as("family of " + taskId).isEqualTo(familyId);
    assertThat(((Number) now.get("version")).longValue()).as("version").isEqualTo(version);
    assertThat(changeLog(taskId)).as("change_log of " + taskId).hasSize(logRows);
  }

  /** A forward answered 200, as the task view after the move. */
  static void assertForwarded(Response response, String toFamilyId, long version) {
    assertThat(response.status()).as("forward: " + response.body()).isEqualTo(200);
    assertThat((String) response.json("$.familyId")).isEqualTo(toFamilyId);
    assertThat(version(response)).as(response.body()).isEqualTo(version);
  }
}
