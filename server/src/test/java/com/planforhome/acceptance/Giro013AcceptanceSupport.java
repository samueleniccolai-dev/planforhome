package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Round 013, T6 part 1: what the acceptance tests of recurring tasks share. The people have the
 * names of Appendix A, but every test registers its own accounts and families (as in rounds 008 and
 * 011): the demo families are never written here.
 *
 * <p>The dates matter, so each concrete class declares a {@code @SpringBootTest} of its own (an
 * extra property makes the configuration different): it gets an application context of its own and
 * so an {@link AcceptanceClock} of its own, which no other class moves. Inside a class the tests
 * run in a fixed order and move the clock forward only ({@link #at}). The database is the
 * PostgreSQL of round 003: these classes only create new families, they never write demo rows.
 *
 * <p>Famiglia Principale (Europe/Rome, the default zone): Giulia and Marco managers; Paolo and Luca
 * members; Leo a resource without account, referent Giulia.
 */
abstract class Giro013AcceptanceSupport extends Giro011AcceptanceSupport {

  static final String ZIO = "Famiglia Zio";

  static final String CANE = "Portare fuori il cane";
  static final String PIANTE_3 = "Annaffiare le piante";
  static final String FRIGO = "Pulire il frigo";
  static final String AFFITTO = "Pagare l'affitto";
  static final String GATTO = "Dare la medicina al gatto";
  static final String LENZUOLA = "Cambiare le lenzuola";
  static final String ZAINO = "Preparare lo zaino";

  static final String DAILY = "{\"type\":\"DAILY\"}";

  record Principale(String id, User giulia, User marco, User paolo, User luca, String leo) {}

  Principale principale() throws Exception {
    User giulia = founder("Giulia", PRINCIPALE);
    String p = giulia.familyId();
    User marco = withCode("Marco", invite(giulia.token(), p));
    setRoleOk(giulia.token(), p, marco.personId(), "MANAGER");
    User paolo = withCode("Paolo", invite(giulia.token(), p));
    User luca = withCode("Luca", invite(giulia.token(), p));
    String leo = resourceOk(giulia.token(), p, "Leo", giulia.personId());
    return new Principale(p, giulia, marco, paolo, luca, leo);
  }

  /** Moves the acceptance clock of this class forward to {@code instant} (ISO, UTC). */
  void at(String instant) {
    clock.setTo(Instant.parse(instant));
  }

  // ---------------------------------------------------------------- writes with a recurrence

  /**
   * POST of a task with a raw JSON {@code recurrence} (an object, {@code null}, or anything else
   * the test wants to send). Null {@code dueKind}, {@code due} or {@code assignee} are left out.
   */
  Response createRecurring(
      String token,
      String familyId,
      String taskId,
      String title,
      String dueKind,
      String due,
      String recurrenceJson,
      String assignee)
      throws Exception {
    List<String> fields = new ArrayList<>();
    fields.add("\"mutationId\":" + quote(id()));
    fields.add("\"id\":" + quote(taskId));
    fields.add("\"title\":" + quote(title));
    if (dueKind != null) fields.add("\"dueKind\":" + quote(dueKind));
    if (due != null) fields.add("\"due\":" + quote(due));
    if (assignee != null) fields.add("\"assigneePersonId\":" + quote(assignee));
    fields.add("\"recurrence\":" + recurrenceJson);
    return send(
        "POST",
        "/api/families/" + familyId + "/tasks",
        token,
        "{" + String.join(",", fields) + "}");
  }

  /** Creates a recurring task and returns its id; fails with an assertion if refused. */
  String recurringOk(
      String token,
      String familyId,
      String title,
      String dueKind,
      String due,
      String recurrenceJson,
      String assignee)
      throws Exception {
    String taskId = id();
    Response created =
        createRecurring(token, familyId, taskId, title, dueKind, due, recurrenceJson, assignee);
    assertThat(created.status()).as("task " + title + ": " + created.body()).isEqualTo(201);
    return taskId;
  }

  Response endSeries(String token, String familyId, String taskId, String mutationId)
      throws Exception {
    return send(
        "POST",
        "/api/families/" + familyId + "/tasks/" + taskId + "/end-series",
        token,
        body(mutationId));
  }

  Response endSeries(String token, String familyId, String taskId) throws Exception {
    return endSeries(token, familyId, taskId, id());
  }

  // ---------------------------------------------------------------- reads

  /** All the tasks of the series of {@code seriesId}, as {@code token} sees the family. */
  List<Map<String, Object>> series(String token, String familyId, String seriesId)
      throws Exception {
    return tasks(token, familyId).stream().filter(t -> seriesId.equals(t.get("seriesId"))).toList();
  }

  List<Map<String, Object>> openInSeries(String token, String familyId, String seriesId)
      throws Exception {
    return series(token, familyId, seriesId).stream()
        .filter(t -> "OPEN".equals(t.get("status")))
        .toList();
  }

  /**
   * The only OPEN task of the series, other than {@code previousId}: the next occurrence. It has
   * version 1, one UPSERT in the change log of the family, and the same series.
   */
  Map<String, Object> nextOf(String token, String familyId, String seriesId, String previousId)
      throws Exception {
    List<Map<String, Object>> open =
        openInSeries(token, familyId, seriesId).stream()
            .filter(t -> !previousId.equals(t.get("id")))
            .toList();
    assertThat(open).as("open next occurrences of series " + seriesId).hasSize(1);
    Map<String, Object> next = open.get(0);
    assertThat(next.get("seriesId")).isEqualTo(seriesId);
    assertThat(version(next)).as(String.valueOf(next)).isEqualTo(1L);
    assertThat(changeLog((String) next.get("id")))
        .containsExactly(Map.of("family_id", familyId, "entity", "task", "op", "UPSERT"));
    return next;
  }

  /** The recurrence of the task: fails with an assertion if it is missing or not an object. */
  static Map<?, ?> rule(Map<String, Object> task) {
    Object recurrence = task.get("recurrence");
    assertThat(recurrence).as("recurrence of " + task).isInstanceOf(Map.class);
    return (Map<?, ?>) recurrence;
  }

  static String recurrenceType(Map<String, Object> task) {
    return (String) rule(task).get("type");
  }

  /** A JSON array read by JsonPath, as the list of strings the test expects it to be. */
  @SuppressWarnings("unchecked")
  static List<String> strings(Object jsonArray) {
    assertThat(jsonArray).isInstanceOf(List.class);
    return (List<String>) jsonArray;
  }

  /** A DATETIME due, compared as an instant (the text may or may not carry seconds). */
  static Instant dueInstant(Map<String, Object> task) {
    assertThat(task.get("dueKind")).as(String.valueOf(task)).isEqualTo("DATETIME");
    return Instant.parse((String) task.get("due"));
  }
}
