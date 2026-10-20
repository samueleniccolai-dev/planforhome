package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * Round 008: a task of another family through the URL of one's own family, the composite foreign
 * key in the database, and the concurrency risks of the plan. The parametric test of round 003
 * covers strangers on every endpoint.
 */
class Giro008TaskIsolationAcceptanceTest extends Giro008AcceptanceSupport {

  private static final int ROUNDS = 10;

  // ---------------------------------------------------------------- task id in the URL

  @Test
  void aTaskOfAceroThroughTheUrlOfQuerciaIsNotFound() throws Exception {
    Quercia q = quercia();
    String gas = taskOk(q.tea().token(), q.acero(), GAS);
    String missing = id();

    for (User user : List.of(q.ugo(), q.tea())) {
      Response assign = setAssignee(user.token(), q.id(), gas, user.personId());
      Response assignMissing = setAssignee(user.token(), q.id(), missing, user.personId());
      assertThat(assign.status()).as(user.name() + " assignee: " + assign.body()).isEqualTo(404);
      assertThat(assign.body()).isEqualTo(assignMissing.body());

      Response take = take(user.token(), q.id(), gas);
      Response takeMissing = take(user.token(), q.id(), missing);
      assertThat(take.status()).as(user.name() + " take: " + take.body()).isEqualTo(404);
      assertThat(take.body()).isEqualTo(takeMissing.body());
    }

    Map<String, Object> untouched = task(q.tea().token(), q.acero(), gas);
    assertThat(untouched).containsEntry("assigneePersonId", null).containsEntry("title", GAS);
    assertThat(version(untouched)).isEqualTo(1);
    assertThat(changeLog(gas)).hasSize(1);
  }

  // ---------------------------------------------------------------- database constraint

  @Test
  void theDatabaseRefusesAnAssigneeOutsideTheFamily() throws Exception {
    Quercia q = quercia();
    String rosa = personIdOfDemo("rosa");
    String bread = taskOk(q.ugo().token(), q.id(), BREAD);

    // Control: the same insert with a member of the family goes through.
    insertTask(id(), q.id(), q.ugo().personId(), q.ugo().personId());

    assertThatThrownBy(() -> insertTask(id(), q.id(), rosa, q.ugo().personId()))
        .isInstanceOf(DataIntegrityViolationException.class);
    assertThatThrownBy(
            () ->
                jdbc.update(
                    "update task set assignee_person_id = ?::uuid where id = ?::uuid", rosa, bread))
        .isInstanceOf(DataIntegrityViolationException.class);
    assertThat(task(q.ugo().token(), q.id(), bread)).containsEntry("assigneePersonId", null);
  }

  private void insertTask(String taskId, String familyId, String assignee, String createdBy) {
    jdbc.update(
        "insert into task (id, family_id, title, assignee_person_id, created_by, version,"
            + " created_at, updated_at) values (?::uuid, ?::uuid, ?, ?::uuid, ?::uuid, 1, now(),"
            + " now())",
        taskId,
        familyId,
        "Inserito dal test",
        assignee,
        createdBy);
  }

  // ---------------------------------------------------------------- concurrency

  @Test
  void twoTakeTheSameTaskAndOnlyOneWins() throws Exception {
    Noce n = noce();
    for (int round = 0; round < ROUNDS; round++) {
      String bike = taskOk(n.ugo().token(), n.id(), BIKE);

      List<Response> answers =
          together(
              () -> take(n.ada().token(), n.id(), bike), () -> take(n.bea().token(), n.id(), bike));

      assertThat(statuses(answers)).as("round " + round).containsExactlyInAnyOrder(200, 409);
      Response won = answers.get(0).status() == 200 ? answers.get(0) : answers.get(1);
      Response lost = answers.get(0).status() == 200 ? answers.get(1) : answers.get(0);
      User winner = won == answers.get(0) ? n.ada() : n.bea();
      assertThat((String) won.json("$.id")).isEqualTo(bike);
      assertThat(lost.error()).isEqualTo("already_taken");
      assertThat((String) lost.json("$.assigneePersonId")).isEqualTo(winner.personId());
      assertThat((String) lost.json("$.assigneeName")).isEqualTo(winner.name());
      Map<String, Object> task = task(n.ugo().token(), n.id(), bike);
      assertThat(task).containsEntry("assigneePersonId", winner.personId());
      assertThat(version(task)).isEqualTo(2);
      assertThat(changeLog(bike)).hasSize(2);
    }
  }

