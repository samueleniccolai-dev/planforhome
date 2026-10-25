package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 042, T11 (docs/lab/giri/042-piano.md, defect 1 of hunt 040): the PUT of a task is partial.
 * A field left out of the body keeps its value; a field sent as {@code null} empties it ({@code
 * notes}, the pair {@code dueKind} + {@code due}) or brings it back to the default ({@code
 * criticality} to {@code NORMAL}); {@code title: null} is refused ({@code title_invalid}). Only one
 * of {@code dueKind} and {@code due} is {@code due_invalid}. A recurring task keeps its due and the
 * local time of its rule; it cannot lose the due ({@code recurrence_needs_due}). The replay of the
 * same {@code mutationId} gives the same answer and raises the version once. The change reaches the
 * sync pull with the kept fields. Isolation: a person of another family gets 404 with the id in the
 * URL of either family, and nothing changes.
 *
 * <p>Demo data of the plan: Famiglia Bruni (Europe/Rome) with Lia (manager) and Tommaso (member);
 * Famiglia Ferraro with Ugo (manager), not in Bruni. Every test registers its own accounts (unique
 * e-mail addresses), as since round 008. The only reads that are not HTTP: the change_log rows of a
 * task, always after an assertion on an HTTP answer.
 */
class Giro042PartialUpdateAcceptanceTest extends Giro023SyncAcceptanceSupport {

  static final String BRUNI = "Famiglia Bruni";
  static final String FERRARO = "Famiglia Ferraro";
  static final String GAS_042 = "Pagare la bolletta del gas";
  static final String LUCE_042 = "Pagare la bolletta della luce";
  static final String GAS_NOTES = "Codice cliente 4471";
  static final String GAS_DUE = "2026-11-03";
  static final String BASILICO = "Annaffiare il basilico";
  static final String BASILICO_BALCONE = "Annaffiare il basilico sul balcone";
  static final String BASILICO_DUE = "2026-11-02";
  static final String BAMBINI = "Ritirare i bambini";
  static final String BAMBINI_SCUOLA = "Ritirare i bambini a scuola";

  /** Monday 2 November 2026, 18:00 in Rome (CET, UTC+1). */
  static final String BAMBINI_DUE = "2026-11-02T17:00:00Z";

  static final String WEEKLY_MONDAY = "{\"type\":\"WEEKLY\",\"days\":[\"MONDAY\"]}";
  static final ZoneId ROME_ZONE = ZoneId.of(ROME);

  record Bruni(String id, User lia, User tommaso) {}

  Bruni bruni() throws Exception {
    User lia = founder("Lia", BRUNI);
    User tommaso = withCode("Tommaso", invite(lia.token(), lia.familyId()));
    return new Bruni(lia.familyId(), lia, tommaso);
  }

  /** «Pagare la bolletta del gas»: notes, HIGH, DATE 2026-11-03, created by Lia, in the queue. */
  String gas(Bruni b) throws Exception {
    String taskId = id();
    Response created =
        createTask(
            b.lia().token(),
            b.id(),
            id(),
            "id",
            taskId,
            "title",
            GAS_042,
            "notes",
            GAS_NOTES,
            "dueKind",
            "DATE",
            "due",
            GAS_DUE,
            "criticality",
            "HIGH");
    assertThat(created.status()).as("task " + GAS_042 + ": " + created.body()).isEqualTo(201);
    return taskId;
  }

  Map<String, Object> asLia(Bruni b, String taskId) throws Exception {
    return task(b.lia().token(), b.id(), taskId);
  }

  static void assertGasKept(Map<String, Object> task) {
    assertThat(task)
        .as(String.valueOf(task))
        .containsEntry("notes", GAS_NOTES)
        .containsEntry("criticality", "HIGH")
        .containsEntry("dueKind", "DATE")
        .containsEntry("due", GAS_DUE);
  }

  // ---------------------------------------------------------------- A1 a field left out is kept

  @Test
  void a1APutWithOnlyTheTitleKeepsNotesCriticalityAndDue() throws Exception {
    Bruni b = bruni();
    String gas = gas(b);

    Response edited = update(b.lia().token(), b.id(), gas, id(), "title", LUCE_042);

    assertOk(edited);
    Map<String, Object> answer = edited.json("$");
    assertThat(answer).containsEntry("title", LUCE_042);
    assertGasKept(answer);
    assertThat(version(edited)).isEqualTo(2);
    Map<String, Object> read = asLia(b, gas);
    assertThat(read).containsEntry("title", LUCE_042);
    assertGasKept(read);
    assertState(b, gas, 2);
  }

