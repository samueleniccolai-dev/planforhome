package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Month;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

/**
 * Round 032, T10 part 2: how the pending rows are computed (SPEC 8), read right after the answer of
 * the write. In the family zone: DATETIME «before» at {@code due - 60 min} and «at due» at {@code
 * due}; DATE at 9:00 and 18:00 local; a resource without account → its referent; a queued task → no
 * «before», «at due» to every manager. Quiet hours {@code [22:00, 07:00)} move to the next 07:00,
 * or to 21:45 of the evening before when 07:00 is strictly after the due. Same task, recipient and
 * instant → one row. An instant not after the clock is not written.
 */
class Giro032ReminderScheduleAcceptanceTest extends Giro032AcceptanceSupport {

  @Test
  void case1DatetimeGivesMarcoOneHourBeforeAndAtDue() throws Exception {
    Homes w = homes();

    String gatto =
        datetimeTask(w.giulia(), w.principale(), GATTO_VET, rome(day, 15, 0), w.marco().personId());

    assertThat(pending(gatto))
        .containsExactlyInAnyOrder(
            slot(w.marco(), rome(day, 14, 0)), slot(w.marco(), rome(day, 15, 0)));
  }

  @Test
  void case2DateGivesGiuliaNineAndSixAndNoDueGivesNothing() throws Exception {
    Homes w = homes();

    String mensa = dateTask(w.giulia(), w.principale(), MENSA, day, w.giulia().personId());
    String foto = taskOk(w.giulia().token(), w.principale(), FOTO, w.giulia().personId());

    assertThat(pending(mensa))
        .containsExactlyInAnyOrder(
            slot(w.giulia(), rome(day, 9, 0)), slot(w.giulia(), rome(day, 18, 0)));
    assertThat(reminders(foto)).as("no due, no reminder").isEmpty();
  }

  @Test
  void case3AResourceWithoutAccountGoesToItsReferent() throws Exception {
    Homes w = homes();

    String zaino = dateTask(w.giulia(), w.principale(), ZAINO, day, w.leo());

    assertThat(pending(zaino))
        .containsExactlyInAnyOrder(
            slot(w.giulia(), rome(day, 9, 0)), slot(w.giulia(), rome(day, 18, 0)));
    assertThat(reminders(zaino)).noneMatch(r -> w.leo().equals(r.get("recipient")));
  }

  @Test
  void case4QuietHoursMoveTo7OrToQuarterTo10TheEveningBefore() throws Exception {
    Homes w = homes();
    String marco = w.marco().personId();
    LocalDate before = day.minusDays(1);

    String at0630 = datetimeTask(w.giulia(), w.principale(), TRENO, rome(day, 6, 30), marco);
    String at0730 = datetimeTask(w.giulia(), w.principale(), TRENO, rome(day, 7, 30), marco);
    String at0700 = datetimeTask(w.giulia(), w.principale(), TRENO, rome(day, 7, 0), marco);
    String at2259 = datetimeTask(w.giulia(), w.principale(), TRENO, rome(day, 22, 59), marco);
    String at2300 = datetimeTask(w.giulia(), w.principale(), TRENO, rome(day, 23, 0), marco);

    assertThat(pending(at0630))
        .as("05:30 and 06:30 both go to 21:45 of the evening before: one row")
        .containsExactly(slot(marco, rome(before, 21, 45)));
    assertThat(pending(at0730))
        .as("06:30 moves to 07:00, not after the due")
        .containsExactlyInAnyOrder(slot(marco, rome(day, 7, 0)), slot(marco, rome(day, 7, 30)));
    assertThat(pending(at0700))
        .as("06:00 moves to 07:00, the due itself: one row")
        .containsExactly(slot(marco, rome(day, 7, 0)));
    assertThat(pending(at2259))
        .as("21:59 stays; 22:59 goes to 21:45")
        .containsExactlyInAnyOrder(slot(marco, rome(day, 21, 45)), slot(marco, rome(day, 21, 59)));
    assertThat(pending(at2300))
        .as("22:00 and 23:00 both go to 21:45: one row")
        .containsExactly(slot(marco, rome(day, 21, 45)));
  }

  @Test
  void case5ChangesOfTheHourInMarchAndOctober() throws Exception {
    Homes w = homes();
    String giulia = w.giulia().personId();
    String marco = w.marco().personId();
    LocalDate march = lastSunday(Month.MARCH);
    LocalDate saturday = march.minusDays(1);
    LocalDate october = lastSunday(Month.OCTOBER);

    String sunday = dateTask(w.giulia(), w.principale(), MENSA, march, giulia);
    String dayBefore = dateTask(w.giulia(), w.principale(), MENSA, saturday, giulia);
    String autumn = datetimeTask(w.giulia(), w.principale(), TRENO, rome(october, 7, 30), marco);

    assertThat(pending(sunday))
        .as("summer time: 9:00 = 07:00Z, 18:00 = 16:00Z")
        .containsExactlyInAnyOrder(slot(giulia, utc(march, 7, 0)), slot(giulia, utc(march, 16, 0)));
    assertThat(pending(dayBefore))
        .as("still winter time: 9:00 = 08:00Z, 18:00 = 17:00Z")
        .containsExactlyInAnyOrder(
            slot(giulia, utc(saturday, 8, 0)), slot(giulia, utc(saturday, 17, 0)));
    assertThat(pending(autumn))
        .as("06:30 local moves to 07:00 local = 06:00Z; the due is 06:30Z")
        .containsExactlyInAnyOrder(
            slot(marco, utc(october, 6, 0)), slot(marco, utc(october, 6, 30)));
  }

  @Test
  void case6AQueuedTaskGoesAtDueToEveryManagerThenToWhoTakesIt() throws Exception {
    Homes w = homes();
    User kate = kate(w);

    String auto = dateTask(w.giulia(), w.principale(), AUTO, day, null);

    assertThat(pending(auto))
        .as("only at 18:00, one row per manager")
        .containsExactlyInAnyOrder(
            slot(w.marco(), rome(day, 18, 0)), slot(w.giulia(), rome(day, 18, 0)));
    assertThat(reminders(auto))
        .noneMatch(r -> kate.personId().equals(r.get("recipient")))
        .noneMatch(r -> w.leo().equals(r.get("recipient")));

    Response taken = take(w.giulia().token(), w.principale(), auto);
    assertThat(taken.status()).as(taken.body()).isEqualTo(200);

    assertThat(pending(auto))
        .containsExactlyInAnyOrder(
            slot(w.giulia(), rome(day, 9, 0)), slot(w.giulia(), rome(day, 18, 0)));
  }

  @Test
  void case7AnInstantAlreadyPastIsNotWritten() throws Exception {
    Homes w = homes();
    clock.setTo(LocalDate.of(year, 1, 2).atTime(10, 0).toInstant(ZoneOffset.UTC));
    Instant due = clock.instant().plus(Duration.ofMinutes(30));

    String gatto = datetimeTask(w.giulia(), w.principale(), GATTO_VET, due, w.marco().personId());

    assertThat(pending(gatto))
        .as("«before» is 30 minutes ago")
        .containsExactly(slot(w.marco(), due));
    assertThat(reminders(gatto)).hasSize(1);

    assertOk(cancel(w.giulia().token(), w.principale(), gatto));
    assertThat(pending(gatto)).as("nothing left for the next tests").isEmpty();
  }
}
