package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 008, T5 part 1: P3 to P6 of SPEC 5. A member assigns to herself only a task of hers (in the
 * queue and created by her, or already hers), puts back in the queue only a task assigned to her,
 * never assigns to another person; anyone takes from the queue; a manager assigns to anyone of the
 * family.
 */
class Giro008QueueAcceptanceTest extends Giro008AcceptanceSupport {

  // ---------------------------------------------------------------- P3

  @Test
  void p3AMemberAssignsHerOwnTaskToHerselfAndPutsItBack() throws Exception {
    Quercia q = quercia();
    String bread = taskOk(q.tea().token(), q.id(), BREAD);

    Response mine = setAssignee(q.tea().token(), q.id(), bread, q.tea().personId());
    assertThat(mine.status()).as(mine.body()).isEqualTo(200);
    assertThat((String) mine.json("$.assigneePersonId")).isEqualTo(q.tea().personId());
    assertThat(version(mine)).isEqualTo(2);

    Response back = setAssignee(q.tea().token(), q.id(), bread, null);
    assertThat(back.status()).as(back.body()).isEqualTo(200);
    assertThat((Object) back.json("$.assigneePersonId")).isNull();
    assertThat(version(back)).isEqualTo(3);
  }

  @Test
  void p3AMemberCannotTakeOverATaskOfVeraAssignedToIvo() throws Exception {
    Quercia q = quercia();
    String basil = taskOk(q.vera().token(), q.id(), BASIL, q.ivo().personId());

    assertError(setAssignee(q.tea().token(), q.id(), basil, q.tea().personId()), 403, "forbidden");

    assertUnchanged(q, basil, q.ivo().personId(), 1);
  }

  @Test
  void p3AMemberCannotTakeBackHerTaskOnceAManagerGaveItToIvo() throws Exception {
    Quercia q = quercia();
    String bread = taskOk(q.tea().token(), q.id(), BREAD);
    Response given = setAssignee(q.vera().token(), q.id(), bread, q.ivo().personId());
    assertThat(given.status()).as(given.body()).isEqualTo(200);

    assertError(setAssignee(q.tea().token(), q.id(), bread, q.tea().personId()), 403, "forbidden");

    assertUnchanged(q, bread, q.ivo().personId(), 2);
  }

  @Test
  void p3AMemberDoesNotAssignToHerselfATaskOfOthersInTheQueue() throws Exception {
    Quercia q = quercia();
    String vet = taskOk(q.vera().token(), q.id(), VET);

    assertError(setAssignee(q.tea().token(), q.id(), vet, q.tea().personId()), 403, "forbidden");

    assertUnchanged(q, vet, null, 1);
  }

  // ---------------------------------------------------------------- P4

  @Test
  void p4AManagerAssignsToAResourceWithoutAccount() throws Exception {
    Quercia q = quercia();
    String vet = taskOk(q.vera().token(), q.id(), VET);

    Response assigned = setAssignee(q.vera().token(), q.id(), vet, q.pia());

    assertThat(assigned.status()).as(assigned.body()).isEqualTo(200);
    assertThat((String) assigned.json("$.assigneePersonId")).isEqualTo(q.pia());
    assertUnchanged(q, vet, q.pia(), 2);
  }

  @Test
  void p4AMemberNeverAssignsToSomeoneElse() throws Exception {
    Quercia q = quercia();
    String bread = taskOk(q.tea().token(), q.id(), BREAD);

    assertError(setAssignee(q.tea().token(), q.id(), bread, q.ivo().personId()), 403, "forbidden");
    assertUnchanged(q, bread, null, 1);

    String other = id();
    assertError(
        createTask(
            q.tea().token(),
            q.id(),
            id(),
            "id",
            other,
            "title",
            BASIL,
            "assigneePersonId",
            q.ivo().personId()),
        403,
        "forbidden");
    assertThat(ids(tasks(q.ugo().token(), q.id()))).containsExactly(bread);

    Response toHerself =
        createTask(
            q.tea().token(), q.id(), id(), "title", VET, "assigneePersonId", q.tea().personId());
    assertThat(toHerself.status()).as(toHerself.body()).isEqualTo(201);
    assertThat((String) toHerself.json("$.assigneePersonId")).isEqualTo(q.tea().personId());
  }

