package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.PathNotFoundException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Month;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 035, T10: the text of the notification is composed by the server (SPEC 8, decision of the
 * human of 23/10/2026), in the language of the recipient and with the due in the time zone of the
 * family (Europe/Rome here). Title and text of each case:
 *
 * <ul>
 *   <li>nudge: «{who} ti sollecita» · «{title}», en «{who} is nudging you» · «{title}»;
 *   <li>reminder: «Promemoria» · «{title} · scade {when}», en «Reminder» · «{title} · due {when}»;
 *   <li>queued task at due, to the managers: «Task in coda scaduto» · «{title}», en «Overdue task
 *       in the queue» · «{title}»;
 *   <li>resource without account, to the referent: «Promemoria per {resource}» · «{title} · scade
 *       {when}», en «Reminder for {resource}» · «{title} · due {when}».
 * </ul>
 *
 * <p>{when}: the due of the task (never the instant of the reminder), it {@code dd/MM/yyyy HH:mm}
 * or {@code dd/MM/yyyy}, en {@code d MMM yyyy HH:mm} or {@code d MMM yyyy} with English month
 * abbreviations. {title}: over 100 code points it becomes the first 99 followed by «…». Unchanged:
 * {@code data} with only {@code taskId}, {@code android.priority} high, {@code channel_id}
 * reminders. The context, the clock and the job are the ones of round 032; the expected strings are
 * written by hand, never with a formatter.
 */
class Giro035NotificationTextAcceptanceTest extends Giro032AcceptanceSupport {

  static final String DOT = " · ";
  static final String ELLIPSIS = "…";
  static final String GRIN = "😀";
  static final String CAT = "🐱";

  static final String GATTO = "Dare da mangiare al gatto";
  static final String BICI = "Portare la bici dal meccanico";
  static final String SPESA = "Lista della spesa";

  /** 98 plain characters of the plan, then the emoji: code points 99 and 100 are surrogates. */
  static final String LONG_98 =
      ("Riordinare la cantina, il garage e la soffitta prima dell'inverno, "
              + "poi portare i cartoni al centro di raccolta")
          .substring(0, 98);

  // ---------------------------------------------------------------- helpers

  private static Object field(String body, String path) {
    try {
      return JsonPath.read(body, path);
    } catch (PathNotFoundException e) {
      return null;
    }
  }

  /** C10 with the title and the text: exactly one message to the token, with these fields. */
  private static void assertOnly(String deviceToken, String taskId, String title, String text) {
    List<Giro031FakeFcm.Message> sent = FCM.messagesTo(deviceToken);
    assertThat(sent).as("one message to " + deviceToken).hasSize(1);
    String body = sent.get(0).body();
    assertThat(field(body, "$.message.notification.title")).as(body).isEqualTo(title);
    assertThat(field(body, "$.message.notification.body")).as(body).isEqualTo(text);
    Map<String, Object> data = JsonPath.read(body, "$.message.data");
    assertThat(data).as("data: only taskId").containsExactly(Map.entry("taskId", taskId));
    assertThat(field(body, "$.message.android.priority")).as(body).isEqualTo("high");
    assertThat(field(body, "$.message.android.notification.channel_id"))
        .as(body)
        .isEqualTo("reminders");
  }

  private static String two(int n) {
    return n < 10 ? "0" + n : Integer.toString(n);
  }

  private LocalDate dstDay() {
    return lastSunday(Month.OCTOBER);
  }

  private LocalDate november21() {
    return LocalDate.of(year, 11, 21);
  }

  private static Instant utcAt(LocalDate date, int hour, int minute) {
    return date.atTime(hour, minute).toInstant(ZoneOffset.UTC);
  }

  // ---------------------------------------------------------------- C1, C2: nudge

