package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * Round 036, T10: the managers read the reminders of a task ({@code GET
 * /api/families/{f}/tasks/{t}/reminders}), so that round 037 can check {@code reminder.result} from
 * outside. 200 to a manager of the family where the task is now: an array ordered by {@code dueAt},
 * then {@code sentAt} (null last), then {@code id}, whose elements have exactly {@code id}, {@code
 * kind}, {@code dueAt}, {@code sentAt}, {@code result}. 403 {@code forbidden} to a member of that
 * family; 404 {@code not_found} to anyone outside it, or when family or task do not exist, or the
 * task is not in that family (family and task are checked before the role, as for the nudge). 401
 * without authentication. A read only: no {@code change_log} row, no new {@code version}.
 *
 * <p>The context, the clock and the fake FCM are the ones of round 032. Famiglia Principale: Giulia
 * and Marco managers, Kate member (en), Leo a resource (referent Giulia). Famiglia Babbo: Rosa and
 * Franco managers, Marco member. The only reads that are not HTTP: the ids and results of the
 * {@code reminder} rows (to check that none leaks) and {@code max(seq)} of {@code change_log}.
 */
class Giro036ReminderReadAcceptanceTest extends Giro032AcceptanceSupport {

  static final String PACCO = "Ritirare il pacco";
  static final String SPESA = "Lista della spesa";
  static final String ZAINO_LEO_036 = "Preparare lo zaino di Leo";
  static final String DOCUMENTO_036 = "Rinnovare la carta d'identità di Franco";
  static final List<String> KEYS = List.of("id", "kind", "dueAt", "sentAt", "result");
  static final String FCM_NAME_PREFIX = "projects/" + Giro031FakeFcm.PROJECT_ID + "/messages/";

  /** The people and families of the plan. */
  record Homes036(
      String principale,
      String babbo,
      User giulia,
      User marco,
      User kate,
      String leo,
      User rosa,
      User franco,
      String kateTok,
      String giuliaTok,
      String francoTok) {}

  Homes036 homes036() throws Exception {
    Homes h = homes();
    User kate = kate(h);
    User rosa = founder("Rosa", BABBO);
    String b = rosa.familyId();
    User franco = withCode("Franco", invite(rosa.token(), b));
    setRoleOk(rosa.token(), b, franco.personId(), "MANAGER");
    joinOk(h.marco(), invite(rosa.token(), b));
    String kateTok = deviceOk(kate, "tok-ok-036-kate");
    String giuliaTok = deviceOk(h.giulia(), "tok-dead-036-giulia");
    String francoTok = deviceOk(franco, "tok-ok-036-franco");
    return new Homes036(
        h.principale(),
        b,
        h.giulia(),
        h.marco(),
        kate,
        h.leo(),
        rosa,
        franco,
        kateTok,
        giuliaTok,
        francoTok);
  }

  // ---------------------------------------------------------------- the endpoint of the round

  static String remindersPath(String familyId, String taskId) {
    return "/api/families/" + familyId + "/tasks/" + taskId + "/reminders";
  }

  Response readReminders(String token, String familyId, String taskId) throws Exception {
    return get(remindersPath(familyId, taskId), token);
  }

  /** A 200 answer, checked for its shape (C7), as a list of elements. */
  static List<Map<String, Object>> elements(Response response, Homes036 w) {
    assertThat(response.status()).as("reminders: " + response.body()).isEqualTo(200);
    Object parsed = JsonPath.read(response.body(), "$");
    assertThat(parsed).as("an array: " + response.body()).isInstanceOf(List.class);
    List<Map<String, Object>> list = JsonPath.read(response.body(), "$");
    for (Map<String, Object> element : list) {
      assertThat(element.keySet())
          .as("C7: exactly the keys of the contract")
          .containsExactlyInAnyOrderElementsOf(KEYS);
    }
    assertThat(response.body())
        .as("C7: no device token")
        .doesNotContain("tok-")
        .doesNotContain(w.kateTok())
        .doesNotContain(w.giuliaTok())
        .doesNotContain(w.francoTok());
    return list;
  }

