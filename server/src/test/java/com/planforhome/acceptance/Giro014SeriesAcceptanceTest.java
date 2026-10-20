package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Round 014, T6 part 2 (server side): the two doubts of the review of round 013.
 *
 * <ul>
 *   <li>«End the series» ends the whole series: the occurrence called and every other OPEN
 *       occurrence of the same series in the same family (same {@code family_id} and {@code
 *       series_id}), whatever its due, each with {@code version+1} and one UPSERT in the change
 *       log, in one transaction under the lock of the family. P10 is checked on the occurrence
 *       called only.
 *   <li>A PUT on a recurring task rewrites only the {@code time} of the saved rule from the new
 *       due: DATETIME gives the local time in the zone of the family, DATE removes {@code time}.
 *       The {@code recurrence} in the body of a PUT is still ignored.
 * </ul>
 *
 * <p>Context and clock of its own; the clock stays at {@link AcceptanceClock#START} (Monday 6
 * January 2031, 08:00Z) and every due is later, so the order of the tests does not matter.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "DEMO_PASSWORD=" + Giro003AcceptanceSupport.DEMO_PASSWORD,
      "planforhome.acceptance.context=giro014-series"
    })
@Import(AcceptanceClock.Config.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class Giro014SeriesAcceptanceTest extends Giro013AcceptanceSupport {

  private static final int ROUNDS = 10;
  private static final String JAN_7 = "2031-01-07";

  /** The first Saturday after the start of the clock. */
  private static final String SATURDAY_JAN_11 = "2031-01-11";

  private static final String SATURDAY = "{\"type\":\"WEEKLY\",\"days\":[\"SATURDAY\"]}";

  /** Status and version as {@code token} sees them, with as many change_log rows as versions. */
  void assertState(String token, String familyId, String taskId, String status, long version)
      throws Exception {
    Map<String, Object> task = task(token, familyId, taskId);
    assertThat(task).as(String.valueOf(task)).containsEntry("status", status);
    assertThat(version(task)).as(String.valueOf(task)).isEqualTo(version);
    assertThat(changeLog(taskId)).as("change_log of " + taskId).hasSize((int) version);
  }

  /** The change_log rows of a family, in seq order: seq, entity_id, op. */
  List<Map<String, Object>> familyLog(String familyId) {
    return jdbc.queryForList(
        "select seq, entity_id::text as entity_id, op from change_log"
            + " where family_id = ?::uuid order by seq",
        familyId);
  }

  static long seq(Map<String, Object> row) {
    return ((Number) row.get("seq")).longValue();
  }

  /**
   * The rows the family log gained after {@code before}: exactly one UPSERT for each of {@code
   * ids}, nothing else, all after the last row of {@code before}.
   */
  static void assertNewRows(
      List<Map<String, Object>> before, List<Map<String, Object>> after, String... ids) {
    assertThat(after.subList(0, before.size())).as("rows already there").isEqualTo(before);
    List<Map<String, Object>> added = after.subList(before.size(), after.size());
    assertThat(added.stream().map(r -> (String) r.get("entity_id")).toList())
        .as("new change_log rows of the family: " + added)
        .containsExactlyInAnyOrder(ids);
    assertThat(added).allSatisfy(r -> assertThat(r.get("op")).isEqualTo("UPSERT"));
    long last = before.isEmpty() ? Long.MIN_VALUE : seq(before.get(before.size() - 1));
    assertThat(added).allSatisfy(r -> assertThat(seq(r)).isGreaterThan(last));
  }

  /** PUT of the whole task with a raw due (and an optional raw recurrence, which is ignored). */
  Response put(
      String token,
      String familyId,
      String taskId,
      String title,
      String dueKind,
      String due,
      String recurrenceJson)
      throws Exception {
    return updateRaw(
        token,
        familyId,
        taskId,
        "{\"mutationId\":"
            + quote(id())
            + ",\"title\":"
            + quote(title)
            + ",\"dueKind\":"
            + quote(dueKind)
            + ",\"due\":"
            + quote(due)
            + ",\"criticality\":\"NORMAL\""
            + (recurrenceJson == null ? "" : ",\"recurrence\":" + recurrenceJson)
            + "}");
  }

  /** A DAILY series of Marco due 7 January, done and reopened: returns the next occurrence id. */
  String doneAndReopened(Principale p, String cane) throws Exception {
    assertOk(done(p.marco().token(), p.id(), cane));
    String next = (String) nextOf(p.giulia().token(), p.id(), cane, cane).get("id");
    assertOk(reopen(p.marco().token(), p.id(), cane));
    assertState(p.giulia().token(), p.id(), cane, "OPEN", 3);
    assertState(p.giulia().token(), p.id(), next, "OPEN", 1);
    return next;
  }

  // ---------------------------------------------------------------- S1: end-series after a reopen

  @Test
  @Order(1)
  void s1EndSeriesOnAReopenedOccurrenceAlsoCancelsTheNextOne() throws Exception {
    Principale p = principale();
    String cane = recurringOk(p.marco().token(), p.id(), CANE, "DATE", JAN_7, DAILY, null);
    String next = doneAndReopened(p, cane);
    assertThat(task(p.giulia().token(), p.id(), next)).containsEntry("due", "2031-01-08");
    List<Map<String, Object>> before = familyLog(p.id());
    String mutation = id();

    Response ended = endSeries(p.marco().token(), p.id(), cane, mutation);

    assertOk(ended);
    assertThat((String) ended.json("$.id")).isEqualTo(cane);
    assertThat((String) ended.json("$.status")).isEqualTo("CANCELLED");
    assertState(p.giulia().token(), p.id(), cane, "CANCELLED", 4);
    assertState(p.giulia().token(), p.id(), next, "CANCELLED", 2);
    assertThat(openInSeries(p.giulia().token(), p.id(), cane)).isEmpty();
    assertThat(series(p.giulia().token(), p.id(), cane)).hasSize(2);
    List<Map<String, Object>> after = familyLog(p.id());
    assertNewRows(before, after, cane, next);

    // Nothing is left to mark done, and no new occurrence appears.
    assertError(done(p.marco().token(), p.id(), next), 409, "not_open");
    assertError(done(p.marco().token(), p.id(), cane), 409, "not_open");
    assertThat(series(p.giulia().token(), p.id(), cane)).hasSize(2);

    // A replay of the same mutation changes nothing.
    Response again = endSeries(p.marco().token(), p.id(), cane, mutation);
    assertOk(again);
    assertThat((String) again.json("$.status")).isEqualTo("CANCELLED");
    assertThat(version(again)).isEqualTo(4);
    assertState(p.giulia().token(), p.id(), cane, "CANCELLED", 4);
    assertState(p.giulia().token(), p.id(), next, "CANCELLED", 2);
    assertThat(familyLog(p.id())).isEqualTo(after);
  }

  @Test
  @Order(2)
  void s1EndSeriesOnTheNextOccurrenceAlsoCancelsTheReopenedOne() throws Exception {
    Principale p = principale();
    String cane = recurringOk(p.marco().token(), p.id(), CANE, "DATE", JAN_7, DAILY, null);
    String next = doneAndReopened(p, cane);
    List<Map<String, Object>> before = familyLog(p.id());

    assertOk(endSeries(p.marco().token(), p.id(), next));

    assertState(p.giulia().token(), p.id(), next, "CANCELLED", 2);
    assertState(p.giulia().token(), p.id(), cane, "CANCELLED", 4);
    assertThat(openInSeries(p.giulia().token(), p.id(), cane)).isEmpty();
    assertNewRows(before, familyLog(p.id()), cane, next);
  }

  @Test
  @Order(3)
  void s1EndSeriesStillCancelsANextOccurrenceMovedBeforeTheFirst() throws Exception {
    Principale p = principale();
    String cane = recurringOk(p.marco().token(), p.id(), CANE, "DATE", "2031-01-20", DAILY, null);
    assertOk(done(p.marco().token(), p.id(), cane));
    String next = (String) nextOf(p.giulia().token(), p.id(), cane, cane).get("id");
    assertOk(reopen(p.marco().token(), p.id(), cane));
    // The next occurrence is moved before the first one: the series ends all the same.
    assertOk(put(p.marco().token(), p.id(), next, CANE, "DATE", "2031-01-10", null));
    assertState(p.giulia().token(), p.id(), next, "OPEN", 2);

    assertOk(endSeries(p.marco().token(), p.id(), cane));

    assertState(p.giulia().token(), p.id(), cane, "CANCELLED", 4);
    assertState(p.giulia().token(), p.id(), next, "CANCELLED", 3);
    assertThat(openInSeries(p.giulia().token(), p.id(), cane)).isEmpty();
  }

  // ---------------------------------------------------------------- S2: P10 with the cascade

  @Test
  @Order(4)
  void s2TheAssigneeCannotEndTheSeriesAndNothingChangesTheCreatorCan() throws Exception {
    Principale p = principale();
    String lenzuola =
        recurringOk(p.paolo().token(), p.id(), LENZUOLA, "DATE", SATURDAY_JAN_11, SATURDAY, null);
    assertOk(setAssignee(p.giulia().token(), p.id(), lenzuola, p.luca().personId()));
    assertOk(done(p.giulia().token(), p.id(), lenzuola));
    Map<String, Object> second = nextOf(p.giulia().token(), p.id(), lenzuola, lenzuola);
    assertThat(second)
        .containsEntry("due", "2031-01-18")
        .containsEntry("assigneePersonId", p.luca().personId())
        .containsEntry("createdBy", p.paolo().personId());
    String secondId = (String) second.get("id");
    assertOk(reopen(p.giulia().token(), p.id(), lenzuola));
    assertState(p.giulia().token(), p.id(), lenzuola, "OPEN", 4);
    List<Map<String, Object>> before = familyLog(p.id());

    // Luca is the assignee, not a manager nor the creator (P10): refused, nothing changes.
    assertError(endSeries(p.luca().token(), p.id(), lenzuola), 403, "forbidden");
    assertError(endSeries(p.luca().token(), p.id(), secondId), 403, "forbidden");
    assertState(p.giulia().token(), p.id(), lenzuola, "OPEN", 4);
    assertState(p.giulia().token(), p.id(), secondId, "OPEN", 1);
    assertThat(familyLog(p.id())).isEqualTo(before);

    // Paolo created the series: both occurrences end.
    assertOk(endSeries(p.paolo().token(), p.id(), lenzuola));
    assertState(p.giulia().token(), p.id(), lenzuola, "CANCELLED", 5);
    assertState(p.giulia().token(), p.id(), secondId, "CANCELLED", 2);
    assertThat(openInSeries(p.giulia().token(), p.id(), lenzuola)).isEmpty();
    assertNewRows(before, familyLog(p.id()), lenzuola, secondId);
  }

  // ---------------------------------------------------------------- S3: concurrency

  @Test
  @Order(5)
  void s3EndSeriesAndDoneOnTheNextOccurrenceTogetherLeaveNothingOpen() throws Exception {
    Principale p = principale();
    for (int round = 0; round < ROUNDS; round++) {
      String cane = recurringOk(p.marco().token(), p.id(), CANE, "DATE", JAN_7, DAILY, null);
      String next = doneAndReopened(p, cane);

      List<Response> answers =
          together(
              () -> endSeries(p.giulia().token(), p.id(), cane),
              () -> done(p.marco().token(), p.id(), next));

      assertThat(answers.get(0).status()).as("round " + round + " end-series").isEqualTo(200);
      assertThat(answers.get(1).status()).as("round " + round + " done").isIn(200, 409);
      if (answers.get(1).status() == 409) {
        assertThat(answers.get(1).error()).isEqualTo("not_open");
      }
      assertThat(openInSeries(p.giulia().token(), p.id(), cane)).as("round " + round).isEmpty();
      for (Map<String, Object> occurrence : series(p.giulia().token(), p.id(), cane)) {
        String occurrenceId = (String) occurrence.get("id");
        assertThat(changeLog(occurrenceId)).hasSize((int) version(occurrence));
      }
    }
  }

  // ---------------------------------------------------------------- S4: a PUT moves the time

  @Test
  @Order(6)
  void s4APutThatMovesTheTimeRewritesTheTimeOfTheRule() throws Exception {
    Principale p = principale();
    String gatto =
        recurringOk(
            p.giulia().token(),
            p.id(),
            GATTO,
            "DATETIME",
            "2031-01-07T06:00:00Z",
            DAILY,
            p.giulia().personId());
    assertThat(rule(task(p.giulia().token(), p.id(), gatto)).get("time")).isEqualTo("07:00");

    assertOk(
        put(p.giulia().token(), p.id(), gatto, GATTO, "DATETIME", "2031-01-07T17:30:00Z", null));

    Map<?, ?> moved = rule(task(p.giulia().token(), p.id(), gatto));
    assertThat(moved.get("type")).isEqualTo("DAILY");
    assertThat(moved.get("time")).isEqualTo("18:30");
    assertOk(done(p.giulia().token(), p.id(), gatto));
    Map<String, Object> next = nextOf(p.giulia().token(), p.id(), gatto, gatto);
    assertThat(dueInstant(next)).isEqualTo(Instant.parse("2031-01-08T17:30:00Z"));
    assertThat(rule(next).get("time")).isEqualTo("18:30");
  }

  @Test
  @Order(7)
  void s4APutFromDatetimeToDateRemovesTheTime() throws Exception {
    Principale p = principale();
    String gatto =
        recurringOk(
            p.giulia().token(), p.id(), GATTO, "DATETIME", "2031-01-07T06:00:00Z", DAILY, null);

    assertOk(put(p.giulia().token(), p.id(), gatto, GATTO, "DATE", JAN_7, null));

    Map<?, ?> rule = rule(task(p.giulia().token(), p.id(), gatto));
    assertThat(rule.get("type")).isEqualTo("DAILY");
    assertThat(rule.containsKey("time")).as("recurrence without time: " + rule).isFalse();
    assertOk(done(p.giulia().token(), p.id(), gatto));
    Map<String, Object> next = nextOf(p.giulia().token(), p.id(), gatto, gatto);
    assertThat(next).containsEntry("dueKind", "DATE").containsEntry("due", "2031-01-08");
    assertThat(rule(next).containsKey("time")).as("recurrence without time: " + next).isFalse();
  }

  @Test
  @Order(8)
  void s4APutFromDateToDatetimeAddsTheTime() throws Exception {
    Principale p = principale();
    String cane = recurringOk(p.giulia().token(), p.id(), CANE, "DATE", JAN_7, DAILY, null);
    assertThat(rule(task(p.giulia().token(), p.id(), cane)).containsKey("time")).isFalse();

    assertOk(put(p.giulia().token(), p.id(), cane, CANE, "DATETIME", "2031-01-07T06:00:00Z", null));

    Map<?, ?> rule = rule(task(p.giulia().token(), p.id(), cane));
    assertThat(rule.get("type")).isEqualTo("DAILY");
    assertThat(rule.get("time")).isEqualTo("07:00");
    assertOk(done(p.giulia().token(), p.id(), cane));
    Map<String, Object> next = nextOf(p.giulia().token(), p.id(), cane, cane);
    assertThat(dueInstant(next)).isEqualTo(Instant.parse("2031-01-08T06:00:00Z"));
  }

  @Test
  @Order(9)
  void s4TheRecurrenceInThePutBodyIsStillIgnored() throws Exception {
    Principale p = principale();
    String gatto =
        recurringOk(
            p.giulia().token(), p.id(), GATTO, "DATETIME", "2031-01-07T06:00:00Z", DAILY, null);

    assertOk(
        put(
            p.giulia().token(),
            p.id(),
            gatto,
            GATTO,
            "DATETIME",
            "2031-01-07T17:30:00Z",
            "{\"type\":\"WEEKLY\",\"days\":[\"MONDAY\"]}"));

    Map<?, ?> rule = rule(task(p.giulia().token(), p.id(), gatto));
    assertThat(rule.get("type")).isEqualTo("DAILY");
    assertThat(rule.containsKey("days")).isFalse();
    assertThat(rule.get("time")).isEqualTo("18:30");
  }

  // ---------------------------------------------------------------- S5: isolation

  @Test
  @Order(10)
  void s5RosaCannotEndASeriesOfPrincipaleAndTheCascadeStaysInTheFamily() throws Exception {
    Principale p = principale();
    String cane = recurringOk(p.marco().token(), p.id(), CANE, "DATE", JAN_7, DAILY, null);
    String next = doneAndReopened(p, cane);
    User rosa = founder("Rosa", BABBO);
    String babboCane = recurringOk(rosa.token(), rosa.familyId(), CANE, "DATE", JAN_7, DAILY, null);
    List<Map<String, Object>> before = familyLog(p.id());

    Response viaPrincipale = endSeries(rosa.token(), p.id(), cane);
    Response viaBabbo = endSeries(rosa.token(), rosa.familyId(), cane);
    Response unknown = endSeries(rosa.token(), rosa.familyId(), id());

    assertError(viaPrincipale, 404, "not_found");
    assertError(viaBabbo, 404, "not_found");
    assertError(unknown, 404, "not_found");
    assertThat(viaPrincipale.body()).isEqualTo(unknown.body());
    assertThat(viaBabbo.body()).isEqualTo(unknown.body());
    assertState(p.giulia().token(), p.id(), cane, "OPEN", 3);
    assertState(p.giulia().token(), p.id(), next, "OPEN", 1);
    assertThat(familyLog(p.id())).isEqualTo(before);

    // Giulia ends the series of Principale: the cascade never reaches Famiglia Babbo.
    List<Map<String, Object>> babboBefore = familyLog(rosa.familyId());
    assertOk(endSeries(p.giulia().token(), p.id(), cane));
    assertState(p.giulia().token(), p.id(), next, "CANCELLED", 2);
    assertState(rosa.token(), rosa.familyId(), babboCane, "OPEN", 1);
    assertThat(familyLog(rosa.familyId())).isEqualTo(babboBefore);
  }
}