  @Test
  void a1TheSyncPullCarriesThePartialChangeWithTheKeptFields() throws Exception {
    Bruni b = bruni();
    String gas = gas(b);
    long before = seqOk(b.lia().token(), b.id());

    assertOk(update(b.lia().token(), b.id(), gas, id(), "title", LUCE_042));

    Page page = changesOk(b.tommaso().token(), b.id(), before, null);
    Map<String, Object> row = rowOf(page.changes(), gas);
    assertUpsert(row, "task");
    Map<String, Object> data = data(row);
    assertThat(data)
        .as(String.valueOf(data))
        .containsEntry("title", LUCE_042)
        .containsEntry("notes", GAS_NOTES)
        .containsEntry("criticality", "HIGH")
        .containsEntry("dueKind", "DATE");
    assertThat(data.get("dueAt")).as("dueAt in the pull").isInstanceOf(String.class);
    assertThat(Instant.parse((String) data.get("dueAt")))
        .as("midnight of 3 November 2026 in Rome")
        .isEqualTo(Instant.parse("2026-11-02T23:00:00Z"));
    assertThat(number(data.get("version"))).as("version +1 in the pull").isEqualTo(2);
  }

  // ---------------------------------------------------------------- A2 notes: null empties them

  @Test
  void a2NotesNullEmptiesTheNotesAndKeepsTheRest() throws Exception {
    Bruni b = bruni();
    String gas = gas(b);

    Response edited = update(b.lia().token(), b.id(), gas, id(), "notes", null);

    assertOk(edited);
    Map<String, Object> read = asLia(b, gas);
    assertThat(read).as(String.valueOf(read)).containsEntry("title", GAS_042);
    assertThat(read.get("notes")).as("notes after notes: null").isNull();
    assertThat(read)
        .containsEntry("criticality", "HIGH")
        .containsEntry("dueKind", "DATE")
        .containsEntry("due", GAS_DUE);
    assertState(b, gas, 2);
  }

  // ---------------------------------------------------------------- A3 the due pair: null empties

  @Test
  void a3DueKindAndDueNullLeaveTheTaskWithoutADue() throws Exception {
    Bruni b = bruni();
    String gas = gas(b);

    Response edited = update(b.lia().token(), b.id(), gas, id(), "dueKind", null, "due", null);

    assertOk(edited);
    Map<String, Object> read = asLia(b, gas);
    assertThat(read.get("dueKind")).as("dueKind of " + read).isNull();
    assertThat(read.get("due")).as("due of " + read).isNull();
    assertThat(read)
        .containsEntry("title", GAS_042)
        .containsEntry("notes", GAS_NOTES)
        .containsEntry("criticality", "HIGH");
    assertState(b, gas, 2);
  }

  @Test
  void a3OnlyOneOfDueKindAndDueIsRefusedAndNothingChanges() throws Exception {
    Bruni b = bruni();
    String gas = gas(b);
    String lia = b.lia().token();

    assertError(update(lia, b.id(), gas, id(), "due", "2026-11-10"), 400, "due_invalid");
    assertError(update(lia, b.id(), gas, id(), "dueKind", "DATE"), 400, "due_invalid");
    assertError(update(lia, b.id(), gas, id(), "dueKind", null), 400, "due_invalid");

    Map<String, Object> read = asLia(b, gas);
    assertThat(read).containsEntry("title", GAS_042);
    assertGasKept(read);
    assertState(b, gas, 1);
  }

  // ---------------------------------------------------------------- A4 criticality and title

  @Test
  void a4CriticalityNullGoesBackToNormalAndTitleNullIsRefused() throws Exception {
    Bruni b = bruni();
    String gas = gas(b);
    String lia = b.lia().token();

    assertOk(update(lia, b.id(), gas, id(), "criticality", null));
    Map<String, Object> normal = asLia(b, gas);
    assertThat(normal)
        .as(String.valueOf(normal))
        .containsEntry("criticality", "NORMAL")
        .containsEntry("title", GAS_042)
        .containsEntry("notes", GAS_NOTES)
        .containsEntry("dueKind", "DATE")
        .containsEntry("due", GAS_DUE);
    assertState(b, gas, 2);

    assertError(update(lia, b.id(), gas, id(), "title", null), 400, "title_invalid");
    assertThat(asLia(b, gas)).isEqualTo(normal);
    assertState(b, gas, 2);
  }

  // ---------------------------------------------------------------- A5 recurring tasks