  @Test
  void p4NobodyAssignsToAPersonOfAnotherFamily() throws Exception {
    Quercia q = quercia();
    String rosa = personIdOfDemo("rosa");
    String vet = taskOk(q.vera().token(), q.id(), VET);

    assertError(setAssignee(q.vera().token(), q.id(), vet, rosa), 400, "assignee_invalid");
    assertUnchanged(q, vet, null, 1);
    assertError(
        createTask(q.vera().token(), q.id(), id(), "title", BASIL, "assigneePersonId", rosa),
        400,
        "assignee_invalid");
    assertThat(ids(tasks(q.ugo().token(), q.id()))).containsExactly(vet);
  }

  // ---------------------------------------------------------------- P5

  @Test
  void p5AnyoneTakesFromTheQueueAndTheSecondIsToldWhoHasIt() throws Exception {
    Quercia q = quercia();
    String basil = taskOk(q.vera().token(), q.id(), BASIL);

    Response took = take(q.tea().token(), q.id(), basil);
    assertThat(took.status()).as(took.body()).isEqualTo(200);
    assertThat((String) took.json("$.assigneePersonId")).isEqualTo(q.tea().personId());
    assertThat(version(took)).isEqualTo(2);

    Response late = take(q.ivo().token(), q.id(), basil);
    assertError(late, 409, "already_taken");
    assertThat((String) late.json("$.assigneePersonId")).isEqualTo(q.tea().personId());
    assertThat((String) late.json("$.assigneeName")).isEqualTo("Tea");

    Response stranger = take(demoToken("luca"), q.id(), basil);
    assertThat(stranger.status()).as(stranger.body()).isEqualTo(404);

    Response again = take(q.tea().token(), q.id(), basil);
    assertThat(again.status()).as(again.body()).isEqualTo(200);
    assertThat(version(again)).isEqualTo(2);
    assertUnchanged(q, basil, q.tea().personId(), 2);
  }

  // ---------------------------------------------------------------- P6

  @Test
  void p6TheAssigneeAndAManagerPutBackInTheQueue() throws Exception {
    Quercia q = quercia();
    String forIvo = taskOk(q.vera().token(), q.id(), BASIL, q.ivo().personId());
    String forTea = taskOk(q.vera().token(), q.id(), VET, q.tea().personId());

    Response ivo = setAssignee(q.ivo().token(), q.id(), forIvo, null);
    assertThat(ivo.status()).as(ivo.body()).isEqualTo(200);
    assertUnchanged(q, forIvo, null, 2);

    Response ugo = setAssignee(q.ugo().token(), q.id(), forTea, null);
    assertThat(ugo.status()).as(ugo.body()).isEqualTo(200);
    assertUnchanged(q, forTea, null, 2);
  }

  @Test
  void p6AMemberDoesNotPutBackATaskOfSomeoneElse() throws Exception {
    Quercia q = quercia();
    String forIvo = taskOk(q.vera().token(), q.id(), BASIL, q.ivo().personId());

    assertError(setAssignee(q.tea().token(), q.id(), forIvo, null), 403, "forbidden");

    assertUnchanged(q, forIvo, q.ivo().personId(), 1);
  }

  // ---------------------------------------------------------------- helpers

  /** The task, as Ugo sees it, has this assignee and this version. */
  private void assertUnchanged(Quercia q, String taskId, String assignee, long version)
      throws Exception {
    Map<String, Object> task = task(q.ugo().token(), q.id(), taskId);
    assertThat(task).containsEntry("assigneePersonId", assignee);
    assertThat(version(task)).isEqualTo(version);
  }
}
