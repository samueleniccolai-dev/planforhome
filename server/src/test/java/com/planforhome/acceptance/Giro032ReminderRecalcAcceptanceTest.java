package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import org.junit.jupiter.api.Test;

/**
 * Round 032, T10 part 2: the pending rows follow the task (SPEC 8, «ricalcolo»). Every write that
 * touches the task deletes its pending rows and computes them again, in the zone of the family the
 * task is in now; the rows already sent ({@code AUTO} or {@code NUDGE}) stay as they are. Removing
 * a member (its tasks go back to the queue) and changing the referent of a resource recompute too.
 */
class Giro032ReminderRecalcAcceptanceTest extends Giro032AcceptanceSupport {

  static final ZoneId NEW_YORK_ZONE = ZoneId.of(NEW_YORK);

  @Test
  void case1APutOfTheDueLeavesOnlyTheNewRows() throws Exception {
    Homes w = homes();
    String mensa = dateTask(w.giulia(), w.principale(), MENSA, day, w.giulia().personId());
    LocalDate next = day.plusDays(1);

    assertOk(putDue(w.giulia(), w.principale(), mensa, MENSA, "DATE", next.toString()));
    assertThat(pending(mensa))
        .containsExactlyInAnyOrder(
            slot(w.giulia(), rome(next, 9, 0)), slot(w.giulia(), rome(next, 18, 0)));

    assertOk(
        putDue(w.giulia(), w.principale(), mensa, MENSA, "DATETIME", rome(next, 15, 0).toString()));
    assertThat(pending(mensa))
        .as("now a DATETIME")
        .containsExactlyInAnyOrder(
            slot(w.giulia(), rome(next, 14, 0)), slot(w.giulia(), rome(next, 15, 0)));
  }

  @Test
  void case2AReassignmentMovesTheRowsToTheNewAssignee() throws Exception {
    Homes w = homes();
    String mensa = dateTask(w.giulia(), w.principale(), MENSA, day, w.giulia().personId());

    assertOk(setAssignee(w.giulia().token(), w.principale(), mensa, w.marco().personId()));

    assertThat(pending(mensa))
        .containsExactlyInAnyOrder(
            slot(w.marco(), rome(day, 9, 0)), slot(w.marco(), rome(day, 18, 0)));
  }

  @Test
  void case3DoneAndCancelledHaveNoRowsReopenedHasThemAgain() throws Exception {
    Homes w = homes();
    String mensa = dateTask(w.giulia(), w.principale(), MENSA, day, w.giulia().personId());
    assertThat(pending(mensa)).hasSize(2);

    assertOk(done(w.giulia().token(), w.principale(), mensa));
    assertThat(pending(mensa)).as("done").isEmpty();

    assertOk(reopen(w.giulia().token(), w.principale(), mensa));
    assertThat(pending(mensa))
        .as("reopened")
        .containsExactlyInAnyOrder(
            slot(w.giulia(), rome(day, 9, 0)), slot(w.giulia(), rome(day, 18, 0)));

    assertOk(cancel(w.giulia().token(), w.principale(), mensa));
    assertThat(pending(mensa)).as("cancelled").isEmpty();
  }

  @Test
  void case4BackToTheQueueGivesTheManagersTheirRows() throws Exception {
    Homes w = homes();
    String mensa = dateTask(w.giulia(), w.principale(), MENSA, day, w.giulia().personId());

    assertOk(setAssignee(w.giulia().token(), w.principale(), mensa, null));

    assertThat(pending(mensa))
        .containsExactlyInAnyOrder(
            slot(w.giulia(), rome(day, 18, 0)), slot(w.marco(), rome(day, 18, 0)));
  }

  @Test
  void case5RowsAlreadySentAreNotTouched() throws Exception {
    Homes w = homes();
    deviceOk(w.marco(), "tok-marco-2");
    String gatto =
        datetimeTask(w.giulia(), w.principale(), GATTO_VET, rome(day, 15, 0), w.marco().personId());
    nudgeOk(w.giulia().token(), w.principale(), gatto);
    Map<String, Object> nudge =
        reminders(gatto).stream().filter(r -> "NUDGE".equals(r.get("kind"))).findFirst().get();
    clock.setTo(rome(day, 14, 0));
    Map<String, Object> sentAuto = awaitSettled(gatto, w.marco().personId(), rome(day, 14, 0));
    assertThat((String) sentAuto.get("result")).startsWith("projects/");

    LocalDate next = day.plusDays(1);
    assertOk(
        putDue(
            w.giulia(),
            w.principale(),
            gatto,
            GATTO_VET,
            "DATETIME",
            rome(next, 15, 0).toString()));

    assertThat(pending(gatto))
        .containsExactlyInAnyOrder(
            slot(w.marco(), rome(next, 14, 0)), slot(w.marco(), rome(next, 15, 0)));
    List<Map<String, Object>> settled =
        reminders(gatto).stream().filter(r -> !"pending".equals(r.get("result"))).toList();
    assertThat(settled)
        .as("the NUDGE and the AUTO already sent")
        .containsExactlyInAnyOrder(nudge, sentAuto);
  }

  @Test
  void case6TheNextOccurrenceOfASeriesHasItsOwnRows() throws Exception {
    Homes w = homes();
    String first =
        recurringOk(
            w.giulia().token(),
            w.principale(),
            MENSA,
            "DATE",
            day.toString(),
            DAILY,
            w.giulia().personId());
    String seriesId = (String) task(w.giulia().token(), w.principale(), first).get("seriesId");

    assertOk(done(w.giulia().token(), w.principale(), first));

    String next = (String) nextOf(w.giulia().token(), w.principale(), seriesId, first).get("id");
    LocalDate nextDay = day.plusDays(1);
    assertThat(pending(next))
        .containsExactlyInAnyOrder(
            slot(w.giulia(), rome(nextDay, 9, 0)), slot(w.giulia(), rome(nextDay, 18, 0)));
    assertThat(pending(first)).as("the done occurrence").isEmpty();
  }

