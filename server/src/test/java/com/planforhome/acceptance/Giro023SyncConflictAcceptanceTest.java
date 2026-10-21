package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 023, S5 and S6: the optional {@code version} of the PUT of a task. Order of the checks:
 * replay of the mutation id, then permissions and state, then the version. The first write wins;
 * the second gets 409 {@code version_conflict} with the current task. A write that is no longer
 * allowed is 403, whatever its version.
 */
class Giro023SyncConflictAcceptanceTest extends Giro023SyncAcceptanceSupport {

  @Test
  void theFirstWriteWinsAndTheSecondGetsTheCurrentTask() throws Exception {
    Families f = families();
    User giulia = f.giulia();
    User marco = f.marco();
    String p = f.principale();
    String piante = taskOk(giulia.token(), p, PIANTE);
    long v = version(task(marco.token(), p, piante));
    assertThat(version(task(giulia.token(), p, piante))).isEqualTo(v);

    String marcoMutation = id();
    Response first = updateV(marco.token(), p, piante, marcoMutation, PIANTE_BALCONE, v);
    assertOk(first);
    assertThat(version(first)).isEqualTo(v + 1);
    int logRows = changeLog(piante).size();

    Response late = updateV(giulia.token(), p, piante, id(), PIANTE_GIARDINO, v);
    assertError(late, 409, "version_conflict");
    assertThat((String) late.json("$.current.title")).isEqualTo(PIANTE_BALCONE);
    assertThat(((Number) late.json("$.current.version")).longValue()).isEqualTo(v + 1);
    Map<String, Object> stored = task(giulia.token(), p, piante);
    assertThat(stored).containsEntry("title", PIANTE_BALCONE);
    assertThat(version(stored)).isEqualTo(v + 1);
    assertThat(changeLog(piante)).hasSize(logRows);

    Response replay = updateV(marco.token(), p, piante, marcoMutation, PIANTE_BALCONE, v);
    assertOk(replay);
    assertThat(version(replay)).as("replay before version").isEqualTo(v + 1);
    assertThat(changeLog(piante)).hasSize(logRows);

    Response web = updateV(giulia.token(), p, piante, id(), PIANTE_GIARDINO, null);
    assertOk(web);
    assertThat(version(web)).as("no version: decision 38").isEqualTo(v + 2);
  }

  @Test
  void twoPutsAtOnceWithTheSameVersionGiveOneWinner() throws Exception {
    Families f = families();
    User giulia = f.giulia();
    User marco = f.marco();
    String p = f.principale();
    String piante = taskOk(giulia.token(), p, PIANTE);
    long v = version(task(giulia.token(), p, piante));

    List<Response> answers =
        together(
            () -> updateV(marco.token(), p, piante, id(), PIANTE_BALCONE, v),
            () -> updateV(giulia.token(), p, piante, id(), PIANTE_GIARDINO, v));
    assertThat(statuses(answers)).containsExactlyInAnyOrder(200, 409);
    Response loser = answers.get(0).status() == 409 ? answers.get(0) : answers.get(1);
    assertThat(loser.error()).isEqualTo("version_conflict");
    assertThat(version(task(giulia.token(), p, piante))).isEqualTo(v + 1);
  }

  @Test
  void takingAtOnceGivesAlreadyTakenWithTheNameOfTheWinner() throws Exception {
    Families f = families();
    User giulia = f.giulia();
    User marco = f.marco();
    String p = f.principale();
    String piante = taskOk(giulia.token(), p, PIANTE);

    List<Response> answers =
        together(() -> take(marco.token(), p, piante), () -> take(giulia.token(), p, piante));
    assertThat(statuses(answers)).containsExactlyInAnyOrder(200, 409);
    Response loser = answers.get(0).status() == 409 ? answers.get(0) : answers.get(1);
    String winner = loser == answers.get(0) ? "Giulia" : "Marco";
    assertError(loser, 409, "already_taken");
    assertThat((String) loser.json("$.assigneeName")).isEqualTo(winner);
  }

  @Test
  void aQueuedWriteThatIsNoLongerAllowedIsRefusedWhateverItsVersion() throws Exception {
    Families f = families();
    String m = f.mamma();
    User luca = f.luca();
    String pranzo = taskOk(f.anna().token(), m, PRANZO);
    assertOk(take(luca.token(), m, pranzo));
    long v = version(task(luca.token(), m, pranzo));
    assertOk(setAssignee(f.anna().token(), m, pranzo, f.pietro().personId()));

    assertThat(setAssignee(luca.token(), m, pranzo, null).status()).isEqualTo(403);
    Response edit = updateV(luca.token(), m, pranzo, id(), "Prenotare il pranzo di Capodanno", v);
    assertThat(edit.status()).as("permissions before version: " + edit.body()).isEqualTo(403);

    Map<String, Object> row = rowOf(changesOk(f.anna().token(), m, 0, null).changes(), pranzo);
    assertUpsert(row, "task");
    assertThat(data(row))
        .containsEntry("title", PRANZO)
        .containsEntry("assigneePersonId", f.pietro().personId());
  }

  @Test
  void theNextQueuedWriteIsJudgedOnTheTrueState() throws Exception {
    Families f = families();
    String m = f.mamma();
    User luca = f.luca();
    String bici = taskOk(luca.token(), m, BIKE);
    assertOk(take(luca.token(), m, bici));
    long v = version(task(luca.token(), m, bici));
    assertOk(setAssignee(f.anna().token(), m, bici, f.pietro().personId()));

    assertThat(setAssignee(luca.token(), m, bici, null).status()).isEqualTo(403);
    String title = BIKE + " di Nina";
    Response stale = updateV(luca.token(), m, bici, id(), title, v);
    assertError(stale, 409, "version_conflict");
    long current = ((Number) stale.json("$.current.version")).longValue();
    assertThat(current).isEqualTo(v + 1);
    assertThat((String) stale.json("$.current.assigneePersonId")).isEqualTo(f.pietro().personId());

    Response again = updateV(luca.token(), m, bici, id(), title, current);
    assertOk(again);
    assertThat(task(f.anna().token(), m, bici)).containsEntry("title", title);
  }
}
