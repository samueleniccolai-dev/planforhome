package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Round 031, T10 part 1: the nudge of a manager (SPEC 5 P12, 8) sent with FCM HTTP v1. {@code POST
 * /api/families/{f}/tasks/{t}/nudge {mutationId}} gives 200 with the task view, which has {@code
 * lastNudgedAt}; the nudge is a write ready for sync ({@code version} + 1, one {@code change_log}
 * row, a {@code NUDGED} event). Order of the checks: replay of the mutation id, then family and
 * task (404), role (403), state (409), the 5 minutes (429). One {@code reminder} row per device
 * token tried; {@code no_device} or {@code push_disabled} when no token is tried. The send happens
 * after the commit, inside the request, with a timeout of 1 second here.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "DEMO_PASSWORD=" + Giro003AcceptanceSupport.DEMO_PASSWORD,
      "planforhome.acceptance.context=giro031-nudge",
      "planforhome.fcm.timeout=PT1S"
    })
@Import(AcceptanceClock.Config.class)
@ExtendWith(OutputCaptureExtension.class)
class Giro031NudgeAcceptanceTest extends Giro031AcceptanceSupport {

  @DynamicPropertySource
  static void fcm(DynamicPropertyRegistry registry) {
    registry.add("planforhome.fcm.service-account-base64", FCM::serviceAccountBase64);
    registry.add("planforhome.fcm.base-url", FCM::baseUrl);
  }

  // ---------------------------------------------------------------- P12 allowed

