package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/**
 * Round 016, T7, rule 1 of CLAUDE.md: the parametric isolation test of the new endpoint. A person
 * never moves a task of a family that is not hers, nor into a family that is not hers, with the
 * {@code id} of the family or of the task in the URL or the {@code toFamilyId} in the body: 404
 * {@code not_found}, no change to the task, no {@code applied_mutation}, no event, no change_log
 * row. Then the legitimate forward of the same task works, and the change log tells the move to the
 * two families involved only (the sync of a third family sees nothing).
 *
 * <p>Same application context as rounds 003 to 011: no clock is needed here.
 */
class Giro016ForwardIsolationAcceptanceTest extends Giro016AcceptanceSupport {

  record Attempt(String taskId, String familyId, String mutationId, Response response) {}

  private Attempt attempt(String kind, World w, String foto) throws Exception {
    String mutation = id();
    return switch (kind) {
      // Marco is in Principale and Babbo; the task of Babbo with Principale in the URL.
      case "task-of-another-family-in-the-url" -> {
        String siepe = taskOk(w.marco().token(), w.babbo(), SIEPE, w.marco().personId());
        yield new Attempt(
            siepe,
            w.babbo(),
            mutation,
            forward(w.marco().token(), w.principale(), siepe, mutation, w.principale()));
      }
      // Rosa is only in Babbo: Principale in the URL.
      case "stranger-with-the-family-in-the-url" ->
          new Attempt(
              foto,
              w.principale(),
              mutation,
              forward(w.rosa().token(), w.principale(), foto, mutation, w.babbo()));
      // Rosa is only in Babbo: her own family in the URL, the task of Principale.
      case "stranger-with-her-own-family-in-the-url" ->
          new Attempt(
              foto,
              w.principale(),
              mutation,
              forward(w.rosa().token(), w.babbo(), foto, mutation, w.principale()));
      // Giulia is not in Babbo: the family of arrival in the body is not hers.
      case "family-of-arrival-not-mine" ->
          new Attempt(
              foto,
              w.principale(),
              mutation,
              forward(w.giulia().token(), w.principale(), foto, mutation, w.babbo()));
      // A family of arrival that does not exist.
      case "family-of-arrival-unknown" ->
          new Attempt(
              foto,
              w.principale(),
              mutation,
              forward(w.giulia().token(), w.principale(), foto, mutation, id()));
      // Luca is only in Mamma: his own task, towards Principale.
      case "member-of-the-departure-only" -> {
        String latte = taskOk(w.luca().token(), w.mamma(), LATTE, w.luca().personId());
        yield new Attempt(
            latte,
            w.mamma(),
            mutation,
            forward(w.luca().token(), w.mamma(), latte, mutation, w.principale()));
      }
      default -> throw new IllegalArgumentException(kind);
    };
  }

  @ParameterizedTest(name = "{0}")
  @ValueSource(
      strings = {
        "task-of-another-family-in-the-url",
        "stranger-with-the-family-in-the-url",
        "stranger-with-her-own-family-in-the-url",
        "family-of-arrival-not-mine",
        "family-of-arrival-unknown",
        "member-of-the-departure-only"
      })
  void aForwardOutsideMyFamiliesIs404AndLeavesNoTrace(String kind) throws Exception {
    World w = world();
    String foto = foto(w);

    Attempt attempt = attempt(kind, w, foto);

    assertError(attempt.response(), 404, "not_found");
    assertUntouched(attempt.taskId(), attempt.familyId(), 1, 1);
    assertThat(appliedRows(attempt.mutationId())).as("applied_mutation of the attempt").isZero();

    // The legitimate forward of «Ritirare le foto» works: the 404 was about the caller.
    assertForwarded(forward(w.giulia().token(), w.principale(), foto, w.mamma()), w.mamma(), 2);
    assertThat(events(foto)).as("events of the forwarded task").hasSize(1);
    if (!attempt.taskId().equals(foto)) {
      assertThat(events(attempt.taskId())).as("events of the refused task").isEmpty();
      assertUntouched(attempt.taskId(), attempt.familyId(), 1, 1);
    }
    List<Map<String, Object>> log = changeLog(foto);
    assertThat(log)
        .containsExactly(
            row(w.principale(), "UPSERT"), row(w.principale(), "DELETE"), row(w.mamma(), "UPSERT"));
    assertThat(log)
        .as("nothing in the change log of Babbo")
        .noneMatch(r -> w.babbo().equals(r.get("family_id")));
  }
}
