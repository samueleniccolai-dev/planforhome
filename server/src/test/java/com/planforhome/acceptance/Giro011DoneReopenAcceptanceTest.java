package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 011, T5 part 3: P7 and P8 of SPEC 5. A manager marks done any task, in the queue too; a
 * member only a task assigned to him or to a resource without account he is the referent of. A
 * manager reopens any done task; a member only one he marked done himself. Only an open task is
 * marked done (409 {@code not_open}), only a done task reopens (409 {@code not_done}); take and
 * assign refuse a task that is not open. Every write is idempotent and adds a change_log row.
 */
class Giro011DoneReopenAcceptanceTest extends Giro011AcceptanceSupport {

  private static final int ROUNDS = 10;

  // ---------------------------------------------------------------- P7 allowed

  @Test
  void p7AManagerMarksDoneATaskInTheQueue() throws Exception {
    Mamma m = mamma();
    String bolletta = bolletta(m);

    Response done = done(m.anna().token(), m.id(), bolletta);

    assertOk(done);
    assertThat((String) done.json("$.status")).isEqualTo("DONE");
    assertThat((String) done.json("$.completedBy")).isEqualTo(m.anna().personId());
    assertThat(version(done)).isEqualTo(2);
    assertState(m, bolletta, "DONE", 2, 2);
    assertThat(changeLog(bolletta).get(1))
        .isEqualTo(Map.of("family_id", m.id(), "entity", "task", "op", "UPSERT"));
    assertThat(task(m.anna().token(), m.id(), bolletta))
        .containsEntry("completedBy", m.anna().personId());
  }

  @Test
  void p7TheAssigneeMarksHisTaskDone() throws Exception {
    Mamma m = mamma();
    String pane = pane(m);

    Response done = done(m.paolo().token(), m.id(), pane);

    assertOk(done);
    assertThat((String) done.json("$.status")).isEqualTo("DONE");
    assertThat((String) done.json("$.completedBy")).isEqualTo(m.paolo().personId());
    assertThat((String) done.json("$.assigneePersonId")).isEqualTo(m.paolo().personId());
    assertState(m, pane, "DONE", 2, 2);
  }

  @Test
  void p7TheReferentMarksDoneTheTaskOfHisResource() throws Exception {
    Mamma m = mamma();
    String piscina = piscina(m);

    // Davide is a member too, but not the referent of Nina.
    assertError(done(m.davide().token(), m.id(), piscina), 403, "forbidden");
    assertState(m, piscina, "OPEN", 1, 1);

    Response done = done(m.luca().token(), m.id(), piscina);
    assertOk(done);
    assertThat((String) done.json("$.completedBy")).isEqualTo(m.luca().personId());
    assertThat((String) done.json("$.assigneePersonId")).isEqualTo(m.nina());
    assertState(m, piscina, "DONE", 2, 2);
  }

  // ---------------------------------------------------------------- P7 refused

  @Test
  void p7AMemberDoesNotMarkDoneATaskOfSomeoneElse() throws Exception {
    Mamma m = mamma();
    String pane = pane(m);

    assertError(done(m.luca().token(), m.id(), pane), 403, "forbidden");

    assertState(m, pane, "OPEN", 1, 1);
    assertThat(task(m.anna().token(), m.id(), pane)).containsEntry("completedBy", null);
  }

  @Test
  void p7AMemberDoesNotMarkDoneATaskInTheQueueNotEvenHisOwn() throws Exception {
    Mamma m = mamma();
    String bolletta = bolletta(m);
    String latte = taskOk(m.davide().token(), m.id(), LATTE);

    assertError(done(m.paolo().token(), m.id(), bolletta), 403, "forbidden");
    assertError(done(m.davide().token(), m.id(), latte), 403, "forbidden");

    assertState(m, bolletta, "OPEN", 1, 1);
    assertState(m, latte, "OPEN", 1, 1);
  }

  @Test
  void onlyAnOpenTaskIsMarkedDone() throws Exception {
    Mamma m = mamma();
    String pane = pane(m);
    assertOk(done(m.paolo().token(), m.id(), pane));
    String bolletta = bolletta(m);
    assertOk(cancel(m.anna().token(), m.id(), bolletta));

    assertError(done(m.anna().token(), m.id(), pane), 409, "not_open");
    assertError(done(m.anna().token(), m.id(), bolletta), 409, "not_open");

    assertState(m, pane, "DONE", 2, 2);
    assertState(m, bolletta, "CANCELLED", 2, 2);
  }

