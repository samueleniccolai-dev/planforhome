package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 011, T5 part 3: P9 of SPEC 5. A manager edits and cancels any task; a member only his own
 * (created by him or assigned to him). Since round 042 the PUT is partial: a field left out keeps
 * its value, a field sent as null is empty (no notes, no due date, criticality NORMAL). Only an
 * open task is edited or cancelled (409 {@code not_open}). Every write is idempotent and adds a
 * change_log row.
 */
class Giro011EditCancelAcceptanceTest extends Giro011AcceptanceSupport {

  private static final String PIANTE_BALCONE = "Annaffiare le piante del balcone";

  // ---------------------------------------------------------------- P9 edit allowed

  @Test
  void p9DavideEditsHisOwnTask() throws Exception {
    Mamma m = mamma();
    String piante = piante(m);

    Response edited =
        update(
            m.davide().token(),
            m.id(),
            piante,
            id(),
            "title",
            PIANTE_BALCONE,
            "notes",
            "Anche il basilico",
            "dueKind",
            "DATE",
            "due",
            "2026-11-09",
            "criticality",
            "HIGH");

    assertOk(edited);
    assertThat((String) edited.json("$.title")).isEqualTo(PIANTE_BALCONE);
    assertThat((String) edited.json("$.notes")).isEqualTo("Anche il basilico");
    assertThat((String) edited.json("$.dueKind")).isEqualTo("DATE");
    assertThat((String) edited.json("$.due")).isEqualTo("2026-11-09");
    assertThat((String) edited.json("$.criticality")).isEqualTo("HIGH");
    assertThat((String) edited.json("$.assigneePersonId")).isEqualTo(m.davide().personId());
    assertThat(version(edited)).isEqualTo(2);
    assertState(m, piante, "OPEN", 2, 2);
    assertThat(task(m.anna().token(), m.id(), piante))
        .containsEntry("title", PIANTE_BALCONE)
        .containsEntry("criticality", "HIGH")
        .containsEntry("due", "2026-11-09");
  }

  @Test
  void p9AMemberEditsATaskHeCreatedThoughAManagerGaveItToLuca() throws Exception {
    Mamma m = mamma();
    String latte = taskOk(m.davide().token(), m.id(), LATTE);
    assertOk(setAssignee(m.anna().token(), m.id(), latte, m.luca().personId()));

    Response edited = update(m.davide().token(), m.id(), latte, id(), "title", LATTE + " intero");

    assertOk(edited);
    assertThat((String) edited.json("$.title")).isEqualTo(LATTE + " intero");
    assertThat((String) edited.json("$.assigneePersonId")).isEqualTo(m.luca().personId());
    assertState(m, latte, "OPEN", 3, 3);
  }

  @Test
  void p9AMemberEditsATaskAssignedToHimThatAManagerCreated() throws Exception {
    Mamma m = mamma();
    String bolletta = taskOk(m.anna().token(), m.id(), BOLLETTA, m.luca().personId());

    Response edited =
        update(
            m.luca().token(),
            m.id(),
            bolletta,
            id(),
            "title",
            BOLLETTA,
            "dueKind",
            "DATETIME",
            "due",
            "2026-11-09T18:00:00Z");

    assertOk(edited);
    assertThat((String) edited.json("$.dueKind")).isEqualTo("DATETIME");
    assertThat((String) edited.json("$.due")).isEqualTo("2026-11-09T18:00:00Z");
    assertState(m, bolletta, "OPEN", 2, 2);
  }

  @Test
  void p9AManagerEditsATaskOfPaolo() throws Exception {
    Mamma m = mamma();
    String pane = pane(m);

    assertOk(update(m.anna().token(), m.id(), pane, id(), "title", PANE + " integrale"));

    assertThat(task(m.anna().token(), m.id(), pane)).containsEntry("title", PANE + " integrale");
    assertState(m, pane, "OPEN", 2, 2);
  }

  @Test
  void thePutWithExplicitNullsEmptiesTheFields() throws Exception {
    Mamma m = mamma();
    String bolletta = id();
    Response created =
        createTask(
            m.anna().token(),
            m.id(),
            id(),
            "id",
            bolletta,
            "title",
            BOLLETTA,
            "notes",
            "Entro fine mese",
            "dueKind",
            "DATE",
            "due",
            "2026-11-30",
            "criticality",
            "HIGH");
    assertThat(created.status()).as(created.body()).isEqualTo(201);

    Response edited =
        update(
            m.anna().token(),
            m.id(),
            bolletta,
            id(),
            "title",
            BOLLETTA,
            "notes",
            null,
            "dueKind",
            null,
            "due",
            null,
            "criticality",
            null);

    assertOk(edited);
    assertThat((Object) edited.json("$.notes")).isNull();
    assertThat((Object) edited.json("$.dueKind")).isNull();
    assertThat((Object) edited.json("$.due")).isNull();
    assertThat((String) edited.json("$.criticality")).isEqualTo("NORMAL");
    assertState(m, bolletta, "OPEN", 2, 2);
  }

  // ---------------------------------------------------------------- P9 cancel allowed

