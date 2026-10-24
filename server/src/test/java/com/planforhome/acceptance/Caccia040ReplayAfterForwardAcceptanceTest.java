package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Hunt 040, blocking defect of round 016 (rule 1 of CLAUDE.md): the replay of a write after the
 * task was forwarded to another family. Marco (Principale and Babbo, not Mamma) writes a task of
 * Principale; Giulia (Principale and Mamma) forwards it to Mamma; Marco repeats the same request,
 * with the same {@code mutationId}, on Principale. He gets 404 {@code not_found}, never the task
 * (title, notes), and nothing changes. Who is also in the family of arrival gets the task as it is
 * now. Only the create looks at the replay before finding the task in the family of the URL: update
 * and assign are there so that a later change does not open the same hole.
 *
 * <p>Same application context as rounds 003 to 016: no clock is needed here.
 */
class Caccia040ReplayAfterForwardAcceptanceTest extends Giro016AcceptanceSupport {

  static final String NOTE = "Codice del ritiro: 4417";

  private Response write(String op, World w, String taskId, String mutation) throws Exception {
    return switch (op) {
      case "create" ->
          createTask(
              w.marco().token(),
              w.principale(),
              mutation,
              "id",
              taskId,
              "title",
              FOTO,
              "notes",
              NOTE);
      case "update" ->
          update(w.marco().token(), w.principale(), taskId, mutation, "title", FOTO, "notes", NOTE);
      case "assign" ->
          setAssignee(w.marco().token(), w.principale(), taskId, mutation, w.marco().personId());
      default -> throw new IllegalArgumentException(op);
    };
  }

  @ParameterizedTest(name = "{0}")
  @ValueSource(strings = {"create", "update", "assign"})
  void theReplayAfterTheForwardIs404ForWhoIsNotInTheFamilyOfArrival(String op) throws Exception {
    World w = world();
    String taskId = id();
    String mutation = id();
    if (!op.equals("create")) {
      Response created =
          createTask(w.marco().token(), w.principale(), id(), "id", taskId, "title", FOTO);
      assertThat(created.status()).as("task: " + created.body()).isEqualTo(201);
    }
    Response first = write(op, w, taskId, mutation);
    assertThat(first.status()).as(op + ": " + first.body()).isIn(200, 201);
    Response forwarded = forward(w.giulia().token(), w.principale(), taskId, w.mamma());
    assertThat(forwarded.status()).as("forward: " + forwarded.body()).isEqualTo(200);
    long version = version(forwarded);
    int logRows = changeLog(taskId).size();

    Response replay = write(op, w, taskId, mutation);

    assertError(replay, 404, "not_found");
    assertThat(replay.body()).as("nothing of the task").doesNotContain(FOTO).doesNotContain(NOTE);
    assertUntouched(taskId, w.mamma(), version, logRows);
    assertThat(appliedRows(mutation)).as("applied_mutation of the first write only").isEqualTo(1);
  }

  @Test
  void whoIsAlsoInTheFamilyOfArrivalGetsTheTaskAsItIsNow() throws Exception {
    World w = world();
    String taskId = id();
    String mutation = id();
    Response created =
        createTask(
            w.giulia().token(),
            w.principale(),
            mutation,
            "id",
            taskId,
            "title",
            FOTO,
            "notes",
            NOTE);
    assertThat(created.status()).as("task: " + created.body()).isEqualTo(201);
    assertForwarded(forward(w.giulia().token(), w.principale(), taskId, w.mamma()), w.mamma(), 2);
    int logRows = changeLog(taskId).size();

    Response replay =
        createTask(
            w.giulia().token(),
            w.principale(),
            mutation,
            "id",
            taskId,
            "title",
            FOTO,
            "notes",
            NOTE);

    assertThat(replay.status()).as("replay: " + replay.body()).isEqualTo(200);
    assertThat((String) replay.json("$.familyId")).isEqualTo(w.mamma());
    assertThat(version(replay)).isEqualTo(2);
    assertUntouched(taskId, w.mamma(), 2, logRows);
    assertThat(appliedRows(mutation)).isEqualTo(1);
  }
}
