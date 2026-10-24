package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Round 013, T6 part 1: «End the series» (P10 of SPEC 5), the checks on the rule (400), the replay
 * and the races of the writes on a recurring task, and the isolation between families. A PUT never
 * changes the rule in this round (part 2): a member cannot end a series by editing it. Context and
 * clock of its own; all the dues are in June 2031, ahead of the clock of this class whatever the
 * order of the tests.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "DEMO_PASSWORD=" + Giro003AcceptanceSupport.DEMO_PASSWORD,
      "planforhome.acceptance.context=giro013-end-series"
    })
@Import(AcceptanceClock.Config.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class Giro013EndSeriesAcceptanceTest extends Giro013AcceptanceSupport {

  private static final int ROUNDS = 10;
  private static final String JUNE_2 = "2031-06-02";

  /** A daily series due 2 June, created by {@code creator}, assigned to {@code assignee}. */
  String daily(User creator, Principale p, String title, String assignee) throws Exception {
    return recurringOk(creator.token(), p.id(), title, "DATE", JUNE_2, DAILY, assignee);
  }

  /** Status and version as Giulia sees them, with as many change_log rows as versions. */
  void assertState(Principale p, String taskId, String status, long version) throws Exception {
    Map<String, Object> task = task(p.giulia().token(), p.id(), taskId);
    assertThat(task).as(String.valueOf(task)).containsEntry("status", status);
    assertThat(version(task)).as(String.valueOf(task)).isEqualTo(version);
    assertThat(changeLog(taskId)).hasSize((int) version);
  }

  // ---------------------------------------------------------------- P10 allowed

  @Test
  @Order(1)
  void case7AManagerEndsASeriesCreatedBySomeoneElse() throws Exception {
    Principale p = principale();
    String cane = daily(p.marco(), p, CANE, p.marco().personId());

    Response ended = endSeries(p.giulia().token(), p.id(), cane);

    assertOk(ended);
    assertThat((String) ended.json("$.status")).isEqualTo("CANCELLED");
    assertThat(version(ended)).isEqualTo(2);
    assertState(p, cane, "CANCELLED", 2);
    assertThat(appliedMutations(cane)).isEqualTo(2);
    assertThat(openInSeries(p.giulia().token(), p.id(), cane)).isEmpty();
    assertThat(series(p.giulia().token(), p.id(), cane)).hasSize(1);
    assertError(done(p.marco().token(), p.id(), cane), 409, "not_open");
    assertThat(series(p.giulia().token(), p.id(), cane)).hasSize(1);
  }

  @Test
  @Order(2)
  void case7AMemberEndsHisSeriesAlsoFromTheSecondOccurrence() throws Exception {
    Principale p = principale();
    String lenzuola = daily(p.paolo(), p, LENZUOLA, p.paolo().personId());

    assertOk(done(p.paolo().token(), p.id(), lenzuola));
    Map<String, Object> second = nextOf(p.giulia().token(), p.id(), lenzuola, lenzuola);
    assertThat(second).containsEntry("createdBy", p.paolo().personId());
    String secondId = (String) second.get("id");

    Response ended = endSeries(p.paolo().token(), p.id(), secondId);

    assertOk(ended);
    assertState(p, secondId, "CANCELLED", 2);
    assertThat(openInSeries(p.giulia().token(), p.id(), lenzuola)).isEmpty();
    assertThat(series(p.giulia().token(), p.id(), lenzuola)).hasSize(2);
  }

  // ---------------------------------------------------------------- P10 refused

  @Test
  @Order(3)
  void case7TheAssigneeDoesNotEndASeriesHeDidNotCreate() throws Exception {
    Principale p = principale();
    String lenzuola = daily(p.paolo(), p, LENZUOLA, null);
    assertOk(setAssignee(p.giulia().token(), p.id(), lenzuola, p.luca().personId()));

    assertError(endSeries(p.luca().token(), p.id(), lenzuola), 403, "forbidden");
    assertState(p, lenzuola, "OPEN", 2);

    // He marks it done (P7): the next occurrence is his, still created by Paolo, and still not his
    // to end.
    assertOk(done(p.luca().token(), p.id(), lenzuola));
    Map<String, Object> second = nextOf(p.giulia().token(), p.id(), lenzuola, lenzuola);
    assertThat(second)
        .containsEntry("createdBy", p.paolo().personId())
        .containsEntry("assigneePersonId", p.luca().personId());
    String secondId = (String) second.get("id");
    assertError(endSeries(p.luca().token(), p.id(), secondId), 403, "forbidden");
    assertState(p, secondId, "OPEN", 1);
  }

  @Test
  @Order(4)
  void aPutNeverChangesTheRuleSoTheAssigneeCannotEndTheSeriesByEditing() throws Exception {
    Principale p = principale();
    String lenzuola = daily(p.paolo(), p, LENZUOLA, null);
    assertOk(setAssignee(p.giulia().token(), p.id(), lenzuola, p.luca().personId()));

    // P9: Luca edits his task; the recurrence he sends is ignored.
    Response edited =
        updateRaw(
            p.luca().token(),
            p.id(),
            lenzuola,
            "{\"mutationId\":"
                + quote(id())
                + ",\"title\":"
                + quote(LENZUOLA + " (matrimoniale)")
                + ",\"dueKind\":\"DATE\",\"due\":\""
                + JUNE_2
                + "\",\"criticality\":\"NORMAL\",\"recurrence\":null}");
    assertOk(edited);
    Map<String, Object> after = task(p.giulia().token(), p.id(), lenzuola);
    assertThat(after.get("title")).isEqualTo(LENZUOLA + " (matrimoniale)");
    assertThat(recurrenceType(after)).isEqualTo("DAILY");
    assertThat(after.get("seriesId")).isEqualTo(lenzuola);

    // Neither a manager changes the rule with a PUT in this round.
    Response weekly =
        updateRaw(
            p.giulia().token(),
            p.id(),
            lenzuola,
            "{\"mutationId\":"
                + quote(id())
                + ",\"title\":"
                + quote(LENZUOLA)
                + ",\"dueKind\":\"DATE\",\"due\":\""
                + JUNE_2
                + "\",\"criticality\":\"NORMAL\","
                + "\"recurrence\":{\"type\":\"WEEKLY\",\"days\":[\"MONDAY\"]}}");
    assertOk(weekly);
    assertThat(recurrenceType(task(p.giulia().token(), p.id(), lenzuola))).isEqualTo("DAILY");

    // The series goes on.
    assertOk(done(p.luca().token(), p.id(), lenzuola));
    assertThat(nextOf(p.giulia().token(), p.id(), lenzuola, lenzuola).get("due"))
        .isEqualTo("2031-06-03");
  }

  // ---------------------------------------------------------------- state errors

  @Test
  @Order(5)
  void endSeriesRefusesATaskThatIsNotRecurringOrNotOpen() throws Exception {
    Principale p = principale();
    String plain = taskOk(p.giulia().token(), p.id(), "Comprare il pane");
    assertError(endSeries(p.giulia().token(), p.id(), plain), 409, "not_recurring");
    assertState(p, plain, "OPEN", 1);

    String cane = daily(p.giulia(), p, CANE, p.giulia().personId());
    assertOk(done(p.giulia().token(), p.id(), cane));
    assertError(endSeries(p.giulia().token(), p.id(), cane), 409, "not_open");
    assertState(p, cane, "DONE", 2);
  }

  // ---------------------------------------------------------------- case 8: rule checks

  @Test
  @Order(6)
  void case8ARecurringTaskNeedsADue() throws Exception {
    Principale p = principale();
    String taskId = id();
    assertError(
        createRecurring(p.giulia().token(), p.id(), taskId, CANE, null, null, DAILY, null),
        400,
        "recurrence_needs_due");
    assertThat(ids(tasks(p.giulia().token(), p.id()))).doesNotContain(taskId);
    assertThat(changeLog(taskId)).isEmpty();

    String cane = daily(p.giulia(), p, CANE, null);
    assertError(
        updateRaw(
            p.giulia().token(),
            p.id(),
            cane,
            "{\"mutationId\":"
                + quote(id())
                + ",\"title\":"
                + quote(CANE)
                + ",\"dueKind\":null,\"due\":null}"),
        400,
        "recurrence_needs_due");
    Map<String, Object> still = task(p.giulia().token(), p.id(), cane);
    assertThat(still).containsEntry("due", JUNE_2);
    assertState(p, cane, "OPEN", 1);
  }

  @Test
  @Order(7)
  void case8AMalformedRuleIsRefusedAndNothingIsCreated() throws Exception {
    Principale p = principale();
    List<String> malformed =
        List.of(
            "{\"type\":\"EVERY_N_DAYS\",\"interval\":1}",
            "{\"type\":\"EVERY_N_DAYS\",\"interval\":366}",
            "{\"type\":\"EVERY_N_DAYS\",\"interval\":\"3\"}",
            "{\"type\":\"EVERY_N_DAYS\"}",
            "{\"type\":\"WEEKLY\",\"days\":[]}",
            "{\"type\":\"WEEKLY\",\"days\":\"TUESDAY\"}",
            "{\"type\":\"WEEKLY\",\"days\":[\"TUESDAY\",\"TUESDAY\"]}",
            "{\"type\":\"WEEKLY\",\"days\":[\"MARTEDI\"]}",
            "{\"type\":\"MONTHLY\",\"dayOfMonth\":32}",
            "{\"type\":\"MONTHLY\",\"dayOfMonth\":0}",
            "{\"type\":\"YEARLY\"}",
            "{\"type\":\"DAILY\",\"interval\":2}",
            "{}",
            "\"DAILY\"",
            "[]");
    for (String rule : malformed) {
      String taskId = id();
      Response refused =
          createRecurring(p.giulia().token(), p.id(), taskId, CANE, "DATE", JUNE_2, rule, null);
      assertThat(refused.status()).as(rule + " -> " + refused.body()).isEqualTo(400);
      assertThat(refused.error()).as(rule).isEqualTo("recurrence_invalid");
      assertThat(changeLog(taskId)).as(rule).isEmpty();
    }
    assertThat(tasks(p.giulia().token(), p.id())).isEmpty();
  }

  @Test
  @Order(8)
  void case8TheRuleIsSavedInItsCanonicalForm() throws Exception {
    Principale p = principale();
    String frigo =
        recurringOk(
            p.giulia().token(),
            p.id(),
            FRIGO,
            "DATE",
            JUNE_2,
            "{\"days\":[\"FRIDAY\",\"TUESDAY\"],\"type\":\"WEEKLY\"}",
            null);
    Map<?, ?> rule = rule(task(p.giulia().token(), p.id(), frigo));
    assertThat(strings(List.copyOf(rule.keySet()))).containsExactlyInAnyOrder("type", "days");
    assertThat(rule.get("type")).isEqualTo("WEEKLY");
    assertThat(strings(rule.get("days"))).containsExactlyInAnyOrder("TUESDAY", "FRIDAY");

    String plain = recurringOk(p.giulia().token(), p.id(), CANE, "DATE", JUNE_2, "null", null);
    Map<String, Object> notRecurring = task(p.giulia().token(), p.id(), plain);
    assertThat(notRecurring).containsKey("recurrence").containsKey("seriesId");
    assertThat(notRecurring.get("recurrence")).isNull();
    assertThat(notRecurring.get("seriesId")).isNull();
  }

  // ---------------------------------------------------------------- case 10: replay and races

  @Test
  @Order(9)
  void case10ADoneRepeatedWithTheSameMutationIdCreatesOneNextOccurrence() throws Exception {
    Principale p = principale();
    String cane = daily(p.giulia(), p, CANE, p.marco().personId());
    String mutation = id();

    assertOk(done(p.marco().token(), p.id(), cane, mutation));
    assertOk(done(p.marco().token(), p.id(), cane, mutation));
    assertOk(done(p.marco().token(), p.id(), cane, mutation));

    assertThat(series(p.giulia().token(), p.id(), cane)).hasSize(2);
    nextOf(p.giulia().token(), p.id(), cane, cane);
    assertState(p, cane, "DONE", 2);
  }

  @Test
  @Order(10)
  void case10EndSeriesRepeatedWithTheSameMutationIdIsAReplay() throws Exception {
    Principale p = principale();
    String cane = daily(p.giulia(), p, CANE, null);
    String mutation = id();

    assertOk(endSeries(p.giulia().token(), p.id(), cane, mutation));
    Response again = endSeries(p.giulia().token(), p.id(), cane, mutation);

    assertOk(again);
    assertThat((String) again.json("$.status")).isEqualTo("CANCELLED");
    assertThat(version(again)).isEqualTo(2);
    assertState(p, cane, "CANCELLED", 2);
    assertThat(appliedMutations(cane)).isEqualTo(2);
  }

  @Test
  @Order(11)
  void case10TwoDoneTogetherCreateOneNextOccurrence() throws Exception {
    Principale p = principale();
    for (int round = 0; round < ROUNDS; round++) {
      String cane = daily(p.giulia(), p, CANE, p.marco().personId());

      List<Response> answers =
          together(
              () -> done(p.giulia().token(), p.id(), cane),
              () -> done(p.marco().token(), p.id(), cane));

      assertThat(statuses(answers)).as("round " + round).containsExactlyInAnyOrder(200, 409);
      Response lost = answers.get(0).status() == 409 ? answers.get(0) : answers.get(1);
      assertThat(lost.error()).isEqualTo("not_open");
      assertThat(series(p.giulia().token(), p.id(), cane)).as("round " + round).hasSize(2);
      nextOf(p.giulia().token(), p.id(), cane, cane);
      assertState(p, cane, "DONE", 2);
    }
  }

  @Test
  @Order(12)
  void case10EndSeriesAndDoneTogetherNeverBothApply() throws Exception {
    Principale p = principale();
    for (int round = 0; round < ROUNDS; round++) {
      String cane = daily(p.giulia(), p, CANE, p.marco().personId());

      List<Response> answers =
          together(
              () -> endSeries(p.giulia().token(), p.id(), cane),
              () -> done(p.marco().token(), p.id(), cane));

      assertThat(statuses(answers)).as("round " + round).containsExactlyInAnyOrder(200, 409);
      Response lost = answers.get(0).status() == 409 ? answers.get(0) : answers.get(1);
      assertThat(lost.error()).isEqualTo("not_open");
      boolean endedFirst = answers.get(0).status() == 200;
      if (endedFirst) {
        assertState(p, cane, "CANCELLED", 2);
        assertThat(series(p.giulia().token(), p.id(), cane)).hasSize(1);
        assertThat(openInSeries(p.giulia().token(), p.id(), cane)).isEmpty();
      } else {
        assertState(p, cane, "DONE", 2);
        assertThat(series(p.giulia().token(), p.id(), cane)).hasSize(2);
        nextOf(p.giulia().token(), p.id(), cane, cane);
      }
    }
  }

  // ---------------------------------------------------------------- case 11: isolation

  @Test
  @Order(13)
  void case11RosaCannotEndASeriesOfAnotherFamily() throws Exception {
    Principale p = principale();
    String cane = daily(p.giulia(), p, CANE, null);
    User rosa = founder("Rosa", BABBO);

    Response viaPrincipale = endSeries(rosa.token(), p.id(), cane);
    Response viaBabbo = endSeries(rosa.token(), rosa.familyId(), cane);
    Response unknown = endSeries(rosa.token(), rosa.familyId(), id());

    assertError(viaPrincipale, 404, "not_found");
    assertError(viaBabbo, 404, "not_found");
    assertError(unknown, 404, "not_found");
    assertThat(viaBabbo.body()).isEqualTo(unknown.body());
    assertState(p, cane, "OPEN", 1);
    assertThat(appliedMutations(cane)).isEqualTo(1);
  }

  @Test
  @Order(14)
  void case11ATaskOfMammaIsNotFoundThroughTheUrlOfPrincipale() throws Exception {
    Principale p = principale();
    User anna = founder("Anna", MAMMA);
    joinOk(p.giulia(), invite(anna.token(), anna.familyId()));
    String mammaTask =
        recurringOk(anna.token(), anna.familyId(), CANE, "DATE", JUNE_2, DAILY, anna.personId());

    // Giulia is in both families: the task of Mamma under the URL of Principale does not exist.
    Response crossed = endSeries(p.giulia().token(), p.id(), mammaTask);
    Response unknown = endSeries(p.giulia().token(), p.id(), id());

    assertError(crossed, 404, "not_found");
    assertError(unknown, 404, "not_found");
    assertThat(crossed.body()).isEqualTo(unknown.body());
    Map<String, Object> untouched = task(anna.token(), anna.familyId(), mammaTask);
    assertThat(untouched).containsEntry("status", "OPEN");
    assertThat(version(untouched)).isEqualTo(1L);
    assertThat(changeLog(mammaTask)).hasSize(1);
  }

  @Test
  @Order(15)
  void case11ARecurringTaskIsNotCreatedInAFamilyOfOthers() throws Exception {
    Principale p = principale();
    User rosa = founder("Rosa", BABBO);
    String taskId = id();

    Response refused =
        createRecurring(rosa.token(), p.id(), taskId, CANE, "DATE", JUNE_2, DAILY, null);

    assertError(refused, 404, "not_found");
    assertThat(ids(tasks(p.giulia().token(), p.id()))).doesNotContain(taskId);
    assertThat(changeLog(taskId)).isEmpty();
  }
}
