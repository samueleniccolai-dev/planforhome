package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.Month;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Round 032, T10 part 2: the automatic reminders (SPEC 2.2.9, 8). What the three classes of the
 * round share, context included: the annotations live here only, so the three classes run in one
 * application context with one {@link AcceptanceClock} and one periodic job (every 0.2 s).
 *
 * <p>The contract of the plan: every write that touches a task keeps its future {@code AUTO}
 * reminders as {@code reminder} rows with {@code result = 'pending'}, {@code sent_at} null, {@code
 * due_at} the instant of sending and {@code recipient_person_id} the person who gets it. The job
 * takes the pending rows with {@code due_at <= clock}, checks them again on the locked task and
 * sends them with the FCM client of round 031 ({@link Giro031FakeFcm}). The job is the bean {@code
 * com.planforhome.reminder.ReminderJob}; its public method {@code runDue()} is one pass, and the
 * tests call it by reflection (the class does not exist yet).
 *
 * <p>Dates: always in the year after the one of the clock, computed again before each test ({@link
 * #year}, {@link #day}), so a row of an earlier test is never due unless a test of this round moves
 * the clock there. The clocks of the other contexts stay in 2031. After each test no row may be
 * {@code sending}, or {@code pending} and already due ({@link #noDueRowLeft()}).
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "DEMO_PASSWORD=" + Giro003AcceptanceSupport.DEMO_PASSWORD,
      "planforhome.acceptance.context=giro032-reminders",
      "planforhome.fcm.timeout=PT1S",
      "planforhome.reminders.poll=PT0.2S"
    })
@Import(AcceptanceClock.Config.class)
abstract class Giro032AcceptanceSupport extends Giro031AcceptanceSupport {

  static final String JOB_CLASS = "com.planforhome.reminder.ReminderJob";

  static final String GATTO_VET = "Portare il gatto dal veterinario";
  static final String MENSA = "Pagare la mensa";
  static final String TRENO = "Prendere il treno";

  static final ZoneId ROME_ZONE = ZoneId.of(ROME);
  static final Duration SEND_WAIT = Duration.ofSeconds(5);

  @Autowired ApplicationContext context;

  /** The year after the one of the clock. */
  int year;

  /** A plain winter day of {@link #year} (no change of the hour near it). */
  LocalDate day;

  @DynamicPropertySource
  static void fcm(DynamicPropertyRegistry registry) {
    registry.add("planforhome.fcm.service-account-base64", FCM::serviceAccountBase64);
    registry.add("planforhome.fcm.base-url", FCM::baseUrl);
  }

  @BeforeEach
  void nextYear() {
    year = clock.instant().atZone(ZoneOffset.UTC).getYear() + 1;
    day = LocalDate.of(year, 2, 10);
  }

  @AfterEach
  void noDueRowLeft() throws Exception {
    OffsetDateTime now = OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    String sql =
        "select count(*) from reminder where result = 'sending'"
            + " or (result = 'pending' and due_at <= ?)";
    Instant deadline = Instant.now().plus(Duration.ofSeconds(10));
    Integer left = jdbc.queryForObject(sql, Integer.class, now);
    while (left != null && left > 0 && Instant.now().isBefore(deadline)) {
      Thread.sleep(100);
      left = jdbc.queryForObject(sql, Integer.class, now);
    }
    assertThat(left).as("reminder rows still sending, or pending and already due").isZero();
  }

  // ---------------------------------------------------------------- dates

  static Instant at(LocalDate date, int hour, int minute, ZoneId zone) {
    return ZonedDateTime.of(date, LocalTime.of(hour, minute), zone).toInstant();
  }

  static Instant rome(LocalDate date, int hour, int minute) {
    return at(date, hour, minute, ROME_ZONE);
  }

  static Instant utc(LocalDate date, int hour, int minute) {
    return at(date, hour, minute, ZoneOffset.UTC);
  }

  LocalDate lastSunday(Month month) {
    return LocalDate.of(year, month, 1).with(TemporalAdjusters.lastInMonth(DayOfWeek.SUNDAY));
  }

  // ---------------------------------------------------------------- writes

  /** A DATETIME task (assignee null: in the queue); returns its id. */
  String datetimeTask(User by, String familyId, String title, Instant due, String assignee)
      throws Exception {
    return dated(by, familyId, title, "DATETIME", due.toString(), assignee);
  }

  /** A DATE task (assignee null: in the queue); returns its id. */
  String dateTask(User by, String familyId, String title, LocalDate due, String assignee)
      throws Exception {
    return dated(by, familyId, title, "DATE", due.toString(), assignee);
  }

  private String dated(
      User by, String familyId, String title, String kind, String due, String assignee)
      throws Exception {
    String taskId = id();
    Response created =
        assignee == null
            ? createTask(
                by.token(),
                familyId,
                id(),
                "id",
                taskId,
                "title",
                title,
                "dueKind",
                kind,
                "due",
                due)
            : createTask(
                by.token(),
                familyId,
                id(),
                "id",
                taskId,
                "title",
                title,
                "dueKind",
                kind,
                "due",
                due,
                "assigneePersonId",
                assignee);
    assertThat(created.status()).as("task " + title + ": " + created.body()).isEqualTo(201);
    return taskId;
  }

  /** PUT of title, kind and due of the task. */
  Response putDue(User by, String familyId, String taskId, String title, String kind, String due)
      throws Exception {
    return update(by.token(), familyId, taskId, id(), "title", title, "dueKind", kind, "due", due);
  }

  // ---------------------------------------------------------------- reads

  /** One reminder to send: who gets it, and when. */
  record Slot(String recipient, Instant at) {}

  static Slot slot(User person, Instant at) {
    return new Slot(person.personId(), at);
  }

  static Slot slot(String personId, Instant at) {
    return new Slot(personId, at);
  }

  /**
   * The pending rows of a task as slots. Every pending row must be {@code AUTO} with {@code
   * sent_at} null.
   */
  List<Slot> pending(String taskId) {
    List<Map<String, Object>> rows =
        reminders(taskId).stream().filter(r -> "pending".equals(r.get("result"))).toList();
    for (Map<String, Object> row : rows) {
      assertThat(row).as("pending row").containsEntry("kind", "AUTO");
      assertThat(row.get("sent_at")).as("sent_at of a pending row: " + row).isNull();
    }
    return rows.stream()
        .map(r -> new Slot((String) r.get("recipient"), instant(r.get("due_at"))))
        .toList();
  }

  /** The AUTO rows of a task that are no longer pending (sent, stale, failed). */
  List<Map<String, Object>> settledAuto(String taskId) {
    return reminders(taskId).stream()
        .filter(r -> "AUTO".equals(r.get("kind")))
        .filter(r -> !"pending".equals(r.get("result")))
        .toList();
  }

  /** The reminder rows of a task for one recipient and instant. */
  List<Map<String, Object>> rowsAt(String taskId, String recipient, Instant at) {
    return reminders(taskId).stream()
        .filter(r -> recipient.equals(r.get("recipient")))
        .filter(r -> at.equals(instant(r.get("due_at"))))
        .toList();
  }

  /**
   * Waits (at most {@link #SEND_WAIT}) until the only AUTO row of the task for that recipient and
   * instant is neither pending nor sending, and returns it.
   */
  Map<String, Object> awaitSettled(String taskId, String recipient, Instant at) throws Exception {
    Predicate<Map<String, Object>> settled =
        r -> !"pending".equals(r.get("result")) && !"sending".equals(r.get("result"));
    Instant deadline = Instant.now().plus(SEND_WAIT);
    List<Map<String, Object>> rows = rowsAt(taskId, recipient, at);
    while (!(rows.size() == 1 && settled.test(rows.get(0))) && Instant.now().isBefore(deadline)) {
      Thread.sleep(100);
      rows = rowsAt(taskId, recipient, at);
    }
    assertThat(rows).as("AUTO rows of " + recipient + " at " + at).hasSize(1);
    assertThat(rows.get(0))
        .as("row sent within 5 s")
        .matches(settled)
        .containsEntry("kind", "AUTO");
    return rows.get(0);
  }

  /** The device tokens a set of messages went to. */
  static List<String> tokensOf(List<Giro031FakeFcm.Message> messages) {
    return messages.stream().map(Giro031FakeFcm.Message::token).toList();
  }

  // ---------------------------------------------------------------- the job

  /** The job bean of the contract: an assertion fails if it is not there. */
  Object job() {
    Class<?> type;
    try {
      type = Class.forName(JOB_CLASS);
    } catch (ClassNotFoundException e) {
      throw new AssertionError("contract: no bean " + JOB_CLASS + " with runDue()");
    }
    return context.getBean(type);
  }

  /** One pass of the job, as the scheduler does it. */
  void runDue(Object job) throws Exception {
    Method run;
    try {
      run = job.getClass().getMethod("runDue");
    } catch (NoSuchMethodException e) {
      throw new AssertionError("contract: " + JOB_CLASS + " has no public runDue()");
    }
    try {
      run.invoke(job);
    } catch (InvocationTargetException e) {
      throw new AssertionError("runDue() threw " + e.getCause(), e.getCause());
    }
  }
}
