package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

import com.jayway.jsonpath.JsonPath;
import com.planforhome.push.PushRepository;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * Round 042, T11 (docs/lab/giri/042-piano.md, defect 3 of hunt 040): when the reminder of a person
 * with two phones has gone out to the first one and its row is settled with the FCM message name,
 * an unexpected error on the second token must not overwrite that row with {@code error:network}.
 * An error before any row is settled still settles it {@code error:network} (never left {@code
 * sending}). The device tokens never reach the log.
 *
 * <p>The only exception to the closed box: {@link PushRepository} is a Mockito spy, because {@code
 * FcmClient.send} never throws. The spy throws for the task of the test only, and calls the real
 * method otherwise.
 *
 * <p>Context of its own (the spy), with the fake FCM of round 031 and the reminder job polling once
 * a day: the tests run one pass at a time ({@link #drainDue()}). The dates are in 2099 or later,
 * beyond the clocks of every other context, so no other job ever takes a row of this class; the
 * clock of this context is never left where a later class writes its rows. Demo data of the plan:
 * Famiglia Bruni (Europe/Rome), Lia (manager) with two phones; «Pagare la bolletta del gas»,
 * assigned to Lia, due at 15:00 in Rome, so a reminder at 14:00 and one at 15:00.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "DEMO_PASSWORD=" + Giro003AcceptanceSupport.DEMO_PASSWORD,
      "planforhome.acceptance.context=giro042-reminder-network-error",
      "planforhome.fcm.timeout=PT1S",
      "planforhome.reminders.poll=PT24H"
    })
@Import(AcceptanceClock.Config.class)
@ExtendWith(OutputCaptureExtension.class)
class Giro042ReminderNetworkErrorAcceptanceTest extends Giro032AcceptanceSupport {

  static final String BRUNI = "Famiglia Bruni";
  static final String GAS_042 = "Pagare la bolletta del gas";
  static final String FCM_NAME_PREFIX = "projects/" + Giro031FakeFcm.PROJECT_ID + "/messages/";
  static final int FAR_YEAR = 2099;

  @MockitoSpyBean PushRepository pushRepository;

  @BeforeEach
  void farYear() {
    year = Math.max(FAR_YEAR, year);
    day = day.withYear(year);
  }

  record Lia(String bruni, User lia, String phoneA, String phoneB) {}

  /** Lia founds Famiglia Bruni and signs in on two phones, each with its token. */
  Lia lia() throws Exception {
    User lia = founder("Lia", BRUNI);
    String phoneA = deviceOk(lia, "tok-lia-042-a");
    String phoneB = deviceOk(relogin(lia), "tok-lia-042-b");
    return new Lia(lia.familyId(), lia, phoneA, phoneB);
  }

  // ---------------------------------------------------------------- A8

  @Test
  void a8AnErrorOnTheSecondPhoneDoesNotOverwriteTheRowAlreadySettled(CapturedOutput output)
      throws Exception {
    Lia l = lia();
    Instant due = rome(day, 15, 0);
    Instant before = rome(day, 14, 0);
    String gas = datetimeTask(l.lia(), l.bruni(), GAS_042, due, l.lia().personId());
    assertThat(pending(gas)).contains(slot(l.lia(), before));
    UUID gasId = UUID.fromString(gas);
    doAnswer(
            call -> {
              if (gasId.equals(call.getArgument(1))) {
                throw new IllegalStateException("giro 042: the second row cannot be written");
              }
              return call.callRealMethod();
            })
        .when(pushRepository)
        .saveAutoReminder(any(), any(), any(), any(), any(), any());

    clock.setTo(before);
    drainDue();

    Map<String, Object> row = awaitSettled(gas, l.lia().personId(), before);
    assertThat((String) row.get("result"))
        .as("the row keeps the name of the FCM message of the first phone")
        .startsWith(FCM_NAME_PREFIX);
    assertThat(row.get("sent_at")).as("sent_at of the settled row").isNotNull();
    assertThat(rowsAt(gas, l.lia().personId(), before)).as("no second row half written").hasSize(1);
    assertThat(sentTo(l.phoneA(), l.phoneB())).as("the first phone got the reminder").isNotEmpty();

    List<Map<String, Object>> read = readReminders(relogin(l.lia()), l.bruni(), gas, before);
    assertThat(read).as("GET /reminders at " + before).hasSize(1);
    assertThat((String) read.get(0).get("result")).startsWith(FCM_NAME_PREFIX);
    assertThat(read.get(0).get("sentAt")).as("sentAt in GET /reminders").isNotNull();

    assertThat(output.getAll())
        .as("device tokens in the log")
        .doesNotContain(l.phoneA())
        .doesNotContain(l.phoneB());
  }

  // ---------------------------------------------------------------- A9

  @Test
  void a9AnErrorBeforeAnyRowIsSettledStillSettlesItAsNetworkError(CapturedOutput output)
      throws Exception {
    Lia l = lia();
    Instant due = rome(day, 15, 0);
    Instant before = rome(day, 14, 0);
    String gas = datetimeTask(l.lia(), l.bruni(), GAS_042, due, l.lia().personId());
    assertThat(pending(gas)).contains(slot(l.lia(), before));
    UUID liaId = UUID.fromString(l.lia().personId());
    doAnswer(
            call -> {
              if (liaId.equals(call.getArgument(0))) {
                throw new IllegalStateException("giro 042: the tokens cannot be read");
              }
              return call.callRealMethod();
            })
        .when(pushRepository)
        .tokensOf(any());

    clock.setTo(before);
    drainDue();

    Map<String, Object> row = awaitSettled(gas, l.lia().personId(), before);
    assertThat(row).containsEntry("result", "error:network");
    assertThat(sentTo(l.phoneA(), l.phoneB())).as("nothing sent").isEmpty();

    List<Map<String, Object>> read = readReminders(relogin(l.lia()), l.bruni(), gas, before);
    assertThat(read).hasSize(1);
    assertThat(read.get(0)).containsEntry("result", "error:network");

    assertThat(output.getAll()).doesNotContain(l.phoneA()).doesNotContain(l.phoneB());
  }

  // ---------------------------------------------------------------- helpers

  /**
   * Passes of the job until no row is pending and due at the clock (at most 50): the rows of this
   * class, and any row of an earlier class left pending before this far date.
   */
  void drainDue() throws Exception {
    Object job = job();
    OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    String sql = "select count(*) from reminder where result = 'pending' and due_at <= ?";
    for (int pass = 0; pass < 50; pass++) {
      Integer left = jdbc.queryForObject(sql, Integer.class, now);
      if (left == null || left == 0) {
        return;
      }
      runDue(job);
    }
  }

  /** GET /reminders of the task as a manager: the elements whose dueAt is {@code at}. */
  List<Map<String, Object>> readReminders(User manager, String familyId, String taskId, Instant at)
      throws Exception {
    Response answer =
        get("/api/families/" + familyId + "/tasks/" + taskId + "/reminders", manager.token());
    assertThat(answer.status()).as("reminders: " + answer.body()).isEqualTo(200);
    List<Map<String, Object>> all = JsonPath.read(answer.body(), "$");
    return all.stream()
        .filter(
            r -> at.equals(Instant.parse((String) r.get("dueAt")).truncatedTo(ChronoUnit.SECONDS)))
        .toList();
  }
}
