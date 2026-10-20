package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

/**
 * Round 011, T5 part 3: what the acceptance tests of done, reopen, edit and cancel (P7 to P9)
 * share. The people have the names of Appendix A, but every test registers its own accounts and its
 * own families (as in round 008): the demo families are never written. Famiglia Mamma (Europe/
 * Rome): Anna manager; Paolo, Luca and Davide members; Nina a resource without account, referent
 * Luca.
 */
abstract class Giro011AcceptanceSupport extends Giro008AcceptanceSupport {

  static final String PANE = "Comprare il pane";
  static final String PISCINA = "Portare Nina in piscina";
  static final String BOLLETTA = "Pagare la bolletta della luce";
  static final String PIANTE = "Annaffiare le piante";
  static final String LATTE = "Comprare il latte";

  record Mamma(String id, User anna, User paolo, User luca, User davide, String nina) {}

  Mamma mamma() throws Exception {
    User anna = founder("Anna", MAMMA);
    String m = anna.familyId();
    User paolo = withCode("Paolo", invite(anna.token(), m));
    User luca = withCode("Luca", invite(anna.token(), m));
    User davide = withCode("Davide", invite(anna.token(), m));
    String nina = resourceOk(anna.token(), m, "Nina", luca.personId());
    return new Mamma(m, anna, paolo, luca, davide, nina);
  }

  /** «Comprare il pane»: created by Paolo, assigned to Paolo. */
  String pane(Mamma m) throws Exception {
    return taskOk(m.paolo().token(), m.id(), PANE, m.paolo().personId());
  }

  /** «Portare Nina in piscina»: created by Anna, assigned to Nina (referent Luca). */
  String piscina(Mamma m) throws Exception {
    return taskOk(m.anna().token(), m.id(), PISCINA, m.nina());
  }

  /** «Pagare la bolletta della luce»: created by Anna, in the queue. */
  String bolletta(Mamma m) throws Exception {
    return taskOk(m.anna().token(), m.id(), BOLLETTA);
  }

  /** «Annaffiare le piante»: created by Davide, assigned to Davide. */
  String piante(Mamma m) throws Exception {
    return taskOk(m.davide().token(), m.id(), PIANTE, m.davide().personId());
  }

  // ---------------------------------------------------------------- the endpoints of the round

  private static String path(String familyId, String taskId) {
    return "/api/families/" + familyId + "/tasks/" + taskId;
  }

  Response done(String token, String familyId, String taskId, String mutationId) throws Exception {
    return send("POST", path(familyId, taskId) + "/done", token, body(mutationId));
  }

  Response done(String token, String familyId, String taskId) throws Exception {
    return done(token, familyId, taskId, id());
  }

  Response reopen(String token, String familyId, String taskId, String mutationId)
      throws Exception {
    return send("POST", path(familyId, taskId) + "/reopen", token, body(mutationId));
  }

  Response reopen(String token, String familyId, String taskId) throws Exception {
    return reopen(token, familyId, taskId, id());
  }

  Response cancel(String token, String familyId, String taskId, String mutationId)
      throws Exception {
    return send("POST", path(familyId, taskId) + "/cancel", token, body(mutationId));
  }

  Response cancel(String token, String familyId, String taskId) throws Exception {
    return cancel(token, familyId, taskId, id());
  }

  /** PUT of the whole task: {@code mutationId} first (left out when null), then the fields. */
  Response update(String token, String familyId, String taskId, String mutationId, Object... fields)
      throws Exception {
    return send("PUT", path(familyId, taskId), token, body(mutationId, fields));
  }

  Response updateRaw(String token, String familyId, String taskId, String rawBody)
      throws Exception {
    return send("PUT", path(familyId, taskId), token, rawBody);
  }

  // ---------------------------------------------------------------- checks

  static void assertOk(Response response) {
    assertThat(response.status()).as(response.body()).isEqualTo(200);
  }

  /** The applied_mutation rows of an entity. */
  int appliedMutations(String entityId) {
    Integer count =
        jdbc.queryForObject(
            "select count(*) from applied_mutation where entity_id = ?::uuid",
            Integer.class,
            entityId);
    return count == null ? 0 : count;
  }

  /**
   * The task, as Anna sees it, has this status, this version, as many change_log rows as versions
   * and as many applied_mutation rows as {@code mutations}.
   */
  void assertState(Mamma m, String taskId, String status, long version, int mutations)
      throws Exception {
    Map<String, Object> task = task(m.anna().token(), m.id(), taskId);
    assertThat(task).as(String.valueOf(task)).containsEntry("status", status);
    assertThat(version(task)).as(String.valueOf(task)).isEqualTo(version);
    assertThat(changeLog(taskId)).hasSize((int) version);
    assertThat(appliedMutations(taskId)).isEqualTo(mutations);
  }
}
