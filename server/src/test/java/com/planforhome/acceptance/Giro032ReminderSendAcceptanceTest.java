package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

/**
 * Round 032, T10 part 2: the periodic job (every 0.2 s here) sends the pending rows whose instant
 * is not after the clock. Before sending it checks the row again on the locked task: the pair
 * (recipient, instant) must still be among what the calculation gives now, otherwise {@code stale},
 * {@code sent_at} null, nothing sent. The message is the one of the nudge: {@code data = {taskId}},
 * the text of SPEC 8 (round 035) in the language of the recipient, priority high. Outcomes and
 * {@code sent_at} as in round 031 ({@code sent_at} null when nothing is tried).
 */
class Giro032ReminderSendAcceptanceTest extends Giro032AcceptanceSupport {

  @Test
  void case1NotBeforeItsInstantThenOnceWithTheTextOfSpec8() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.marco(), "tok-marco-2");
    String gatto =
        datetimeTask(w.giulia(), w.principale(), GATTO_VET, rome(day, 15, 0), w.marco().personId());
    assertThat(pending(gatto)).hasSize(2);
    long v = version(task(w.giulia().token(), w.principale(), gatto));
    int logRows = changeLog(gatto).size();
    Instant before = rome(day, 14, 0);

    clock.setTo(before.minusSeconds(1));
    Thread.sleep(1_000);
    assertThat(pending(gatto)).as("one second early: still pending").hasSize(2);
    assertThat(FCM.messagesTo(tok)).isEmpty();

    clock.setTo(before);
    Map<String, Object> row = awaitSettled(gatto, w.marco().personId(), before);

    List<Giro031FakeFcm.Message> sent = FCM.messagesTo(tok);
    assertThat(sent).hasSize(1);
    Giro031FakeFcm.Message message = sent.get(0);
    assertThat(row).containsEntry("result", message.name());
    assertThat(instant(row.get("sent_at"))).isEqualTo(before);
    Map<String, Object> data = JsonPath.read(message.body(), "$.message.data");
    assertThat(data).as("data: only taskId").containsExactly(Map.entry("taskId", gatto));
    assertThat((String) JsonPath.read(message.body(), "$.message.notification.title"))
        .as("SPEC 8, round 035")
        .isEqualTo("Promemoria");
    assertThat((String) JsonPath.read(message.body(), "$.message.notification.body"))
        .as("SPEC 8, round 035: the due, not the instant of the reminder")
        .isEqualTo(GATTO_VET + " \u00b7 scade " + "10/02/" + year + " 15:00");
    assertThat((String) JsonPath.read(message.body(), "$.message.android.priority"))
        .isEqualTo("high");
    assertNoTokenProblems();
    assertThat(pending(gatto))
        .as("«at due» still waits")
        .containsExactly(slot(w.marco(), rome(day, 15, 0)));

    assertThat(version(task(relogin(w.giulia()).token(), w.principale(), gatto)))
        .as("a reminder is not a write of the task")
        .isEqualTo(v);
    assertThat(changeLog(gatto)).hasSize(logRows);
  }

  @Test
  void case2KateGetsItInEnglish() throws Exception {
    Homes w = homes();
    User kate = kate(w);
    String tok = deviceOk(kate, "tok-kate-2");
    String piante =
        datetimeTask(w.giulia(), w.principale(), PIANTE, rome(day, 9, 0), kate.personId());

    clock.setTo(rome(day, 8, 0));
    awaitSettled(piante, kate.personId(), rome(day, 8, 0));

    List<Giro031FakeFcm.Message> sent = FCM.messagesTo(tok);
    assertThat(sent).hasSize(1);
    assertThat((String) JsonPath.read(sent.get(0).body(), "$.message.notification.title"))
        .as("SPEC 8, round 035")
        .isEqualTo("Reminder");
    assertThat((String) JsonPath.read(sent.get(0).body(), "$.message.notification.body"))
        .as("SPEC 8, round 035")
        .isEqualTo(PIANTE + " \u00b7 due 10 Feb " + year + " 09:00");
  }

  @Test
  void case3TheReferentGetsTheMessageWithTheNameOfTheResource() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.giulia(), "tok-giulia-2");
    String zaino = dateTask(w.giulia(), w.principale(), ZAINO, day, w.leo());

    clock.setTo(rome(day, 9, 0));
    Map<String, Object> row = awaitSettled(zaino, w.giulia().personId(), rome(day, 9, 0));

    List<Giro031FakeFcm.Message> sent = FCM.messagesTo(tok);
    assertThat(sent).hasSize(1);
    assertThat(row).containsEntry("result", sent.get(0).name());
    String body = sent.get(0).body();
    assertThat((String) JsonPath.read(body, "$.message.notification.title"))
        .as("SPEC 8, round 035: the name of the resource")
        .isEqualTo("Promemoria per Leo");
    assertThat((String) JsonPath.read(body, "$.message.notification.body"))
        .as("SPEC 8, round 035")
        .isEqualTo(ZAINO + " \u00b7 scade 10/02/" + year);
    assertThat(body).doesNotContain("Giulia");
  }

  @Test
  void case4AQueuedTaskAtDueGoesToEveryManagerAndNoOneElse() throws Exception {
    Homes w = homes();
    String marco = deviceOk(w.marco(), "tok-marco-2");
    String giulia = deviceOk(w.giulia(), "tok-giulia-2");
    String anna = deviceOk(w.anna(), "tok-anna-2");
    String paolo = deviceOk(w.paolo(), "tok-paolo-2");
    String auto = dateTask(w.giulia(), w.principale(), AUTO, day, null);

    clock.setTo(rome(day, 18, 0));
    awaitSettled(auto, w.marco().personId(), rome(day, 18, 0));
    awaitSettled(auto, w.giulia().personId(), rome(day, 18, 0));

    assertThat(FCM.messagesTo(marco)).hasSize(1);
    assertThat(FCM.messagesTo(giulia)).hasSize(1);
    assertThat(sentTo(anna, paolo)).as("the other family").isEmpty();
    assertThat(settledAuto(auto))
        .extracting(r -> (String) r.get("result"))
        .allMatch(result -> result.startsWith("projects/"))
        .hasSize(2);
  }

  @Test
  void case5ARejectedTokenIsDeletedAndNoTokenIsNoDevice() throws Exception {
    Homes w = homes();
    String dead = deviceOk(w.marco(), "tok-dead-marco-2");
    String gatto =
        datetimeTask(w.giulia(), w.principale(), GATTO_VET, rome(day, 15, 0), w.marco().personId());
    String mensa =
        datetimeTask(w.giulia(), w.principale(), MENSA, rome(day, 15, 0), w.giulia().personId());
    Instant before = rome(day, 14, 0);

    clock.setTo(before);
    Map<String, Object> rejected = awaitSettled(gatto, w.marco().personId(), before);
    Map<String, Object> none = awaitSettled(mensa, w.giulia().personId(), before);

    assertThat(rejected).containsEntry("result", "token_rejected");
    assertThat(instant(rejected.get("sent_at"))).isEqualTo(before);
    assertThat(FCM.messagesTo(dead)).hasSize(1);
    assertThat(devices(dead)).as("token deleted").isEmpty();
    assertThat(none).containsEntry("result", "no_device");
    assertThat(none.get("sent_at")).as("nothing tried: sent_at null").isNull();
  }

  @Test
  void case6AManagerNoMoreIsStaleAndGetsNothing() throws Exception {
    Homes w = homes();
    String marco = deviceOk(w.marco(), "tok-marco-2");
    String giulia = deviceOk(w.giulia(), "tok-giulia-2");
    String auto = dateTask(w.giulia(), w.principale(), AUTO, day, null);
    assertThat(pending(auto)).hasSize(2);

    setRoleOk(w.giulia().token(), w.principale(), w.marco().personId(), "MEMBER");
    clock.setTo(rome(day, 18, 0));

    Map<String, Object> toGiulia = awaitSettled(auto, w.giulia().personId(), rome(day, 18, 0));
    Map<String, Object> toMarco = awaitSettled(auto, w.marco().personId(), rome(day, 18, 0));
    assertThat((String) toGiulia.get("result")).startsWith("projects/");
    assertThat(toMarco).containsEntry("result", "stale");
    assertThat(toMarco.get("sent_at")).as("stale: sent_at null").isNull();
    assertThat(FCM.messagesTo(marco)).isEmpty();
    assertThat(FCM.messagesTo(giulia)).hasSize(1);
  }

  @Test
  void case7TwoPassesOfTheJobAtOnceSendEachRowOnce() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.marco(), "tok-marco-2");
    List<String> tasks = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      tasks.add(
          datetimeTask(
              w.giulia(), w.principale(), GATTO_VET, rome(day, 15, 0), w.marco().personId()));
    }
    Object job = job();
    Instant before = rome(day, 14, 0);

    clock.setTo(before);
    List<Object> outcomes = together2(() -> runDue(job), () -> runDue(job));
    assertThat(outcomes).containsOnly("ok");

    Set<String> names = new HashSet<>();
    for (String task : tasks) {
      Map<String, Object> row = awaitSettled(task, w.marco().personId(), before);
      assertThat((String) row.get("result")).startsWith("projects/");
      names.add((String) row.get("result"));
    }
    List<Giro031FakeFcm.Message> sent = FCM.messagesTo(tok);
    assertThat(sent).as("one message per row").hasSize(3);
    assertThat(names).as("one outcome per message").hasSize(3);
    assertThat(sent)
        .extracting(Giro031FakeFcm.Message::name)
        .containsExactlyInAnyOrderElementsOf(names);
  }

  @Test
  void case8TwentyRecalculationsWhileTheJobRunsGiveNo500AndNoDoubles() throws Exception {
    Homes w = homes();
    String marco = deviceOk(w.marco(), "tok-marco-2");
    String giulia = deviceOk(w.giulia(), "tok-giulia-2");
    String gatto =
        datetimeTask(
            w.giulia(), w.principale(), GATTO_VET, rome(day, 15, 0), w.giulia().personId());
    Object job = job();
    List<Integer> statuses = Collections.synchronizedList(new ArrayList<>());
    User giuliaNow = w.giulia();

    for (int i = 0; i < 20; i++) {
      LocalDate d = day.plusDays(i);
      Response put =
          putDue(
              giuliaNow, w.principale(), gatto, GATTO_VET, "DATETIME", rome(d, 15, 0).toString());
      statuses.add(put.status());
      clock.setTo(rome(d, 14, 0));
      giuliaNow = relogin(giuliaNow);
      String token = giuliaNow.token();
      String to = i % 2 == 0 ? w.marco().personId() : w.giulia().personId();
      List<Object> outcomes =
          together2(
              () -> runDue(job),
              () -> statuses.add(setAssignee(token, w.principale(), gatto, to).status()));
      assertThat(outcomes).as("iteration " + i).containsOnly("ok");
    }
    assertThat(statuses).as("no 500, no conflict").containsOnly(200);

    assertOk(cancel(giuliaNow.token(), w.principale(), gatto));
    assertThat(pending(gatto)).isEmpty();
    List<Map<String, Object>> settled = settledAuto(gatto);
    assertThat(settled)
        .extracting(r -> (String) r.get("result"))
        .allMatch(r -> r.startsWith("projects/") || r.equals("stale"), "sent or stale");
    long sentRows =
        settled.stream().filter(r -> ((String) r.get("result")).startsWith("projects/")).count();
    assertThat(FCM.messagesTo(marco).size() + FCM.messagesTo(giulia).size())
        .as("one message per sent row")
        .isEqualTo((int) sentRows);
    List<String> keys =
        settled.stream().map(r -> r.get("recipient") + "@" + instant(r.get("due_at"))).toList();
    assertThat(new HashSet<>(keys)).as("no row twice").hasSize(keys.size());
  }

  /**
   * Runs two actions at the same instant (a latch) and gives back "ok" or the failure of each; a
   * deadlock shows as a timeout.
   */
  private List<Object> together2(Action first, Action second) throws Exception {
    ExecutorService pool = Executors.newFixedThreadPool(2);
    try {
      CountDownLatch ready = new CountDownLatch(2);
      CountDownLatch go = new CountDownLatch(1);
      List<Future<Object>> futures = new ArrayList<>();
      for (Action action : List.of(first, second)) {
        Callable<Object> call =
            () -> {
              ready.countDown();
              go.await();
              try {
                action.run();
                return "ok";
              } catch (Throwable t) {
                return t.toString();
              }
            };
        futures.add(pool.submit(call));
      }
      assertThat(ready.await(30, TimeUnit.SECONDS)).isTrue();
      go.countDown();
      List<Object> outcomes = new ArrayList<>();
      for (Future<Object> future : futures) {
        outcomes.add(future.get(Duration.ofSeconds(30).toMillis(), TimeUnit.MILLISECONDS));
      }
      return outcomes;
    } finally {
      pool.shutdownNow();
    }
  }

  @FunctionalInterface
  private interface Action {
    void run() throws Exception;
  }
}
