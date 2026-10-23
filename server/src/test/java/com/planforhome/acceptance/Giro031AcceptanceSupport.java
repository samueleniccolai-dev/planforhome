package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.jdbc.BadSqlGrammarException;

/**
 * Round 031, T10 part 1: what the acceptance tests of the nudge (P12) and of the device tokens
 * share. Every concrete class declares its own context: FCM and the {@code token_uri} are the
 * {@link Giro031FakeFcm} of the JVM; the service account carries the key of the fake (or is empty,
 * or malformed); the timeout towards FCM is 1 second ({@code planforhome.fcm.timeout=PT1S}).
 *
 * <p>The people have the names of Appendix A, but every test registers its own accounts and
 * families (as since round 008). Famiglia Principale (Europe/Rome): Giulia and Marco managers, Leo
 * a resource without account (referent Giulia). Famiglia Mamma: Anna manager, Luca and Paolo
 * members. Kate (locale {@code en}) joins Principale with a code where a test needs her. The device
 * tokens are the invented strings of the plan with a suffix of the test, so that two tests never
 * share one (the token is unique in {@code device}).
 *
 * <p>The only reads that are not HTTP: {@code reminder}, {@code device}, {@code task_event} and
 * {@code change_log} rows, always after an assertion on an HTTP answer of the round.
 */
abstract class Giro031AcceptanceSupport extends Giro023SyncAcceptanceSupport {

  static final Giro031FakeFcm FCM = Giro031FakeFcm.get();

  static final String SPESA_ANNA = "Spesa per Anna";
  static final String ZAINO_LEO = "Zaino di Leo";
  static final String AUTO = "Lavare l'auto";
  static final String NOTES = "Quaderno a quadretti e astuccio blu";

  @BeforeEach
  void freshFake() {
    FCM.reset();
  }

  /** The two families of the plan, with their people. */
  record Homes(
      String principale,
      String mamma,
      User giulia,
      User marco,
      String leo,
      User anna,
      User luca,
      User paolo) {}

  Homes homes() throws Exception {
    User giulia = founder("Giulia", PRINCIPALE);
    String p = giulia.familyId();
    User marco = withCode("Marco", invite(giulia.token(), p));
    setRoleOk(giulia.token(), p, marco.personId(), "MANAGER");
    String leo = resourceOk(giulia.token(), p, "Leo", giulia.personId());
    User anna = founder("Anna", MAMMA);
    String m = anna.familyId();
    User luca = withCode("Luca", invite(anna.token(), m));
    User paolo = withCode("Paolo", invite(anna.token(), m));
    return new Homes(p, m, giulia, marco, leo, anna, luca, paolo);
  }

  /** Kate registers with locale {@code en} and a code of Principale, and logs in. */
  User kate(Homes w) throws Exception {
    String email = "g031-kate-" + UUID.randomUUID() + "@example.com";
    String code = invite(w.giulia().token(), w.principale());
    Response created =
        send(
            "POST",
            "/api/auth/register",
            null,
            json(
                "email", email,
                "password", GOOD_PASSWORD,
                "displayName", "Kate",
                "locale", "en",
                "inviteCode", code),
            fromIp(freshIp()));
    assertThat(created.status()).as("registration of Kate: " + created.body()).isEqualTo(201);
    return new User(
        "Kate", email, created.json("$.personId"), token(email, GOOD_PASSWORD), w.principale());
  }

  /** An invented device token of the plan, unique to this call ({@code tok-giulia-1-<8 hex>}). */
  static String deviceToken(String base) {
    return base + "-" + UUID.randomUUID().toString().substring(0, 8);
  }

  // ---------------------------------------------------------------- the endpoints of the round

  Response registerDevice(String token, String deviceToken, String platform) throws Exception {
    return send("POST", "/api/me/devices", token, json("token", deviceToken, "platform", platform));
  }

  /** Registers an Android token and fails with an assertion if the server refuses. */
  String deviceOk(User user, String base) throws Exception {
    String deviceToken = deviceToken(base);
    Response registered = registerDevice(user.token(), deviceToken, "ANDROID");
    assertThat(registered.status())
        .as("device of " + user.name() + ": " + registered.body())
        .isEqualTo(204);
    return deviceToken;
  }

  static String nudgePath(String familyId, String taskId) {
    return "/api/families/" + familyId + "/tasks/" + taskId + "/nudge";
  }

  Response nudge(String token, String familyId, String taskId, String mutationId) throws Exception {
    return send("POST", nudgePath(familyId, taskId), token, body(mutationId));
  }

  Response nudge(String token, String familyId, String taskId) throws Exception {
    return nudge(token, familyId, taskId, id());
  }

  Response nudgeOk(String token, String familyId, String taskId) throws Exception {
    Response nudged = nudge(token, familyId, taskId);
    assertThat(nudged.status()).as("nudge: " + nudged.body()).isEqualTo(200);
    return nudged;
  }

  // ---------------------------------------------------------------- reads

  /** {@code lastNudgedAt} of a task view: null when missing or null. */
  static Instant lastNudgedAt(Map<String, Object> task) {
    assertThat(task).as("task view has lastNudgedAt: " + task).containsKey("lastNudgedAt");
    Object value = task.get("lastNudgedAt");
    return value == null ? null : Instant.parse((String) value);
  }

  static Instant lastNudgedAt(Response response) {
    Map<String, Object> view = response.json("$");
    return lastNudgedAt(view);
  }

  /** The reminder rows of a task: kind, result, recipient, due_at, sent_at. */
  List<Map<String, Object>> reminders(String taskId) {
    return rows(
        "select kind, result, recipient_person_id::text as recipient, due_at, sent_at"
            + " from reminder where task_id = ?::uuid order by due_at, result",
        taskId);
  }

  static List<Object> results(List<Map<String, Object>> reminders) {
    return reminders.stream().map(r -> r.get("result")).toList();
  }

  /** The device row of a token: person_id, platform, last_seen_at; empty if there is none. */
  List<Map<String, Object>> devices(String deviceToken) {
    return rows(
        "select person_id::text as person_id, platform, last_seen_at from device"
            + " where fcm_token = ?",
        deviceToken);
  }

  int nudgedEvents(String taskId) {
    Integer count =
        jdbc.queryForObject(
            "select count(*) from task_event where task_id = ?::uuid and type = 'NUDGED'",
            Integer.class,
            taskId);
    return count == null ? 0 : count;
  }

  /** A read of the tables of round 031: a missing table or column is a failed check. */
  private List<Map<String, Object>> rows(String sql, Object... args) {
    try {
      return jdbc.queryForList(sql, args);
    } catch (BadSqlGrammarException e) {
      throw new AssertionError("schema of round 031 missing (V6, SPEC 6): " + sql);
    }
  }

  /** The messages the fake received for these device tokens. */
  static List<Giro031FakeFcm.Message> sentTo(String... deviceTokens) {
    return FCM.messages().stream().filter(m -> List.of(deviceTokens).contains(m.token())).toList();
  }

  static void assertNoTokenProblems() {
    assertThat(FCM.tokenProblems()).as("checks of the fake token_uri and FCM").isEmpty();
  }

  static Instant instant(Object timestamp) {
    if (timestamp == null) return null;
    if (timestamp instanceof java.sql.Timestamp ts) return ts.toInstant();
    if (timestamp instanceof java.time.OffsetDateTime odt) return odt.toInstant();
    if (timestamp instanceof Instant i) return i;
    throw new AssertionError("not a timestamp: " + timestamp.getClass());
  }
}