  @Test
  void theSameMutationSentTwiceInParallelAppliesOnce() throws Exception {
    Noce n = noce();
    for (int round = 0; round < ROUNDS; round++) {
      String bike = id();
      String create = id();
      List<Response> created =
          together(
              () -> createTask(n.ada().token(), n.id(), create, "id", bike, "title", BIKE),
              () -> createTask(n.ada().token(), n.id(), create, "id", bike, "title", BIKE));
      assertOneAppliedOtherReplayedOrRefused(created, 201, "round " + round + " create");
      assertThat(ids(tasks(n.ugo().token(), n.id())).stream().filter(bike::equals)).hasSize(1);
      assertThat(changeLog(bike)).hasSize(1);

      String takeMutation = id();
      List<Response> took =
          together(
              () -> take(n.bea().token(), n.id(), bike, takeMutation),
              () -> take(n.bea().token(), n.id(), bike, takeMutation));
      assertOneAppliedOtherReplayedOrRefused(took, 200, "round " + round + " take");
      Map<String, Object> task = task(n.ugo().token(), n.id(), bike);
      assertThat(task).containsEntry("assigneePersonId", n.bea().personId());
      assertThat(version(task)).isEqualTo(2);
      assertThat(changeLog(bike)).hasSize(2);
    }
  }

  @Test
  void takingWhileBeingRemovedNeverLeavesTheTaskToBea() throws Exception {
    Noce n = noce();
    for (int round = 0; round < ROUNDS; round++) {
      String bike = taskOk(n.ugo().token(), n.id(), BIKE);

      List<Response> answers =
          together(
              () -> take(n.bea().token(), n.id(), bike),
              () -> removeMember(n.ugo().token(), n.id(), n.bea().personId()));

      List<Integer> statuses = statuses(answers);
      assertThat(statuses).as("round " + round).isIn(List.of(200, 204), List.of(404, 204));
      Map<String, Object> task = task(n.ugo().token(), n.id(), bike);
      assertThat(task).as("round " + round).containsEntry("assigneePersonId", null);
      joinOk(n.bea(), invite(n.ugo().token(), n.id()));
    }
  }

  @Test
  void assigningToAdaWhileSheLeavesNeverLeavesTheTaskToHer() throws Exception {
    Noce n = noce();
    for (int round = 0; round < ROUNDS; round++) {
      String bike = taskOk(n.ugo().token(), n.id(), BIKE);

      List<Response> answers =
          together(
              () -> setAssignee(n.ugo().token(), n.id(), bike, n.ada().personId()),
              () -> removeMember(n.ada().token(), n.id(), n.ada().personId()));

      List<Integer> statuses = statuses(answers);
      assertThat(statuses).as("round " + round).isIn(List.of(200, 204), List.of(400, 204));
      Map<String, Object> task = task(n.ugo().token(), n.id(), bike);
      assertThat(task).as("round " + round).containsEntry("assigneePersonId", null);
      if (statuses.get(0) == 400) {
        assertThat(answers.get(0).error()).isEqualTo("assignee_invalid");
        assertThat(version(task)).isEqualTo(1);
      } else {
        assertThat(version(task)).isEqualTo(3);
      }
      joinOk(n.ada(), invite(n.ugo().token(), n.id()));
    }
  }

  /** One answer applies ({@code applied}); the other is a replay (200) or mutation_conflict. */
  private static void assertOneAppliedOtherReplayedOrRefused(
      List<Response> answers, int applied, String what) {
    List<Integer> statuses = statuses(answers);
    assertThat(statuses).as(what).contains(applied);
    Response other = statuses.get(0) == applied ? answers.get(1) : answers.get(0);
    assertThat(other.status()).as(what + ": " + other.body()).isIn(200, 409);
    if (other.status() == 409) {
      assertThat(other.error()).isEqualTo("mutation_conflict");
    }
  }
}