  // ---------------------------------------------------------------- P8 allowed

  @Test
  void p8WhoMarkedItDoneReopensItAndTheAssigneeStays() throws Exception {
    Mamma m = mamma();
    String pane = pane(m);
    assertOk(done(m.paolo().token(), m.id(), pane));

    Response reopened = reopen(m.paolo().token(), m.id(), pane);

    assertOk(reopened);
    assertThat((String) reopened.json("$.status")).isEqualTo("OPEN");
    assertThat((Object) reopened.json("$.completedBy")).isNull();
    assertThat((String) reopened.json("$.assigneePersonId")).isEqualTo(m.paolo().personId());
    assertThat(version(reopened)).isEqualTo(3);
    assertState(m, pane, "OPEN", 3, 3);
  }

  @Test
  void p8LucaReopensTheTaskHeMarkedDoneThoughItIsAssignedToNina() throws Exception {
    Mamma m = mamma();
    String piscina = piscina(m);
    assertOk(done(m.luca().token(), m.id(), piscina));

    Response reopened = reopen(m.luca().token(), m.id(), piscina);

    assertOk(reopened);
    assertThat((String) reopened.json("$.assigneePersonId")).isEqualTo(m.nina());
    assertState(m, piscina, "OPEN", 3, 3);
  }

  @Test
  void p8AManagerReopensATaskMarkedDoneByLuca() throws Exception {
    Mamma m = mamma();
    String piscina = piscina(m);
    assertOk(done(m.luca().token(), m.id(), piscina));

    assertOk(reopen(m.anna().token(), m.id(), piscina));

    assertState(m, piscina, "OPEN", 3, 3);
  }

  // ---------------------------------------------------------------- P8 refused

  @Test
  void p8AMemberDoesNotReopenWhatSomeoneElseMarkedDone() throws Exception {
    Mamma m = mamma();
    String pane = pane(m);
    assertOk(done(m.paolo().token(), m.id(), pane));

    assertError(reopen(m.davide().token(), m.id(), pane), 403, "forbidden");

    assertState(m, pane, "DONE", 2, 2);
  }

  @Test
  void p8TheAssigneeDoesNotReopenWhatAManagerMarkedDone() throws Exception {
    Mamma m = mamma();
    String pane = pane(m);
    assertOk(done(m.anna().token(), m.id(), pane));

    assertError(reopen(m.paolo().token(), m.id(), pane), 403, "forbidden");

    assertState(m, pane, "DONE", 2, 2);
    assertThat(task(m.anna().token(), m.id(), pane))
        .containsEntry("completedBy", m.anna().personId());
  }

  @Test
  void onlyADoneTaskReopensNotAnOpenOrACancelledOne() throws Exception {
    Mamma m = mamma();
    String pane = pane(m);
    String bolletta = bolletta(m);
    assertOk(cancel(m.anna().token(), m.id(), bolletta));

    assertError(reopen(m.anna().token(), m.id(), pane), 409, "not_done");
    assertError(reopen(m.anna().token(), m.id(), bolletta), 409, "not_done");

    assertState(m, pane, "OPEN", 1, 1);
    assertState(m, bolletta, "CANCELLED", 2, 2);
  }

  // ---------------------------------------------------------------- take and assign

  @Test
  void takeRefusesADoneTaskInTheQueueAndOneAlreadyOfTheCaller() throws Exception {
    Mamma m = mamma();
    String bolletta = bolletta(m);
    assertOk(done(m.anna().token(), m.id(), bolletta));
    String pane = pane(m);
    assertOk(done(m.paolo().token(), m.id(), pane));

    assertError(take(m.luca().token(), m.id(), bolletta), 409, "not_open");
    assertError(take(m.paolo().token(), m.id(), pane), 409, "not_open");

    assertState(m, bolletta, "DONE", 2, 2);
    assertThat(task(m.anna().token(), m.id(), bolletta)).containsEntry("assigneePersonId", null);
    assertState(m, pane, "DONE", 2, 2);
  }