  @Test
  void case1MarcoNudgesGiuliaAndFcmGetsOneGenericMessage() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.giulia(), "tok-giulia-1");
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());
    long v = version(task(w.marco().token(), w.principale(), pane));
    int logRows = changeLog(pane).size();
    Instant now = clock.instant();

    Response nudged = nudgeOk(w.marco().token(), w.principale(), pane);

    assertThat(lastNudgedAt(nudged)).isEqualTo(now);
    assertThat(version(nudged)).isEqualTo(v + 1);
    assertThat(changeLog(pane)).hasSize(logRows + 1);
    assertThat(nudgedEvents(pane)).isEqualTo(1);
    assertThat(lastNudgedAt(task(w.giulia().token(), w.principale(), pane))).isEqualTo(now);
    assertThat(lastNudgedAt(find(myTasks(w.giulia().token()), pane))).isEqualTo(now);
    Map<String, Object> notNudged =
        task(w.giulia().token(), w.principale(), taskOk(w.giulia().token(), w.principale(), FOTO));
    assertThat(lastNudgedAt(notNudged)).as("never nudged").isNull();

    assertNoTokenProblems();
    assertThat(FCM.tokenCalls()).hasSize(1);
    assertThat(Giro031FakeFcm.iat(FCM.tokenCalls().get(0))).as("iat from the Clock").isEqualTo(now);
    List<Giro031FakeFcm.Message> sent = FCM.messagesTo(tok);
    assertThat(sent).hasSize(1);
    Giro031FakeFcm.Message message = sent.get(0);
    assertThat(message.authorization())
        .isEqualTo("Bearer " + FCM.tokenCalls().get(0).accessToken());
    Map<String, Object> data = JsonPath.read(message.body(), "$.message.data");
    assertThat(data).as("data: only taskId").containsExactly(Map.entry("taskId", pane));
    assertThat((String) JsonPath.read(message.body(), "$.message.notification.title"))
        .isEqualTo(TITLE);
    assertThat((String) JsonPath.read(message.body(), "$.message.notification.body"))
        .isEqualTo(IT_BODY);
    assertThat((String) JsonPath.read(message.body(), "$.message.android.priority"))
        .isEqualTo("high");
    assertThat(FCM.messages()).as("nothing else sent").hasSize(1);

    List<Map<String, Object>> rows = reminders(pane);
    assertThat(rows).hasSize(1);
    assertThat(rows.get(0))
        .containsEntry("kind", "NUDGE")
        .containsEntry("result", message.name())
        .containsEntry("recipient", w.giulia().personId());
    assertThat(instant(rows.get(0).get("due_at"))).isEqualTo(now);
    assertThat(instant(rows.get(0).get("sent_at"))).isEqualTo(now);
  }

  // ---------------------------------------------------------------- P12 forbidden, state

  @Test
  void case2LucaIsAMemberAndGets403WithNothingSent() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.paolo(), "tok-paolo-1");
    String spesa = taskOk(w.anna().token(), w.mamma(), SPESA_ANNA, w.paolo().personId());
    long v = version(task(w.anna().token(), w.mamma(), spesa));

    assertError(nudge(w.luca().token(), w.mamma(), spesa), 403, "forbidden");

    assertThat(FCM.messagesTo(tok)).isEmpty();
    assertThat(nudgedEvents(spesa)).isZero();
    assertThat(reminders(spesa)).isEmpty();
    Map<String, Object> stored = task(w.anna().token(), w.mamma(), spesa);
    assertThat(version(stored)).isEqualTo(v);
    assertThat(lastNudgedAt(stored)).isNull();
  }

  @Test
  void case3QueueIs409NotAssignedAndDoneOrCancelledIs409NotOpen() throws Exception {
    Homes w = homes();
    deviceOk(w.giulia(), "tok-giulia-1");
    String auto = taskOk(w.giulia().token(), w.principale(), AUTO);
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());
    String foto = taskOk(w.giulia().token(), w.principale(), FOTO, w.giulia().personId());
    assertOk(done(w.giulia().token(), w.principale(), pane));
    assertOk(cancel(w.giulia().token(), w.principale(), foto));

    assertError(nudge(w.marco().token(), w.principale(), auto), 409, "not_assigned");
    assertError(nudge(w.marco().token(), w.principale(), pane), 409, "not_open");
    assertError(nudge(w.marco().token(), w.principale(), foto), 409, "not_open");

    assertThat(FCM.messages()).isEmpty();
    for (String task : List.of(auto, pane, foto)) {
      assertThat(nudgedEvents(task)).isZero();
      assertThat(reminders(task)).isEmpty();
    }
  }

  // ---------------------------------------------------------------- 5 minutes and replay

  @Test
  void case4OneNudgeEveryFiveMinutesWithRetryAfter() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.giulia(), "tok-giulia-1");
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());
    Instant first = clock.instant();
    nudgeOk(w.marco().token(), w.principale(), pane);

    clock.advance(Duration.ofSeconds(4 * 60 + 59));
    Response early = nudge(w.marco().token(), w.principale(), pane);
    assertError(early, 429, "nudge_too_soon");
    assertThat(early.raw().headers().firstValue("Retry-After")).hasValue("1");
    assertThat(FCM.messagesTo(tok)).hasSize(1);
    assertThat(nudgedEvents(pane)).isEqualTo(1);
    assertThat(lastNudgedAt(task(w.marco().token(), w.principale(), pane))).isEqualTo(first);

    clock.advance(Duration.ofSeconds(1));
    Instant second = clock.instant();
    Response again = nudgeOk(w.marco().token(), w.principale(), pane);
    assertThat(lastNudgedAt(again)).as("5 minutes exactly is allowed").isEqualTo(second);
    assertThat(FCM.messagesTo(tok)).hasSize(2);
    assertThat(nudgedEvents(pane)).isEqualTo(2);
    assertThat(reminders(pane)).hasSize(2);
  }

  @Test
  void case5TheSameMutationIdIsAReplayBeforeThe429() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.giulia(), "tok-giulia-1");
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());
    String mutation = id();
    Instant at = clock.instant();
    Response first = nudge(w.marco().token(), w.principale(), pane, mutation);
    assertOk(first);
    long v = version(first);

    clock.advance(Duration.ofMinutes(1));
    Response replay = nudge(w.marco().token(), w.principale(), pane, mutation);
    assertOk(replay);
    assertThat(lastNudgedAt(replay)).isEqualTo(at);
    assertThat(version(replay)).isEqualTo(v);
    assertThat(FCM.messagesTo(tok)).hasSize(1);
    assertThat(nudgedEvents(pane)).isEqualTo(1);
    assertThat(reminders(pane)).hasSize(1);

    assertError(nudge(w.marco().token(), w.principale(), pane), 429, "nudge_too_soon");
  }

  // ---------------------------------------------------------------- recipient, language, payload

  @Test
  void case6LeoHasNoAccountSoTheNudgeGoesToGiuliaWithoutTitleNotesOrNames() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.giulia(), "tok-giulia-1");
    String zaino = id();
    Response created =
        createTask(
            w.marco().token(),
            w.principale(),
            id(),
            "id",
            zaino,
            "title",
            ZAINO_LEO,
            "notes",
            NOTES,
            "assigneePersonId",
            w.leo());
    assertThat(created.status()).as(created.body()).isEqualTo(201);

    nudgeOk(w.marco().token(), w.principale(), zaino);

    List<Giro031FakeFcm.Message> sent = FCM.messagesTo(tok);
    assertThat(sent).hasSize(1);
    String body = sent.get(0).body();
    assertThat(body)
        .doesNotContain(ZAINO_LEO)
        .doesNotContain("Zaino")
        .doesNotContain(NOTES)
        .doesNotContain("Quaderno")
        .doesNotContain("Leo")
        .doesNotContain("Giulia")
        .doesNotContain("Marco");
    Map<String, Object> data = JsonPath.read(body, "$.message.data");
    assertThat(data).containsExactly(Map.entry("taskId", zaino));
    assertThat(reminders(zaino)).hasSize(1);
    assertThat(reminders(zaino).get(0)).containsEntry("recipient", w.giulia().personId());
  }

  @Test
  void case7KateReadsEnglish() throws Exception {
    Homes w = homes();
    User kate = kate(w);
    String tok = deviceOk(kate, "tok-kate-1");
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, kate.personId());

    nudgeOk(w.marco().token(), w.principale(), pane);

    List<Giro031FakeFcm.Message> sent = FCM.messagesTo(tok);
    assertThat(sent).hasSize(1);
    assertThat((String) JsonPath.read(sent.get(0).body(), "$.message.notification.body"))
        .isEqualTo(EN_BODY);
    assertThat((String) JsonPath.read(sent.get(0).body(), "$.message.notification.title"))
        .isEqualTo(TITLE);
  }

  // ---------------------------------------------------------------- FCM answers

  @Test
  void case8TwoTokensTwoRowsAndTheUnregisteredOneIsDeleted() throws Exception {
    Homes w = homes();
    String good = deviceOk(w.giulia(), "tok-giulia-1");
    String dead = deviceOk(w.giulia(), "tok-dead-1");
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());

    nudgeOk(w.marco().token(), w.principale(), pane);

    assertThat(FCM.messagesTo(good)).hasSize(1);
    assertThat(FCM.messagesTo(dead)).hasSize(1);
    String name = FCM.messagesTo(good).get(0).name();
    assertThat(results(reminders(pane))).containsExactlyInAnyOrder(name, "token_rejected");
    assertThat(devices(dead)).as("404 UNREGISTERED deletes the token").isEmpty();
    assertThat(devices(good)).hasSize(1);

    clock.advance(Duration.ofMinutes(5));
    nudgeOk(w.marco().token(), w.principale(), pane);
    assertThat(FCM.messagesTo(dead)).as("never again to the dead token").hasSize(1);
    assertThat(FCM.messagesTo(good)).hasSize(2);
    assertThat(reminders(pane)).hasSize(3);
  }

  @Test
  void case9OnlyADeadTokenThenNoDevice() throws Exception {
    Homes w = homes();
    String dead = deviceOk(w.marco(), "tok-dead-1");
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.marco().personId());

    nudgeOk(w.giulia().token(), w.principale(), pane);
    assertThat(results(reminders(pane))).containsExactly("token_rejected");
    assertThat(devices(dead)).isEmpty();

    clock.advance(Duration.ofMinutes(5));
    nudgeOk(w.giulia().token(), w.principale(), pane);
    assertThat(FCM.messagesTo(dead)).hasSize(1);
    List<Map<String, Object>> rows = reminders(pane);
    assertThat(results(rows)).containsExactlyInAnyOrder("token_rejected", "no_device");
    Map<String, Object> none =
        rows.stream().filter(r -> "no_device".equals(r.get("result"))).findFirst().orElseThrow();
    assertThat(none.get("sent_at")).as("nothing sent: sent_at null").isNull();
    assertThat(instant(none.get("due_at"))).isEqualTo(clock.instant());
  }

  @Test
  void case10A400OnTheTokenDeletesItA400OnThePayloadDoesNot() throws Exception {
    Homes w = homes();
    String badToken = deviceOk(w.giulia(), "tok-badtok-1");
    String badRequest = deviceOk(w.marco(), "tok-badreq-1");
    String forGiulia = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());
    String forMarco = taskOk(w.giulia().token(), w.principale(), FOTO, w.marco().personId());

    nudgeOk(w.marco().token(), w.principale(), forGiulia);
    nudgeOk(w.giulia().token(), w.principale(), forMarco);

    assertThat(results(reminders(forGiulia))).containsExactly("token_rejected");
    assertThat(devices(badToken)).as("violation on message.token").isEmpty();
    assertThat(results(reminders(forMarco))).containsExactly("error:400");
    assertThat(devices(badRequest)).as("violation on the payload: token kept").hasSize(1);
  }

  @Test
  void case11A503KeepsTheTokenAndTheNudge() throws Exception {
    Homes w = homes();
    String boom = deviceOk(w.giulia(), "tok-boom-1");
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());

    Response nudged = nudgeOk(w.marco().token(), w.principale(), pane);

    assertThat(lastNudgedAt(nudged)).isEqualTo(clock.instant());
    assertThat(results(reminders(pane))).containsExactly("error:503");
    assertThat(devices(boom)).hasSize(1);
    assertThat(FCM.messagesTo(boom)).as("no retry in this round").hasSize(1);
    assertThat(nudgedEvents(pane)).isEqualTo(1);
  }

  @Test
  void case12ASlowFcmIsCutByTheTimeoutAndTheNudgeStays() throws Exception {
    Homes w = homes();
    String slow = deviceOk(w.giulia(), "tok-slow-1");
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());

    long start = System.nanoTime();
    Response nudged = nudgeOk(w.marco().token(), w.principale(), pane);
    Duration took = Duration.ofNanos(System.nanoTime() - start);

    assertThat(took).as("timeout 1 s, fake waits 5 s").isLessThan(Duration.ofMillis(4_000));
    assertThat(lastNudgedAt(nudged)).isEqualTo(clock.instant());
    assertThat(results(reminders(pane))).containsExactly("error:timeout");
    assertThat(devices(slow)).hasSize(1);
  }

  @Test
  void case13NoTokenIsNoDevice() throws Exception {
    Homes w = homes();
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());

    nudgeOk(w.marco().token(), w.principale(), pane);

    List<Map<String, Object>> rows = reminders(pane);
    assertThat(results(rows)).containsExactly("no_device");
    assertThat(rows.get(0).get("sent_at")).isNull();
    assertThat(FCM.messages()).isEmpty();
  }

  // ---------------------------------------------------------------- access token

  @Test
  void case14TheAccessTokenIsKeptUntilOneMinuteBeforeItExpires() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.giulia(), "tok-giulia-1");
    String[] tasks = new String[4];
    for (int i = 0; i < tasks.length; i++) {
      tasks[i] = taskOk(w.giulia().token(), w.principale(), PANE + " " + i, w.giulia().personId());
    }

    nudgeOk(w.marco().token(), w.principale(), tasks[0]);
    nudgeOk(w.marco().token(), w.principale(), tasks[1]);
    assertThat(FCM.tokenCalls()).as("two nudges, one token").hasSize(1);

    clock.advance(Duration.ofSeconds(3600 - 60 - 1));
    nudgeOk(w.marco().token(), w.principale(), tasks[2]);
    assertThat(FCM.tokenCalls()).as("expires_in - 61 s: still cached").hasSize(1);

    clock.advance(Duration.ofSeconds(1));
    nudgeOk(w.marco().token(), w.principale(), tasks[3]);
    assertThat(FCM.tokenCalls()).as("expires_in - 60 s: renewed").hasSize(2);
    assertThat(Giro031FakeFcm.iat(FCM.tokenCalls().get(1))).isEqualTo(clock.instant());
    List<Giro031FakeFcm.Message> sent = FCM.messagesTo(tok);
    assertThat(sent).hasSize(4);
    assertThat(sent.get(3).authorization())
        .isEqualTo("Bearer " + FCM.tokenCalls().get(1).accessToken());
    assertNoTokenProblems();
  }

  // ---------------------------------------------------------------- concurrency

  @Test
  void case15TwoManagersAtOnceGiveOne200AndOne429() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.giulia(), "tok-giulia-1");
    for (int round = 0; round < 5; round++) {
      // assigned to Leo: both managers may nudge, the message goes to Giulia (referent)
      String task = taskOk(w.giulia().token(), w.principale(), ZAINO_LEO + " " + round, w.leo());
      List<Response> answers =
          together(
              () -> nudge(w.marco().token(), w.principale(), task),
              () -> nudge(w.giulia().token(), w.principale(), task));
      assertThat(statuses(answers)).as("round " + round).containsExactlyInAnyOrder(200, 429);
      assertThat(nudgedEvents(task)).as("round " + round).isEqualTo(1);
      assertThat(reminders(task)).as("round " + round).hasSize(1);
    }
    assertThat(FCM.messagesTo(tok)).hasSize(5);
  }

  @Test
  void case16TheSameMutationIdAtOnceSendsOneMessage() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.giulia(), "tok-giulia-1");
    for (int round = 0; round < 5; round++) {
      String task =
          taskOk(w.giulia().token(), w.principale(), PANE + " " + round, w.giulia().personId());
      String mutation = id();
      List<Response> answers =
          together(
              () -> nudge(w.marco().token(), w.principale(), task, mutation),
              () -> nudge(w.marco().token(), w.principale(), task, mutation));
      assertThat(statuses(answers)).as("round " + round).containsExactly(200, 200);
      assertThat(nudgedEvents(task)).as("round " + round).isEqualTo(1);
      assertThat(reminders(task)).as("round " + round).hasSize(1);
    }
    assertThat(FCM.messagesTo(tok)).hasSize(5);
  }

  @Test
  void case17TwoNudgesAtOnceAskTokenUriOnce() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.giulia(), "tok-giulia-1");
    String a = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());
    String b = taskOk(w.giulia().token(), w.principale(), FOTO, w.giulia().personId());

    List<Response> answers =
        together(
            () -> nudge(w.marco().token(), w.principale(), a),
            () -> nudge(w.marco().token(), w.principale(), b));

    assertThat(statuses(answers)).containsExactly(200, 200);
    assertThat(FCM.messagesTo(tok)).hasSize(2);
    assertThat(FCM.tokenCalls()).as("one renewal at a time").hasSize(1);
  }

  @Test
  void case18ANudgeRaisesTheVersionSoAnOldPutIs409() throws Exception {
    Homes w = homes();
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());
    long v = version(task(w.giulia().token(), w.principale(), pane));
    Instant at = clock.instant();
    nudgeOk(w.marco().token(), w.principale(), pane);

    Response late = updateV(w.giulia().token(), w.principale(), pane, id(), PIANTE, v);

    assertError(late, 409, "version_conflict");
    assertThat(((Number) late.json("$.current.version")).longValue()).isEqualTo(v + 1);
    assertThat(Instant.parse(late.json("$.current.lastNudgedAt"))).isEqualTo(at);
    assertThat(task(w.giulia().token(), w.principale(), pane)).containsEntry("title", PANE);
  }

  // ---------------------------------------------------------------- isolation (rule 1) and sync

  @Test
  void case19NudgesAcrossFamiliesAre404AndSendNothing() throws Exception {
    Homes w = homes();
    String tokGiulia = deviceOk(w.giulia(), "tok-giulia-1");
    String tokPaolo = deviceOk(w.paolo(), "tok-paolo-1");
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());
    String spesa = taskOk(w.anna().token(), w.mamma(), SPESA_ANNA, w.paolo().personId());

    // Marco is not in Mamma: with the URL of Mamma and with the URL of Principale.
    assertError(nudge(w.marco().token(), w.mamma(), spesa), 404, "not_found");
    assertError(nudge(w.marco().token(), w.principale(), spesa), 404, "not_found");
    // Anna manages Mamma, not Principale.
    assertError(nudge(w.anna().token(), w.principale(), pane), 404, "not_found");
    assertError(nudge(w.anna().token(), w.mamma(), pane), 404, "not_found");

    assertThat(FCM.messagesTo(tokGiulia)).isEmpty();
    assertThat(FCM.messagesTo(tokPaolo)).isEmpty();
    assertThat(nudgedEvents(pane)).isZero();
    assertThat(nudgedEvents(spesa)).isZero();
    assertThat(lastNudgedAt(task(w.anna().token(), w.mamma(), spesa))).isNull();
  }

  @Test
  void case20TheNudgeReachesGiuliaBySyncAndNeverPaolo() throws Exception {
    Homes w = homes();
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());
    long v = version(task(w.giulia().token(), w.principale(), pane));
    long seqP = seqOk(w.giulia().token(), w.principale());
    long seqM = seqOk(w.paolo().token(), w.mamma());
    Instant at = clock.instant();

    nudgeOk(w.marco().token(), w.principale(), pane);

    Map<String, Object> row =
        rowOf(all(walk(w.giulia().token(), w.principale(), seqP, null)), pane);
    assertUpsert(row, "task");
    assertThat(number(data(row).get("version"))).isEqualTo(v + 1);
    assertThat(lastNudgedAt(data(row))).isEqualTo(at);
    Map<String, Object> inSnapshot =
        find(list(snapshotOk(w.giulia().token(), w.principale()), "tasks"), pane);
    assertThat(lastNudgedAt(inSnapshot)).isEqualTo(at);

    assertThat(changes(w.paolo().token(), w.principale(), "?after=0").status()).isEqualTo(404);
    assertThat(rowsOf(all(walk(w.paolo().token(), w.mamma(), seqM, null)), pane)).isEmpty();
    assertThat(ids(myTasks(w.paolo().token()))).doesNotContain(pane);
  }

  // ---------------------------------------------------------------- logs

  @Test
  void case21NoDeviceTokenAccessTokenOrKeyInTheLogs(CapturedOutput output) throws Exception {
    Homes w = homes();
    String good = deviceOk(w.giulia(), "tok-giulia-1");
    String dead = deviceOk(w.giulia(), "tok-dead-1");
    String badRequest = deviceOk(w.marco(), "tok-badreq-1");
    String boom = deviceOk(w.marco(), "tok-boom-1");
    String forGiulia = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());
    String forMarco = taskOk(w.giulia().token(), w.principale(), FOTO, w.marco().personId());

    nudgeOk(w.marco().token(), w.principale(), forGiulia);
    nudgeOk(w.giulia().token(), w.principale(), forMarco);
    assertThat(FCM.messages()).hasSize(4);

    String logs = output.getAll();
    for (String secret : List.of(good, dead, badRequest, boom)) {
      assertThat(logs).as("device token in the logs").doesNotContain(secret);
    }
    for (Giro031FakeFcm.TokenCall call : FCM.tokenCalls()) {
      assertThat(logs).as("access token in the logs").doesNotContain(call.accessToken());
      assertThat(logs).as("JWT in the logs").doesNotContain(call.assertion());
      assertThat(logs)
          .as("JWT signature in the logs")
          .doesNotContain(call.assertion().substring(call.assertion().lastIndexOf('.') + 1));
    }
    assertThat(logs).doesNotContain(Giro031FakeFcm.ACCESS_PREFIX);
    assertThat(logs).as("private key in the logs").doesNotContain(FCM.privateKeyFragment());
    assertThat(logs).as("secret in the logs").doesNotContain(FCM.serviceAccountBase64());
    assertThat(logs).doesNotContain("fake error of round 031");
  }
}
