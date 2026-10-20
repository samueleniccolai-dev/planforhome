package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 011: the new endpoints (done, reopen, PUT, cancel) never reach a task of another family.
 * Giulia manages her Famiglia Principale and is a member of Famiglia Mamma: a task of Mamma through
 * the URL of Principale is not found, exactly like a task that does not exist, and nothing changes.
 * Rosa, of Famiglia Babbo only, gets the same 404 with the URL of Mamma and with the URL of Babbo.
 * The parametric test of round 003 covers strangers on every endpoint.
 */
class Giro011TaskIsolationAcceptanceTest extends Giro011AcceptanceSupport {

  private interface Call {
    Response on(String token, String familyId, String taskId) throws Exception;
  }

  private final Map<String, Call> calls =
      Map.of(
          "done", this::done,
          "reopen", this::reopen,
          "update", (token, f, t) -> update(token, f, t, id(), "title", "Rubato"),
          "cancel", this::cancel);

  @Test
  void aTaskOfMammaThroughTheUrlOfPrincipaleIsNotFound() throws Exception {
    Mamma m = mamma();
    User giulia = founder("Giulia", PRINCIPALE);
    joinOk(giulia, invite(m.anna().token(), m.id()));
    String principale = giulia.familyId();
    String pane = pane(m);
    String done = taskOk(m.anna().token(), m.id(), BOLLETTA);
    assertOk(done(m.anna().token(), m.id(), done));
    String missing = id();

    for (Map.Entry<String, Call> call : calls.entrySet()) {
      for (String taskId : List.of(pane, done)) {
        Response other = call.getValue().on(giulia.token(), principale, taskId);
        Response none = call.getValue().on(giulia.token(), principale, missing);
        assertThat(other.status()).as(call.getKey() + ": " + other.body()).isEqualTo(404);
        assertThat(other.body()).as(call.getKey()).isEqualTo(none.body());
      }
    }

    assertState(m, pane, "OPEN", 1, 1);
    assertState(m, done, "DONE", 2, 2);
    assertThat(task(m.anna().token(), m.id(), pane)).containsEntry("title", PANE);
    assertThat(tasks(giulia.token(), principale)).isEmpty();
  }

  @Test
  void rosaOfBabboFindsNoTaskOfMammaWithEitherUrl() throws Exception {
    Mamma m = mamma();
    User rosa = founder("Rosa", BABBO);
    String pane = pane(m);
    String done = taskOk(m.anna().token(), m.id(), BOLLETTA);
    assertOk(done(m.anna().token(), m.id(), done));
    String missing = id();

    for (Map.Entry<String, Call> call : calls.entrySet()) {
      for (String taskId : List.of(pane, done)) {
        Response viaMamma = call.getValue().on(rosa.token(), m.id(), taskId);
        Response viaBabbo = call.getValue().on(rosa.token(), rosa.familyId(), taskId);
        Response none = call.getValue().on(rosa.token(), rosa.familyId(), missing);
        assertThat(viaMamma.status()).as(call.getKey() + ": " + viaMamma.body()).isEqualTo(404);
        assertThat(viaBabbo.status()).as(call.getKey() + ": " + viaBabbo.body()).isEqualTo(404);
        assertThat(viaMamma.body()).as(call.getKey()).isEqualTo(none.body());
        assertThat(viaBabbo.body()).as(call.getKey()).isEqualTo(none.body());
      }
    }

    assertState(m, pane, "OPEN", 1, 1);
    assertState(m, done, "DONE", 2, 2);
  }
}