  @Test
  void aManagerDoesNotAssignATaskThatIsNotOpen() throws Exception {
    Mamma m = mamma();
    String pane = pane(m);
    assertOk(done(m.paolo().token(), m.id(), pane));
    String bolletta = bolletta(m);
    assertOk(cancel(m.anna().token(), m.id(), bolletta));

    assertError(setAssignee(m.anna().token(), m.id(), pane, m.luca().personId()), 409, "not_open");
    assertError(
        setAssignee(m.anna().token(), m.id(), bolletta, m.luca().personId()), 409, "not_open");

    assertThat(task(m.anna().token(), m.id(), pane))
        .containsEntry("assigneePersonId", m.paolo().personId());
    assertState(m, pane, "DONE", 2, 2);
    assertState(m, bolletta, "CANCELLED", 2, 2);
  }

  // ---------------------------------------------------------------- idempotence

  @Test
  void doneAndReopenRepeatedWithTheSameMutationIdApplyOnce() throws Exception {
    Mamma m = mamma();
    String pane = pane(m);
    String markDone = id();

    assertOk(done(m.paolo().token(), m.id(), pane, markDone));
    Response again = done(m.paolo().token(), m.id(), pane, markDone);
    assertOk(again);
    assertThat(version(again)).isEqualTo(2);
    assertThat((String) again.json("$.status")).isEqualTo("DONE");
    assertState(m, pane, "DONE", 2, 2);

    String open = id();
    assertOk(reopen(m.paolo().token(), m.id(), pane, open));
    Response reopenAgain = reopen(m.paolo().token(), m.id(), pane, open);
    assertOk(reopenAgain);
    assertThat(version(reopenAgain)).isEqualTo(3);
    assertState(m, pane, "OPEN", 3, 3);

    // A late replay of the first «done» answers with the current state, it does not apply again.
    Response late = done(m.paolo().token(), m.id(), pane, markDone);
    assertOk(late);
    assertThat((String) late.json("$.status")).isEqualTo("OPEN");
    assertThat(version(late)).isEqualTo(3);
    assertState(m, pane, "OPEN", 3, 3);
  }

  @Test
  void aMutationIdReusedOnAnotherOpTaskOrPersonIsAConflict() throws Exception {
    Mamma m = mamma();
    String pane = pane(m);
    String bolletta = bolletta(m);
    String mutation = id();
    assertOk(done(m.paolo().token(), m.id(), pane, mutation));

    assertError(reopen(m.paolo().token(), m.id(), pane, mutation), 409, "mutation_conflict");
    assertError(cancel(m.paolo().token(), m.id(), pane, mutation), 409, "mutation_conflict");
    assertError(done(m.anna().token(), m.id(), bolletta, mutation), 409, "mutation_conflict");
    assertError(done(m.anna().token(), m.id(), pane, mutation), 409, "mutation_conflict");

    assertState(m, pane, "DONE", 2, 2);
    assertState(m, bolletta, "OPEN", 1, 1);
  }

  // ---------------------------------------------------------------- concurrency

  @Test
  void twoMarkDoneTogetherAndOnlyOneApplies() throws Exception {
    Mamma m = mamma();
    for (int round = 0; round < ROUNDS; round++) {
      String pane = pane(m);

      List<Response> answers =
          together(
              () -> done(m.anna().token(), m.id(), pane),
              () -> done(m.paolo().token(), m.id(), pane));

      assertThat(statuses(answers)).as("round " + round).containsExactlyInAnyOrder(200, 409);
      Response lost = answers.get(0).status() == 409 ? answers.get(0) : answers.get(1);
      assertThat(lost.error()).isEqualTo("not_open");
      assertState(m, pane, "DONE", 2, 2);
    }
  }

  @Test
  void doneAndCancelTogetherAndOnlyOneApplies() throws Exception {
    Mamma m = mamma();
    for (int round = 0; round < ROUNDS; round++) {
      String pane = pane(m);

      List<Response> answers =
          together(
              () -> done(m.paolo().token(), m.id(), pane),
              () -> cancel(m.anna().token(), m.id(), pane));

      assertThat(statuses(answers)).as("round " + round).containsExactlyInAnyOrder(200, 409);
      Response lost = answers.get(0).status() == 409 ? answers.get(0) : answers.get(1);
      assertThat(lost.error()).isEqualTo("not_open");
      String status = answers.get(0).status() == 200 ? "DONE" : "CANCELLED";
      assertState(m, pane, status, 2, 2);
    }
  }
}
