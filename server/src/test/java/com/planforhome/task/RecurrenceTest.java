package com.planforhome.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class RecurrenceTest {

  static final ZoneId ROME = ZoneId.of("Europe/Rome");
  static final Instant FAR_PAST = Instant.parse("2000-01-01T00:00:00Z");

  static Recurrence rule(String json) {
    return Recurrence.fromRequest(JsonMapper.builder().build().readTree(json));
  }

  static LocalDate day(Recurrence r, String previous) {
    Instant due = LocalDate.parse(previous).atStartOfDay(ROME).toInstant();
    return r.next(due, true, ROME, FAR_PAST).atZone(ROME).toLocalDate();
  }

  @Test
  void dailyAndEveryNDays() {
    assertThat(day(rule("{\"type\":\"DAILY\"}"), "2031-02-28")).isEqualTo("2031-03-01");
    assertThat(day(rule("{\"type\":\"EVERY_N_DAYS\",\"interval\":3}"), "2031-01-07"))
        .isEqualTo("2031-01-10");
  }

  @Test
  void weeklySkipsToTheNextListedDay() {
    Recurrence r = rule("{\"type\":\"WEEKLY\",\"days\":[\"FRIDAY\",\"TUESDAY\"]}");
    assertThat(day(r, "2031-01-07")).isEqualTo("2031-01-10");
    assertThat(day(r, "2031-01-10")).isEqualTo("2031-01-14");
    assertThat(r.toJson()).isEqualTo("{\"type\":\"WEEKLY\",\"days\":[\"TUESDAY\",\"FRIDAY\"]}");
  }

  @Test
  void monthlyThirtyFirstClampsToTheEndOfTheMonth() {
    Recurrence r = rule("{\"type\":\"MONTHLY\",\"dayOfMonth\":31}");
    assertThat(day(r, "2031-01-31")).isEqualTo("2031-02-28");
    assertThat(day(r, "2031-02-28")).isEqualTo("2031-03-31");
    assertThat(day(r, "2031-03-31")).isEqualTo("2031-04-30");
    assertThat(day(r, "2032-01-31")).isEqualTo("2032-02-29");
  }

  @Test
  void lostDatesAreSkippedButTodayCounts() {
    Recurrence r = rule("{\"type\":\"DAILY\"}");
    Instant due = LocalDate.parse("2031-01-07").atStartOfDay(ROME).toInstant();
    Instant now = Instant.parse("2031-01-12T08:00:00Z");
    assertThat(r.next(due, true, ROME, now).atZone(ROME).toLocalDate()).isEqualTo("2031-01-12");
  }

  @Test
  void springGapAndAutumnOverlapKeepTheStoredLocalTime() {
    Recurrence r = rule("{\"type\":\"DAILY\"}").withTime(LocalTime.of(2, 30));
    Instant first = Instant.parse("2031-03-29T01:30:00Z");
    Instant second = r.next(first, false, ROME, first);
    assertThat(second).isEqualTo("2031-03-30T01:30:00Z"); // 03:30 CEST, the 02:30 does not exist
    assertThat(r.next(second, false, ROME, second)).isEqualTo("2031-03-31T00:30:00Z");
    Instant autumn = Instant.parse("2031-10-25T00:30:00Z");
    assertThat(r.next(autumn, false, ROME, autumn)).isEqualTo("2031-10-26T00:30:00Z");
  }

  @Test
  void sevenOClockStaysSevenAcrossTheClockChanges() {
    Recurrence r = rule("{\"type\":\"DAILY\"}").withTime(LocalTime.of(7, 0));
    Instant march = Instant.parse("2031-03-29T06:00:00Z");
    assertThat(r.next(march, false, ROME, march)).isEqualTo("2031-03-30T05:00:00Z");
    Instant october = Instant.parse("2031-10-25T05:00:00Z");
    assertThat(r.next(october, false, ROME, october)).isEqualTo("2031-10-26T06:00:00Z");
    Instant lost = Instant.parse("2031-10-27T06:00:00Z");
    assertThat(r.next(lost, false, ROME, Instant.parse("2031-10-29T07:00:00Z")))
        .isEqualTo("2031-10-30T06:00:00Z");
  }

  @Test
  void malformedRulesAreInvalid() {
    for (String json :
        new String[] {
          "{}",
          "[]",
          "\"DAILY\"",
          "{\"type\":\"DAILY\",\"time\":\"07:00\"}",
          "{\"type\":\"DAILY\",\"interval\":2}",
          "{\"type\":\"EVERY_N_DAYS\",\"interval\":1}",
          "{\"type\":\"WEEKLY\",\"days\":[\"MONDAY\",\"MONDAY\"]}",
          "{\"type\":\"MONTHLY\",\"dayOfMonth\":0}"
        }) {
      assertThatThrownBy(() -> rule(json)).as(json).isInstanceOf(Recurrence.Invalid.class);
    }
  }
}