  static Instant instantOf(Object value) {
    return value == null ? null : Instant.parse((String) value);
  }

  /** «Comprare il pane», assigned to Kate, nudged by Marco; returns task id and the FCM name. */
  record Pane(String id, String name, Instant at) {}

  Pane nudgedPane(Homes036 w) throws Exception {
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.kate().personId());
    Instant at = clock.instant();
    nudgeOk(w.marco().token(), w.principale(), pane);
    List<Giro031FakeFcm.Message> sent = FCM.messagesTo(w.kateTok());
    assertThat(sent).as("one message to Kate").hasSize(1);
    return new Pane(pane, sent.get(0).name(), at);
  }

  // ---------------------------------------------------------------- C1, C2, C3

  @Test
  void c1MarcoReadsTheNudgeOfThePane() throws Exception {
    Homes036 w = homes036();
    Pane pane = nudgedPane(w);

    Response read = readReminders(w.marco().token(), w.principale(), pane.id());

    List<Map<String, Object>> list = elements(read, w);
    assertThat(list).hasSize(1);
    Map<String, Object> nudge = list.get(0);
    assertThat(nudge).containsEntry("kind", "NUDGE").containsEntry("result", pane.name());
    assertThat((String) nudge.get("result")).startsWith(FCM_NAME_PREFIX);
    assertThat(instantOf(nudge.get("sentAt"))).as("sentAt: the clock").isEqualTo(pane.at());
    assertThat(instantOf(nudge.get("dueAt"))).as("dueAt = sentAt").isEqualTo(pane.at());
    assertThat(read.body()).as("C7: no recipient").doesNotContain(w.kate().personId());
  }

  @Test
  void c2GiuliaSeesTheSameAndC3KateIsForbidden() throws Exception {
    Homes036 w = homes036();
    Pane pane = nudgedPane(w);

    List<Map<String, Object>> byMarco =
        elements(readReminders(w.marco().token(), w.principale(), pane.id()), w);
    List<Map<String, Object>> byGiulia =
        elements(readReminders(w.giulia().token(), w.principale(), pane.id()), w);
    assertThat(byGiulia).as("C2: the other manager").isEqualTo(byMarco).hasSize(1);

    assertError(readReminders(w.kate().token(), w.principale(), pane.id()), 403, "forbidden");
  }

  // ---------------------------------------------------------------- C4, C5, C6

  @Test
  void c4TwoPendingAutoRowsInOrder() throws Exception {
    Homes036 w = homes036();
    LocalDate march12 = LocalDate.of(year, 3, 12);
    String mensa =
        datetimeTask(w.giulia(), w.principale(), MENSA, rome(march12, 10, 0), w.kate().personId());

    List<Map<String, Object>> list =
        elements(readReminders(w.marco().token(), w.principale(), mensa), w);

    assertThat(list).hasSize(2);
    for (Map<String, Object> row : list) {
      assertThat(row).containsEntry("kind", "AUTO").containsEntry("result", "pending");
      assertThat(row.get("sentAt")).as("not sent yet").isNull();
    }
    assertThat(list.stream().map(r -> instantOf(r.get("dueAt"))).toList())
        .containsExactly(rome(march12, 9, 0), rome(march12, 10, 0));
  }

  @Test
  void c5ARejectedTokenAndNoDevice() throws Exception {
    Homes036 w = homes036();
    String piante = taskOk(w.marco().token(), w.principale(), PIANTE, w.giulia().personId());
    String pacco = taskOk(w.marco().token(), w.principale(), PACCO, w.marco().personId());
    nudgeOk(w.marco().token(), w.principale(), piante);
    nudgeOk(w.giulia().token(), w.principale(), pacco);

    List<Map<String, Object>> rejected =
        elements(readReminders(w.marco().token(), w.principale(), piante), w);
    assertThat(rejected).hasSize(1);
    assertThat(rejected.get(0))
        .containsEntry("kind", "NUDGE")
        .containsEntry("result", "token_rejected");
    assertThat(rejected.get(0).get("sentAt")).as("tried: sentAt set").isNotNull();

    List<Map<String, Object>> none =
        elements(readReminders(w.marco().token(), w.principale(), pacco), w);
    assertThat(none).hasSize(1);
    assertThat(none.get(0)).containsEntry("kind", "NUDGE").containsEntry("result", "no_device");
    assertThat(none.get(0).get("sentAt")).as("nothing sent: sentAt null").isNull();
  }

  @Test
  void c6AQueuedTaskWithoutDueHasNoReminders() throws Exception {
    Homes036 w = homes036();
    String spesa = taskOk(w.giulia().token(), w.principale(), SPESA);

    assertThat(elements(readReminders(w.marco().token(), w.principale(), spesa), w)).isEmpty();
  }

  // ---------------------------------------------------------------- C7

  @Test
  void c7TheNudgeOfLeoDoesNotShowItsReferent() throws Exception {
    Homes036 w = homes036();
    String zaino = taskOk(w.giulia().token(), w.principale(), ZAINO_LEO_036, w.leo());
    nudgeOk(w.marco().token(), w.principale(), zaino);

    Response read = readReminders(w.marco().token(), w.principale(), zaino);

    assertThat(elements(read, w)).isNotEmpty();
    assertThat(read.body()).as("no recipient").doesNotContain(w.giulia().personId());
  }

  @Test
  void c7bGiuliaMadeMemberIsForbidden() throws Exception {
    Homes036 w = homes036();
    Pane pane = nudgedPane(w);
    assertThat(elements(readReminders(w.giulia().token(), w.principale(), pane.id()), w))
        .hasSize(1);

    setRoleOk(w.marco().token(), w.principale(), w.giulia().personId(), "MEMBER");

    assertError(readReminders(w.giulia().token(), w.principale(), pane.id()), 403, "forbidden");
  }

  @Test
  void c7cKateRemovedFromPrincipaleGetsNotFound() throws Exception {
    Homes036 w = homes036();
    Pane pane = nudgedPane(w);
    joinOk(w.kate(), invite(w.rosa().token(), w.babbo()));
    assertError(readReminders(w.kate().token(), w.principale(), pane.id()), 403, "forbidden");

    Response removed = removeMember(w.giulia().token(), w.principale(), w.kate().personId());
    assertThat(removed.status()).as("Kate removed: " + removed.body()).isEqualTo(204);

    assertError(readReminders(w.kate().token(), w.principale(), pane.id()), 404, "not_found");
  }

  // ---------------------------------------------------------------- C8: isolation

  enum Crossing {
    ROSA_PRINCIPALE(404),
    FRANCO_PRINCIPALE(404),
    ROSA_BABBO_WITH_PANE(404),
    MARCO_PRINCIPALE_WITH_DOCUMENT(404),
    MARCO_BABBO_AS_MEMBER(403),
    MARCO_BABBO_RANDOM_TASK(404),
    RANDOM_TASK(404),
    RANDOM_FAMILY(404);

    final int status;

    Crossing(int status) {
      this.status = status;
    }
  }

  @ParameterizedTest
  @EnumSource(Crossing.class)
  void c8NothingCrossesTheFamilies(Crossing crossing) throws Exception {
    Homes036 w = homes036();
    Pane pane = nudgedPane(w);
    String document = taskOk(w.rosa().token(), w.babbo(), DOCUMENTO_036, w.franco().personId());
    nudgeOk(w.rosa().token(), w.babbo(), document);
    assertThat(FCM.messagesTo(w.francoTok())).as("one message to Franco").hasSize(1);

    Response read =
        switch (crossing) {
          case ROSA_PRINCIPALE -> readReminders(w.rosa().token(), w.principale(), pane.id());
          case FRANCO_PRINCIPALE -> readReminders(w.franco().token(), w.principale(), pane.id());
          case ROSA_BABBO_WITH_PANE -> readReminders(w.rosa().token(), w.babbo(), pane.id());
          case MARCO_PRINCIPALE_WITH_DOCUMENT ->
              readReminders(w.marco().token(), w.principale(), document);
          case MARCO_BABBO_AS_MEMBER -> readReminders(w.marco().token(), w.babbo(), document);
          case MARCO_BABBO_RANDOM_TASK -> readReminders(w.marco().token(), w.babbo(), id());
          case RANDOM_TASK -> readReminders(w.marco().token(), w.principale(), id());
          case RANDOM_FAMILY -> readReminders(w.marco().token(), id(), pane.id());
        };

    assertError(read, crossing.status, crossing.status == 403 ? "forbidden" : "not_found");
    List<Map<String, Object>> rows =
        jdbc.queryForList(
            "select id::text as id, result from reminder where task_id in (?::uuid, ?::uuid)",
            pane.id(),
            document);
    assertThat(rows).as("one row per family to protect").hasSize(2);
    for (Map<String, Object> row : rows) {
      assertThat(read.body())
          .as("no reminder row in the body")
          .doesNotContain((String) row.get("id"))
          .doesNotContain((String) row.get("result"));
    }
    assertThat(read.body()).doesNotContain(FCM_NAME_PREFIX);
  }

  // ---------------------------------------------------------------- C9, C10

  @Test
  void c9WithoutAuthentication() throws Exception {
    Homes036 w = homes036();
    Pane pane = nudgedPane(w);

    Response read = readReminders(null, w.principale(), pane.id());

    assertThat(read.status()).as(read.body()).isEqualTo(401);
  }

  @Test
  void c10MarcoReadsWithTheWebCookieWithoutCsrf() throws Exception {
    Homes036 w = homes036();
    Pane pane = nudgedPane(w);
    List<Map<String, Object>> bearer =
        elements(readReminders(w.marco().token(), w.principale(), pane.id()), w);

    Map<String, String> cookies = webCookies(w.marco().email());
    Response read = send("GET", remindersPath(w.principale(), pane.id()), null, null, cookies);

    assertThat(elements(read, w)).as("same array as with the bearer").isEqualTo(bearer);
  }

  // ---------------------------------------------------------------- C11

  @Test
  void c11AfterTheForwardTheRowsFollowTheTask() throws Exception {
    Homes036 w = homes036();
    String pacco = taskOk(w.marco().token(), w.principale(), PACCO, w.marco().personId());
    nudgeOk(w.giulia().token(), w.principale(), pacco);
    List<Map<String, Object>> before =
        elements(readReminders(w.marco().token(), w.principale(), pacco), w);
    assertThat(before).hasSize(1);

    Response moved =
        send(
            "POST",
            "/api/families/" + w.principale() + "/tasks/" + pacco + "/forward",
            w.marco().token(),
            body(id(), "toFamilyId", w.babbo()));
    assertThat(moved.status()).as("forward: " + moved.body()).isEqualTo(200);

    assertError(readReminders(w.marco().token(), w.principale(), pacco), 404, "not_found");
    List<Map<String, Object>> after =
        elements(readReminders(w.rosa().token(), w.babbo(), pacco), w);
    assertThat(after).as("the rows stay with the task").isEqualTo(before);
    assertThat(after.get(0)).containsEntry("result", "no_device");
  }

  // ---------------------------------------------------------------- C12

  @Test
  void c12AReadWritesNothing() throws Exception {
    Homes036 w = homes036();
    Pane pane = nudgedPane(w);
    long version = version(task(w.marco().token(), w.principale(), pane.id()));
    String changes = changes(w.marco().token(), w.principale(), "?after=0").body();
    Long seq = maxSeq(w.principale());

    for (int i = 0; i < 3; i++) {
      elements(readReminders(w.marco().token(), w.principale(), pane.id()), w);
    }

    assertThat(version(task(w.marco().token(), w.principale(), pane.id()))).isEqualTo(version);
    assertThat(changes(w.marco().token(), w.principale(), "?after=0").body()).isEqualTo(changes);
    assertThat(maxSeq(w.principale())).as("no change_log row").isEqualTo(seq);
  }

  Long maxSeq(String familyId) {
    return jdbc.queryForObject(
        "select max(seq) from change_log where family_id = ?::uuid", Long.class, familyId);
  }
}
