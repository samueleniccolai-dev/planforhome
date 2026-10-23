package com.planforhome.push;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

class NotificationTextTest {

  private static final ZoneId ROME = ZoneId.of("Europe/Rome");
  private static final Instant WINTER = Instant.parse("2026-10-25T09:30:00Z");
  private static final Instant SUMMER = Instant.parse("2026-10-24T09:30:00Z");
  private static final Instant DAY = Instant.parse("2026-11-20T23:00:00Z");

  @Test
  void nudge() {
    assertThat(NotificationText.nudge("it", "Marco", "Pane"))
        .isEqualTo(new NotificationText.Text("Marco ti sollecita", "Pane"));
    assertThat(NotificationText.nudge("en", "Marco", "Pane"))
        .isEqualTo(new NotificationText.Text("Marco is nudging you", "Pane"));
  }

  @Test
  void reminderAcrossTheClockChange() {
    assertThat(NotificationText.reminder("it", "Gatto", "DATETIME", WINTER, ROME).body())
        .isEqualTo("Gatto · scade 25/10/2026 10:30");
    assertThat(NotificationText.reminder("it", "Gatto", "DATETIME", SUMMER, ROME).body())
        .isEqualTo("Gatto · scade 24/10/2026 11:30");
    assertThat(NotificationText.reminder("en", "Gatto", "DATETIME", SUMMER, ROME))
        .isEqualTo(new NotificationText.Text("Reminder", "Gatto · due 24 Oct 2026 11:30"));
  }

  @Test
  void dateOnly() {
    assertThat(NotificationText.reminder("it", "Bici", "DATE", DAY, ROME))
        .isEqualTo(new NotificationText.Text("Promemoria", "Bici · scade 21/11/2026"));
    assertThat(NotificationText.reminder("en", "Bici", "DATE", DAY, ROME).body())
        .isEqualTo("Bici · due 21 Nov 2026");
  }

  @Test
  void resourceAndQueue() {
    assertThat(NotificationText.forResource("it", "Leo", "Zaino", "DATE", DAY, ROME))
        .isEqualTo(new NotificationText.Text("Promemoria per Leo", "Zaino · scade 21/11/2026"));
    assertThat(NotificationText.forResource("en", "Tom", "Zaino", "DATE", DAY, ROME))
        .isEqualTo(new NotificationText.Text("Reminder for Tom", "Zaino · due 21 Nov 2026"));
    assertThat(NotificationText.overdueInQueue("it", "Spesa"))
        .isEqualTo(new NotificationText.Text("Task in coda scaduto", "Spesa"));
    assertThat(NotificationText.overdueInQueue("en", "Spesa"))
        .isEqualTo(new NotificationText.Text("Overdue task in the queue", "Spesa"));
  }

  @Test
  void longTitleIsCutInCodePoints() {
    String base = "a".repeat(98);
    assertThat(NotificationText.shorten(base + "😀🐱")).isEqualTo(base + "😀🐱");
    assertThat(NotificationText.shorten(base + "😀🐱Z")).isEqualTo(base + "😀…");
  }
}