  @Test
  void case7AForwardComputesInTheZoneOfTheNewFamily() throws Exception {
    Homes w = homes();
    String zio = createFamilyOk(w.anna().token(), ZIO, NEW_YORK);
    joinOk(w.giulia(), invite(w.anna().token(), zio));
    String pranzo = dateTask(w.giulia(), w.principale(), PRANZO, day, w.giulia().personId());

    Response forwarded = forwardTo(w.giulia().token(), w.principale(), pranzo, zio);
    assertThat(forwarded.status()).as(forwarded.body()).isEqualTo(200);
    assertThat((String) forwarded.json("$.due")).as("the same day").isEqualTo(day.toString());

    assertThat(pending(pranzo))
        .as("9:00 and 18:00 in New York, still Giulia (she is in Zio)")
        .containsExactlyInAnyOrder(
            slot(w.giulia(), at(day, 9, 0, NEW_YORK_ZONE)),
            slot(w.giulia(), at(day, 18, 0, NEW_YORK_ZONE)));
  }

  @Test
  void case8IsolationAForwardedTaskRemindsOnlyPeopleOfTheNewFamily() throws Exception {
    Homes w = homes();
    joinOk(w.giulia(), invite(w.anna().token(), w.mamma()));
    String pranzo = dateTask(w.giulia(), w.principale(), PRANZO, day, w.marco().personId());
    String mensa = dateTask(w.giulia(), w.principale(), MENSA, day, w.giulia().personId());
    long seq = seqOk(w.anna().token(), w.mamma());

    Response forwarded = forwardTo(w.giulia().token(), w.principale(), pranzo, w.mamma());
    assertThat(forwarded.status()).as(forwarded.body()).isEqualTo(200);

    assertThat(pending(pranzo))
        .as("Marco is not in Mamma: in the queue there, at 18:00 to Anna, its only manager")
        .containsExactly(slot(w.anna(), rome(day, 18, 0)));
    assertThat(reminders(pranzo))
        .noneMatch(r -> w.marco().personId().equals(r.get("recipient")))
        .noneMatch(r -> w.giulia().personId().equals(r.get("recipient")));
    assertThat(reminders(mensa)).noneMatch(r -> w.anna().personId().equals(r.get("recipient")));

    Page changes = changesOk(w.anna().token(), w.mamma(), seq, null);
    assertThat(changes.changes()).noneMatch(c -> "reminder".equals(c.get("entity")));
    assertThat(changes.body()).doesNotContain("pending");
    Response paolo = get("/api/tasks", w.paolo().token());
    assertThat(paolo.status()).isEqualTo(200);
    assertThat(paolo.body()).doesNotContain("pending").doesNotContain("reminder");
  }

  @Test
  void case9AMemberRemovedLeavesHisTasksToTheManagers() throws Exception {
    Homes w = homes();
    String gatto =
        datetimeTask(w.giulia(), w.principale(), GATTO_VET, rome(day, 15, 0), w.marco().personId());
    String mensa = dateTask(w.giulia(), w.principale(), MENSA, day, w.marco().personId());

    Response removed = removeMember(w.giulia().token(), w.principale(), w.marco().personId());
    assertThat(removed.status()).as(removed.body()).isEqualTo(204);

    assertThat(pending(gatto))
        .as("back in the queue: at due, to Giulia, the only manager left")
        .containsExactly(slot(w.giulia(), rome(day, 15, 0)));
    assertThat(pending(mensa)).containsExactly(slot(w.giulia(), rome(day, 18, 0)));
  }

  @Test
  void case10ANewReferentGetsTheRowsOfTheResource() throws Exception {
    Homes w = homes();
    String zaino = dateTask(w.giulia(), w.principale(), ZAINO, day, w.leo());

    Response changed =
        setReferent(w.giulia().token(), w.principale(), w.leo(), w.marco().personId());
    assertThat(changed.status()).as(changed.body()).isEqualTo(200);

    assertThat(pending(zaino))
        .containsExactlyInAnyOrder(
            slot(w.marco(), rome(day, 9, 0)), slot(w.marco(), rome(day, 18, 0)));
  }

  @Test
  void case11TenParallelReassignmentsLeaveTheRowsOfTheLastState() throws Exception {
    Homes w = homes();
    String mensa = dateTask(w.giulia(), w.principale(), MENSA, day, w.giulia().personId());
    List<Callable<Response>> calls = new ArrayList<>();
    for (int i = 0; i < 10; i++) {
      String to = i % 2 == 0 ? w.marco().personId() : w.giulia().personId();
      calls.add(() -> setAssignee(w.giulia().token(), w.principale(), mensa, to));
    }

    @SuppressWarnings("unchecked")
    List<Response> answers = together(calls.toArray(new Callable[0]));

    assertThat(statuses(answers)).containsOnly(200);
    String last = (String) task(w.giulia().token(), w.principale(), mensa).get("assigneePersonId");
    List<Slot> rows = pending(mensa);
    assertThat(rows)
        .containsExactlyInAnyOrder(slot(last, rome(day, 9, 0)), slot(last, rome(day, 18, 0)));
    assertThat(new HashSet<>(rows)).as("no doubles").hasSize(rows.size());
    assertThat(reminders(mensa)).as("only pending rows").hasSize(2);
  }
}
