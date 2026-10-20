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
 * Round 013, T6 part 1: the next occurrence of a recurring task (SPEC 2.2.5). Marking done or
 * cancelling «this time» an occurrence creates the next one, in the same series, with the same
 * assignee or in the queue; the date is the first day of the rule after the previous due, in the
 * zone of the family; a DATETIME keeps the local time of the rule across the change of daylight
 * saving time. Context and clock of its own: the tests run in order and only move the clock
 * forward.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "DEMO_PASSWORD=" + Giro003AcceptanceSupport.DEMO_PASSWORD,
      "planforhome.acceptance.context=giro013-recurrence"
    })
@Import(AcceptanceClock.Config.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class Giro013RecurrenceAcceptanceTest extends Giro013AcceptanceSupport {

  // ---------------------------------------------------------------- the four kinds of rule

  @Test
  @Order(1)
  void case1DailyDoneOnTheDayGivesTheNextDayInTheSameSeries() throws Exception {
    at("2031-01-07T08:00:00Z");
    Principale p = principale();
    String cane =
        recurringOk(
            p.giulia().token(), p.id(), CANE, "DATE", "2031-01-07", DAILY, p.marco().personId());

    Map<String, Object> created = task(p.giulia().token(), p.id(), cane);
    assertThat(created.get("seriesId")).isEqualTo(cane);
    assertThat(recurrenceType(created)).isEqualTo("DAILY");

    Response done = done(p.marco().token(), p.id(), cane);
    assertOk(done);
    assertThat((String) done.json("$.status")).isEqualTo("DONE");
    assertThat((String) done.json("$.seriesId")).isEqualTo(cane);

    Map<String, Object> next = nextOf(p.giulia().token(), p.id(), cane, cane);
    assertThat(next.get("id")).isNotEqualTo(cane);
    assertThat((String) next.get("id")).matches(UUID_V7);
    assertThat(next)
        .containsEntry("title", CANE)
        .containsEntry("status", "OPEN")
        .containsEntry("dueKind", "DATE")
        .containsEntry("due", "2031-01-08")
        .containsEntry("assigneePersonId", p.marco().personId())
        .containsEntry("createdBy", p.giulia().personId())
        .containsEntry("completedBy", null);
    assertThat(recurrenceType(next)).isEqualTo("DAILY");
    assertState(p, cane, "DONE", 2);
  }

  @Test
  @Order(2)
  void case3WeeklyTuesdayAndFridayGoesTuesdayFridayTuesday() throws Exception {
    at("2031-01-07T14:00:00Z");
    Principale p = principale();
    String frigo =
        recurringOk(
            p.giulia().token(),
            p.id(),
            FRIGO,
            "DATE",
            "2031-01-07",
            "{\"type\":\"WEEKLY\",\"days\":[\"TUESDAY\",\"FRIDAY\"]}",
            p.giulia().personId());

    assertOk(done(p.giulia().token(), p.id(), frigo));
    Map<String, Object> friday = nextOf(p.giulia().token(), p.id(), frigo, frigo);
    assertThat(friday.get("due")).isEqualTo("2031-01-10");
    Map<?, ?> rule = rule(friday);
    assertThat(rule.get("type")).isEqualTo("WEEKLY");
    assertThat(strings(rule.get("days"))).containsExactlyInAnyOrder("TUESDAY", "FRIDAY");

    String fridayId = (String) friday.get("id");
    assertOk(done(p.giulia().token(), p.id(), fridayId));
    Map<String, Object> tuesday = nextOf(p.giulia().token(), p.id(), frigo, fridayId);
    assertThat(tuesday.get("due")).isEqualTo("2031-01-14");
    assertThat(series(p.giulia().token(), p.id(), frigo)).hasSize(3);
  }

  @Test
  @Order(3)
  void case4MonthlyOnThe31stFallsOnTheLastDayOfShortMonths() throws Exception {
    at("2031-01-07T20:00:00Z");
    Principale p = principale();
    String rule = "{\"type\":\"MONTHLY\",\"dayOfMonth\":31}";
    String affitto =
        recurringOk(
            p.giulia().token(), p.id(), AFFITTO, "DATE", "2031-01-31", rule, p.marco().personId());

    String previous = affitto;
    for (String expected : List.of("2031-02-28", "2031-03-31", "2031-04-30")) {
      assertOk(done(p.marco().token(), p.id(), previous));
      Map<String, Object> next = nextOf(p.giulia().token(), p.id(), affitto, previous);
      assertThat(next.get("due")).as("after " + previous).isEqualTo(expected);
      previous = (String) next.get("id");
    }

    // 2032 is a leap year: 31 January, then 29 February.
    String leap =
        recurringOk(
            p.giulia().token(), p.id(), AFFITTO, "DATE", "2032-01-31", rule, p.marco().personId());
    assertOk(done(p.marco().token(), p.id(), leap));
    assertThat(nextOf(p.giulia().token(), p.id(), leap, leap).get("due")).isEqualTo("2032-02-29");
  }

  @Test
  @Order(4)
  void case2EveryThreeDaysSkipsTheDaysAlreadyPastAndTodayCounts() throws Exception {
    at("2031-01-08T08:00:00Z");
    Principale p = principale();
    String rule = "{\"type\":\"EVERY_N_DAYS\",\"interval\":3}";
    String onTime =
        recurringOk(
            p.giulia().token(), p.id(), PIANTE_3, "DATE", "2031-01-07", rule, p.luca().personId());
    String late =
        recurringOk(
            p.giulia().token(), p.id(), PIANTE_3, "DATE", "2031-01-07", rule, p.luca().personId());
    String today =
        recurringOk(
            p.giulia().token(), p.id(), CANE, "DATE", "2031-01-09", DAILY, p.luca().personId());

    // Done on the 8th: the 10th is still ahead.
    assertOk(done(p.luca().token(), p.id(), onTime));
    assertThat(nextOf(p.giulia().token(), p.id(), onTime, onTime).get("due"))
        .isEqualTo("2031-01-10");

    // Done on the 12th: the 10th is lost, the next is the 13th.
    at("2031-01-12T08:00:00Z");
    assertOk(done(p.luca().token(), p.id(), late));
    assertThat(nextOf(p.giulia().token(), p.id(), late, late).get("due")).isEqualTo("2031-01-13");

    // Daily, due the 9th, done on the 12th: the 10th and 11th are lost, today (the 12th) counts.
    assertOk(done(p.luca().token(), p.id(), today));
    assertThat(nextOf(p.giulia().token(), p.id(), today, today).get("due")).isEqualTo("2031-01-12");
  }

  // ---------------------------------------------------------------- cancel and assignee

  @Test
  @Order(5)
  void case6CancelThisTimeCancelsTheOccurrenceAndCreatesTheNext() throws Exception {
    at("2031-01-13T08:00:00Z");
    Principale p = principale();
    String cane =
        recurringOk(
            p.giulia().token(), p.id(), CANE, "DATE", "2031-01-13", DAILY, p.paolo().personId());

    Response cancelled = cancel(p.giulia().token(), p.id(), cane);
    assertOk(cancelled);
    assertThat((String) cancelled.json("$.status")).isEqualTo("CANCELLED");

    Map<String, Object> next = nextOf(p.giulia().token(), p.id(), cane, cane);
    assertThat(next)
        .containsEntry("due", "2031-01-14")
        .containsEntry("status", "OPEN")
        .containsEntry("assigneePersonId", p.paolo().personId());
    assertState(p, cane, "CANCELLED", 2);
  }

  @Test
  @Order(6)
  void case9TheNextOccurrenceKeepsTheResourceOrTheQueue() throws Exception {
    at("2031-01-13T14:00:00Z");
    Principale p = principale();
    String zaino =
        recurringOk(p.giulia().token(), p.id(), ZAINO, "DATE", "2031-01-13", DAILY, p.leo());
    String queued =
        recurringOk(p.giulia().token(), p.id(), LENZUOLA, "DATE", "2031-01-13", DAILY, null);

    // Giulia is the referent of Leo: she marks his task done.
    assertOk(done(p.giulia().token(), p.id(), zaino));
    assertThat(nextOf(p.giulia().token(), p.id(), zaino, zaino))
        .containsEntry("assigneePersonId", p.leo())
        .containsEntry("due", "2031-01-14");

    assertOk(done(p.marco().token(), p.id(), queued));
    assertThat(nextOf(p.giulia().token(), p.id(), queued, queued))
        .containsEntry("assigneePersonId", null)
        .containsEntry("due", "2031-01-14");
  }

  @Test
  @Order(7)
  void doneThenReopenThenDoneAgainLeavesOneNextOccurrence() throws Exception {
    at("2031-01-14T08:00:00Z");
    Principale p = principale();
    String cane =
        recurringOk(
            p.giulia().token(), p.id(), CANE, "DATE", "2031-01-14", DAILY, p.marco().personId());

    assertOk(done(p.marco().token(), p.id(), cane));
    Map<String, Object> next = nextOf(p.giulia().token(), p.id(), cane, cane);
    assertOk(reopen(p.marco().token(), p.id(), cane));
    assertOk(done(p.marco().token(), p.id(), cane));

    // Still one next occurrence, the same, untouched: version 1, one UPSERT.
    Map<String, Object> still = nextOf(p.giulia().token(), p.id(), cane, cane);
    assertThat(still.get("id")).isEqualTo(next.get("id"));
    assertThat(still.get("due")).isEqualTo("2031-01-15");
    assertThat(openInSeries(p.giulia().token(), p.id(), cane)).hasSize(1);
    assertThat(series(p.giulia().token(), p.id(), cane)).hasSize(2);
    assertState(p, cane, "DONE", 4);
  }

  // ---------------------------------------------------------------- daylight saving time

  @Test
  @Order(8)
  void case5NewYorkKeepsSevenInTheMorningInTheZoneOfTheFamily() throws Exception {
    at("2031-03-08T13:00:00Z");
    User davide = founder("Davide", "Famiglia Davide");
    String zio = createFamilyOk(davide.token(), ZIO, NEW_YORK);
    // 07:00 EST on Saturday 8 March; New York moves to EDT on Sunday 9 March 2031.
    String gatto =
        recurringOk(
            davide.token(),
            zio,
            GATTO,
            "DATETIME",
            "2031-03-08T12:00:00Z",
            DAILY,
            davide.personId());

    assertOk(done(davide.token(), zio, gatto));
    Map<String, Object> next = nextOf(davide.token(), zio, gatto, gatto);
    assertThat(dueInstant(next)).isEqualTo(Instant.parse("2031-03-09T11:00:00Z"));
    assertThat(rule(next).get("time")).isEqualTo("07:00");
  }

  @Test
  @Order(9)
  void halfPastTwoInTheGapOfMarchMovesOnThatDayOnlyAndComesBack() throws Exception {
    at("2031-03-29T00:00:00Z");
    Principale p = principale();
    // 02:30 CET on 29 March; on 30 March 02:30 does not exist in Rome (02:00 -> 03:00).
    String gatto =
        recurringOk(
            p.giulia().token(),
            p.id(),
            GATTO,
            "DATETIME",
            "2031-03-29T01:30:00Z",
            DAILY,
            p.giulia().personId());
    assertThat(rule(task(p.giulia().token(), p.id(), gatto)).get("time")).isEqualTo("02:30");

    assertOk(done(p.giulia().token(), p.id(), gatto));
    Map<String, Object> gap = nextOf(p.giulia().token(), p.id(), gatto, gatto);
    assertThat(dueInstant(gap)).as("03:30 CEST").isEqualTo(Instant.parse("2031-03-30T01:30:00Z"));

    String gapId = (String) gap.get("id");
    assertOk(done(p.giulia().token(), p.id(), gapId));
    Map<String, Object> after = nextOf(p.giulia().token(), p.id(), gatto, gapId);
    assertThat(dueInstant(after)).as("02:30 CEST").isEqualTo(Instant.parse("2031-03-31T00:30:00Z"));
  }

  @Test
  @Order(10)
  void case5RomeKeepsSevenInTheMorningAcrossTheChangeOfMarch() throws Exception {
    at("2031-03-29T07:00:00Z");
    Principale p = principale();
    String gatto =
        recurringOk(
            p.giulia().token(),
            p.id(),
            GATTO,
            "DATETIME",
            "2031-03-29T06:00:00Z",
            DAILY,
            p.marco().personId());

    assertOk(done(p.marco().token(), p.id(), gatto));
    Map<String, Object> next = nextOf(p.giulia().token(), p.id(), gatto, gatto);
    assertThat(dueInstant(next)).as("07:00 CEST").isEqualTo(Instant.parse("2031-03-30T05:00:00Z"));
  }

  @Test
  @Order(11)
  void case5RomeAndNewYorkKeepTheLocalTimeAcrossTheChangeOfAutumn() throws Exception {
    at("2031-10-25T06:00:00Z");
    Principale p = principale();
    // 07:00 CEST on 25 October; Rome goes back to CET on Sunday 26 October 2031.
    String gatto =
        recurringOk(
            p.giulia().token(),
            p.id(),
            GATTO,
            "DATETIME",
            "2031-10-25T05:00:00Z",
            DAILY,
            p.marco().personId());
    assertOk(done(p.marco().token(), p.id(), gatto));
    assertThat(dueInstant(nextOf(p.giulia().token(), p.id(), gatto, gatto)))
        .as("07:00 CET")
        .isEqualTo(Instant.parse("2031-10-26T06:00:00Z"));

    // 02:30 happens twice in Rome on 26 October: the earlier offset (CEST) is kept.
    String twice =
        recurringOk(
            p.giulia().token(),
            p.id(),
            GATTO,
            "DATETIME",
            "2031-10-25T00:30:00Z",
            DAILY,
            p.marco().personId());
    assertOk(done(p.marco().token(), p.id(), twice));
    assertThat(dueInstant(nextOf(p.giulia().token(), p.id(), twice, twice)))
        .as("02:30 CEST, the first of the two")
        .isEqualTo(Instant.parse("2031-10-26T00:30:00Z"));

    // New York goes back to EST on Sunday 2 November 2031.
    User davide = founder("Davide", "Famiglia Davide");
    String zio = createFamilyOk(davide.token(), ZIO, NEW_YORK);
    String ny =
        recurringOk(
            davide.token(),
            zio,
            GATTO,
            "DATETIME",
            "2031-11-01T11:00:00Z",
            DAILY,
            davide.personId());
    assertOk(done(davide.token(), zio, ny));
    assertThat(dueInstant(nextOf(davide.token(), zio, ny, ny)))
        .as("07:00 EST")
        .isEqualTo(Instant.parse("2031-11-02T12:00:00Z"));
  }

  @Test
  @Order(12)
  void aDatetimeSkipsTheInstantsAlreadyPast() throws Exception {
    at("2031-10-27T08:00:00Z");
    Principale p = principale();
    String gatto =
        recurringOk(
            p.giulia().token(),
            p.id(),
            GATTO,
            "DATETIME",
            "2031-10-27T06:00:00Z",
            DAILY,
            p.marco().personId());

    // Done on the 29th at 08:00 Rome time: 28th and 29th at 07:00 are past, the next is the 30th.
    at("2031-10-29T07:00:00Z");
    assertOk(done(p.marco().token(), p.id(), gatto));
    assertThat(dueInstant(nextOf(p.giulia().token(), p.id(), gatto, gatto)))
        .isEqualTo(Instant.parse("2031-10-30T06:00:00Z"));
  }

  // ---------------------------------------------------------------- checks

  static final String UUID_V7 =
      "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

  /** As Giulia sees it: status, version, as many change_log rows as versions. */
  void assertState(Principale p, String taskId, String status, long version) throws Exception {
    Map<String, Object> task = task(p.giulia().token(), p.id(), taskId);
    assertThat(task).as(String.valueOf(task)).containsEntry("status", status);
    assertThat(version(task)).as(String.valueOf(task)).isEqualTo(version);
    assertThat(changeLog(taskId)).hasSize((int) version);
  }
}