  @Test
  void c1MarcoNudgesGiuliaInItalian() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.giulia(), "tok-giulia-35");
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());

    nudgeOk(w.marco().token(), w.principale(), pane);

    assertOnly(tok, pane, "Marco ti sollecita", PANE);
    assertNoTokenProblems();
  }

  @Test
  void c2MarcoNudgesKateInEnglish() throws Exception {
    Homes w = homes();
    User kate = kate(w);
    String tok = deviceOk(kate, "tok-kate-35");
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, kate.personId());

    nudgeOk(w.marco().token(), w.principale(), pane);

    assertOnly(tok, pane, "Marco is nudging you", PANE);
  }

  // ---------------------------------------------------------------- C3-C6: reminder

  @Test
  void c3OnTheDayTheHourChangesTheDueIsInWinterTime() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.marco(), "tok-marco-35");
    LocalDate dst = dstDay();
    String gatto =
        datetimeTask(w.giulia(), w.principale(), GATTO, utcAt(dst, 9, 30), w.marco().personId());
    Instant before = utcAt(dst, 8, 30);

    clock.setTo(before);
    awaitSettled(gatto, w.marco().personId(), before);

    assertOnly(
        tok,
        gatto,
        "Promemoria",
        GATTO + DOT + "scade " + two(dst.getDayOfMonth()) + "/10/" + year + " 10:30");
  }

  @Test
  void c4TheDayBeforeTheDueIsInSummerTime() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.marco(), "tok-marco-35");
    LocalDate saturday = dstDay().minusDays(1);
    String piante =
        datetimeTask(
            w.giulia(), w.principale(), PIANTE, utcAt(saturday, 9, 30), w.marco().personId());
    Instant before = utcAt(saturday, 8, 30);

    clock.setTo(before);
    awaitSettled(piante, w.marco().personId(), before);

    assertOnly(
        tok,
        piante,
        "Promemoria",
        PIANTE + DOT + "scade " + two(saturday.getDayOfMonth()) + "/10/" + year + " 11:30");
  }

  @Test
  void c5KateGetsTheReminderInEnglish() throws Exception {
    Homes w = homes();
    User kate = kate(w);
    String tok = deviceOk(kate, "tok-kate-35");
    LocalDate saturday = dstDay().minusDays(1);
    String piante =
        datetimeTask(w.giulia(), w.principale(), PIANTE, utcAt(saturday, 9, 30), kate.personId());
    Instant before = utcAt(saturday, 8, 30);

    clock.setTo(before);
    awaitSettled(piante, kate.personId(), before);

    assertOnly(
        tok,
        piante,
        "Reminder",
        PIANTE + DOT + "due " + saturday.getDayOfMonth() + " Oct " + year + " 11:30");
  }

  @Test
  void c6ADateTaskShowsOnlyTheDayInItalian() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.marco(), "tok-marco-35");
    String bici = dateTask(w.giulia(), w.principale(), BICI, november21(), w.marco().personId());
    Instant nine = rome(november21(), 9, 0);

    clock.setTo(nine);
    awaitSettled(bici, w.marco().personId(), nine);

    assertOnly(tok, bici, "Promemoria", BICI + DOT + "scade 21/11/" + year);
  }

  @Test
  void c6EnADateTaskShowsOnlyTheDayInEnglish() throws Exception {
    Homes w = homes();
    User kate = kate(w);
    String tok = deviceOk(kate, "tok-kate-35");
    String bici = dateTask(w.giulia(), w.principale(), BICI, november21(), kate.personId());
    Instant nine = rome(november21(), 9, 0);

    clock.setTo(nine);
    awaitSettled(bici, kate.personId(), nine);

    assertOnly(tok, bici, "Reminder", BICI + DOT + "due 21 Nov " + year);
  }

  // ---------------------------------------------------------------- C7: resource

  @Test
  void c7GiuliaGetsTheReminderOfLeoWithHisName() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.giulia(), "tok-giulia-35");
    String zaino = dateTask(w.giulia(), w.principale(), ZAINO, november21(), w.leo());
    Instant nine = rome(november21(), 9, 0);

    clock.setTo(nine);
    awaitSettled(zaino, w.giulia().personId(), nine);

    assertOnly(tok, zaino, "Promemoria per Leo", ZAINO + DOT + "scade 21/11/" + year);
  }

  @Test
  void c7EnKateGetsTheReminderOfTomInEnglish() throws Exception {
    Homes w = homes();
    User kate = kate(w);
    String tok = deviceOk(kate, "tok-kate-35");
    String tom = resourceOk(w.giulia().token(), w.principale(), "Tom", kate.personId());
    String zaino = dateTask(w.giulia(), w.principale(), ZAINO, november21(), tom);
    Instant nine = rome(november21(), 9, 0);

    clock.setTo(nine);
    awaitSettled(zaino, kate.personId(), nine);

    assertOnly(tok, zaino, "Reminder for Tom", ZAINO + DOT + "due 21 Nov " + year);
  }

  // ---------------------------------------------------------------- C8: queue

  @Test
  void c8AQueuedTaskAtDueGoesToGiuliaAndMarcoWithoutTheDue() throws Exception {
    Homes w = homes();
    User kate = kate(w);
    String giulia = deviceOk(w.giulia(), "tok-giulia-35");
    String marco = deviceOk(w.marco(), "tok-marco-35");
    String member = deviceOk(kate, "tok-kate-35");
    Instant due = rome(LocalDate.of(year, 11, 20), 18, 0);
    String spesa = datetimeTask(w.giulia(), w.principale(), SPESA, due, null);

    clock.setTo(due);
    awaitSettled(spesa, w.giulia().personId(), due);
    awaitSettled(spesa, w.marco().personId(), due);

    assertOnly(giulia, spesa, "Task in coda scaduto", SPESA);
    assertOnly(marco, spesa, "Task in coda scaduto", SPESA);
    assertThat(FCM.messagesTo(member)).as("Kate is a member: nothing").isEmpty();
  }

  // ---------------------------------------------------------------- C9: long titles

  @Test
  void c9ATitleOver100CodePointsIsCutTo99AndTheEllipsis() throws Exception {
    assertThat(LONG_98.codePointCount(0, LONG_98.length())).isEqualTo(98);
    String exactly100 = LONG_98 + GRIN + CAT;
    String over100 = LONG_98 + GRIN + CAT + "Z";
    String cut = LONG_98 + GRIN + ELLIPSIS;
    assertThat(over100.codePointCount(0, over100.length())).isEqualTo(101);
    assertThat(cut.codePointCount(0, cut.length())).isEqualTo(100);

    Homes w = homes();
    String tokAuto = deviceOk(w.marco(), "tok-marco-35");
    String long100 = taskOk(w.giulia().token(), w.principale(), exactly100, w.marco().personId());
    String long101 = taskOk(w.giulia().token(), w.principale(), over100, w.marco().personId());
    String dated =
        datetimeTask(w.giulia(), w.principale(), over100, rome(day, 15, 0), w.marco().personId());

    // Marco has one token: the nudges go to it, then the reminder.
    nudgeOk(w.giulia().token(), w.principale(), long100);
    assertOnly(tokAuto, long100, "Giulia ti sollecita", exactly100);
    FCM.reset();
    nudgeOk(w.giulia().token(), w.principale(), long101);
    assertOnly(tokAuto, long101, "Giulia ti sollecita", cut);
    FCM.reset();

    Instant before = rome(day, 14, 0);
    clock.setTo(before);
    awaitSettled(dated, w.marco().personId(), before);

    assertOnly(
        tokAuto,
        dated,
        "Promemoria",
        cut + DOT + "scade " + two(day.getDayOfMonth()) + "/02/" + year + " 15:00");
  }
}