  @Test
  void a5ARecurringDateTaskKeepsDueAndRuleAndCannotLoseTheDue() throws Exception {
    Bruni b = bruni();
    String lia = b.lia().token();
    String basilico = recurringOk(lia, b.id(), BASILICO, "DATE", BASILICO_DUE, WEEKLY_MONDAY, null);
    Map<?, ?> ruleBefore = rule(asLia(b, basilico));

    assertOk(update(lia, b.id(), basilico, id(), "title", BASILICO_BALCONE));

    Map<String, Object> read = asLia(b, basilico);
    assertThat(read)
        .as(String.valueOf(read))
        .containsEntry("title", BASILICO_BALCONE)
        .containsEntry("dueKind", "DATE")
        .containsEntry("due", BASILICO_DUE);
    assertThat(rule(read)).isEqualTo(ruleBefore);

    assertError(
        update(lia, b.id(), basilico, id(), "dueKind", null, "due", null),
        400,
        "recurrence_needs_due");
    assertThat(asLia(b, basilico)).isEqualTo(read);
    assertState(b, basilico, 2);
  }

  @Test
  void a5ARecurringDatetimeTaskKeepsSixPmAfterAPutWithOnlyTheTitleAndInTheNextOccurrence()
      throws Exception {
    Bruni b = bruni();
    String lia = b.lia().token();
    String bambini =
        recurringOk(
            lia, b.id(), BAMBINI, "DATETIME", BAMBINI_DUE, WEEKLY_MONDAY, b.lia().personId());
    assertThat(rule(asLia(b, bambini)).get("time")).isEqualTo("18:00");

    assertOk(update(lia, b.id(), bambini, id(), "title", BAMBINI_SCUOLA));

    Map<String, Object> read = asLia(b, bambini);
    assertThat(read).as(String.valueOf(read)).containsEntry("title", BAMBINI_SCUOLA);
    assertThat(dueInstant(read)).isEqualTo(Instant.parse(BAMBINI_DUE));
    assertThat(rule(read).get("type")).isEqualTo("WEEKLY");
    assertThat(rule(read).get("time"))
        .as("local time of the rule after the PUT")
        .isEqualTo("18:00");

    assertOk(done(lia, b.id(), bambini));
    Map<String, Object> next = nextOf(lia, b.id(), bambini, bambini);
    Instant nextDue = dueInstant(next);
    assertThat(nextDue).isAfter(Instant.parse(BAMBINI_DUE));
    assertThat(nextDue.atZone(ROME_ZONE).toLocalTime())
        .as("next occurrence at 18:00 in Rome")
        .isEqualTo(LocalTime.of(18, 0));
    assertThat(rule(next).get("time")).as("local time of the rule of the next").isEqualTo("18:00");
  }

  // ---------------------------------------------------------------- A6 replay

  @Test
  void a6TheReplayOfAPartialPutGivesTheSameAnswerAndRaisesTheVersionOnce() throws Exception {
    Bruni b = bruni();
    String gas = gas(b);
    String mutation = id();

    Response first = update(b.lia().token(), b.id(), gas, mutation, "title", LUCE_042);
    Response again = update(b.lia().token(), b.id(), gas, mutation, "title", LUCE_042);

    assertOk(first);
    assertOk(again);
    Map<String, Object> firstAnswer = first.json("$");
    Map<String, Object> againAnswer = again.json("$");
    assertThat(againAnswer).isEqualTo(firstAnswer);
    assertGasKept(againAnswer);
    assertThat(version(again)).isEqualTo(2);
    assertState(b, gas, 2);
  }

  // ---------------------------------------------------------------- A7 isolation

  @Test
  void a7UgoOfAnotherFamilyGets404InTheUrlOfEitherFamilyAndNothingChanges() throws Exception {
    Bruni b = bruni();
    String gas = gas(b);
    User ugo = founder("Ugo", FERRARO);
    Map<String, Object> before = asLia(b, gas);

    for (String familyInUrl : new String[] {b.id(), ugo.familyId()}) {
      assertError(update(ugo.token(), familyInUrl, gas, id(), "title", LUCE_042), 404, "not_found");
      assertError(update(ugo.token(), familyInUrl, gas, id(), "notes", null), 404, "not_found");
      assertError(
          update(ugo.token(), familyInUrl, gas, id(), "dueKind", null, "due", null),
          404,
          "not_found");
    }

    assertThat(asLia(b, gas)).isEqualTo(before);
    assertState(b, gas, 1);
    assertThat(appliedMutations(gas)).isEqualTo(1);
  }

  // ---------------------------------------------------------------- checks

  /** Version and change_log rows of the task, as Lia sees it: one row per version. */
  void assertState(Bruni b, String taskId, long version) throws Exception {
    Map<String, Object> task = asLia(b, taskId);
    assertThat(task).as(String.valueOf(task)).containsEntry("status", "OPEN");
    assertThat(version(task)).as(String.valueOf(task)).isEqualTo(version);
    assertThat(changeLog(taskId)).hasSize((int) version);
  }
}