  @Test
  void p9AManagerCancelsATaskOfPaolo() throws Exception {
    Mamma m = mamma();
    String pane = pane(m);

    Response cancelled = cancel(m.anna().token(), m.id(), pane);

    assertOk(cancelled);
    assertThat((String) cancelled.json("$.status")).isEqualTo("CANCELLED");
    assertThat(version(cancelled)).isEqualTo(2);
    assertState(m, pane, "CANCELLED", 2, 2);
  }

  @Test
  void p9AMemberCancelsHisOwnTask() throws Exception {
    Mamma m = mamma();
    String piante = piante(m);

    assertOk(cancel(m.davide().token(), m.id(), piante));

    assertState(m, piante, "CANCELLED", 2, 2);
  }

  // ---------------------------------------------------------------- P9 refused

  @Test
  void p9AMemberDoesNotEditOrCancelATaskOfOthers() throws Exception {
    Mamma m = mamma();
    String piante = piante(m);
    String bolletta = bolletta(m);

    assertError(update(m.luca().token(), m.id(), piante, id(), "title", "Altro"), 403, "forbidden");
    assertError(cancel(m.luca().token(), m.id(), piante), 403, "forbidden");
    assertError(
        update(m.luca().token(), m.id(), bolletta, id(), "title", "Altro"), 403, "forbidden");
    assertError(cancel(m.luca().token(), m.id(), bolletta), 403, "forbidden");

    assertState(m, piante, "OPEN", 1, 1);
    assertState(m, bolletta, "OPEN", 1, 1);
    assertThat(task(m.anna().token(), m.id(), piante)).containsEntry("title", PIANTE);
  }

  @Test
  void onlyAnOpenTaskIsEditedOrCancelled() throws Exception {
    Mamma m = mamma();
    String piante = piante(m);
    assertOk(done(m.davide().token(), m.id(), piante));
    String pane = pane(m);
    assertOk(cancel(m.paolo().token(), m.id(), pane));

    assertError(update(m.davide().token(), m.id(), piante, id(), "title", "X"), 409, "not_open");
    assertError(cancel(m.davide().token(), m.id(), piante), 409, "not_open");
    assertError(update(m.anna().token(), m.id(), pane, id(), "title", "X"), 409, "not_open");
    assertError(cancel(m.anna().token(), m.id(), pane), 409, "not_open");

    assertState(m, piante, "DONE", 2, 2);
    assertState(m, pane, "CANCELLED", 2, 2);
  }

  // ---------------------------------------------------------------- body

  @Test
  void aBadBodyIsRefusedWithoutEffects() throws Exception {
    Mamma m = mamma();
    String piante = piante(m);
    String token = m.davide().token();

    assertError(update(token, m.id(), piante, id(), "title", "   "), 400, "title_invalid");
    assertError(update(token, m.id(), piante, id(), "title", null), 400, "title_invalid");
    assertError(updateRaw(token, m.id(), piante, "{}"), 400, "invalid_request");
    assertError(update(token, m.id(), piante, null, "title", PIANTE), 400, "invalid_request");
    assertError(
        update(token, m.id(), piante, id(), "title", PIANTE, "criticality", "URGENT"),
        400,
        "criticality_invalid");
    assertError(
        update(
            token, m.id(), piante, id(), "title", PIANTE, "dueKind", "DATE", "due", "2026-13-01"),
        400,
        "due_invalid");

    assertState(m, piante, "OPEN", 1, 1);
  }

  // ---------------------------------------------------------------- idempotence

  @Test
  void editAndCancelRepeatedWithTheSameMutationIdApplyOnce() throws Exception {
    Mamma m = mamma();
    String piante = piante(m);
    String edit = id();

    assertOk(update(m.davide().token(), m.id(), piante, edit, "title", PIANTE_BALCONE));
    Response again = update(m.davide().token(), m.id(), piante, edit, "title", PIANTE_BALCONE);
    assertOk(again);
    assertThat(version(again)).isEqualTo(2);
    assertState(m, piante, "OPEN", 2, 2);

    String stop = id();
    assertOk(cancel(m.davide().token(), m.id(), piante, stop));
    Response cancelAgain = cancel(m.davide().token(), m.id(), piante, stop);
    assertOk(cancelAgain);
    assertThat(version(cancelAgain)).isEqualTo(3);
    assertThat((String) cancelAgain.json("$.status")).isEqualTo("CANCELLED");
    assertState(m, piante, "CANCELLED", 3, 3);
  }

  @Test
  void aMutationIdOfAnEditReusedElsewhereIsAConflict() throws Exception {
    Mamma m = mamma();
    String piante = piante(m);
    String pane = pane(m);
    String mutation = id();
    assertOk(update(m.davide().token(), m.id(), piante, mutation, "title", PIANTE_BALCONE));

    assertError(cancel(m.davide().token(), m.id(), piante, mutation), 409, "mutation_conflict");
    assertError(
        update(m.anna().token(), m.id(), pane, mutation, "title", PANE), 409, "mutation_conflict");
    assertError(
        update(m.anna().token(), m.id(), piante, mutation, "title", PIANTE_BALCONE),
        409,
        "mutation_conflict");

    assertState(m, piante, "OPEN", 2, 2);
    assertState(m, pane, "OPEN", 1, 1);
    Map<String, Object> untouched = task(m.anna().token(), m.id(), pane);
    assertThat(untouched).containsEntry("title", PANE);
  }
}
