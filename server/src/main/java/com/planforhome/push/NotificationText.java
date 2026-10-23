package com.planforhome.push;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** SPEC 8: title and text of a notification, composed by the server in the recipient's language. */
public final class NotificationText {

  /** What the notification shows. */
  public record Text(String title, String body) {}

  private static final int MAX_TITLE = 100;
  private static final DateTimeFormatter IT_DATETIME =
      DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
  private static final DateTimeFormatter IT_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
  private static final DateTimeFormatter EN_DATETIME =
      DateTimeFormatter.ofPattern("d MMM yyyy HH:mm", Locale.ENGLISH);
  private static final DateTimeFormatter EN_DATE =
      DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

  private NotificationText() {}

  public static Text nudge(String locale, String who, String title) {
    return new Text(
        isEnglish(locale) ? who + " is nudging you" : who + " ti sollecita", shorten(title));
  }

  public static Text reminder(
      String locale, String title, String dueKind, Instant dueAt, ZoneId zone) {
    return new Text(
        isEnglish(locale) ? "Reminder" : "Promemoria",
        withDue(locale, title, dueKind, dueAt, zone));
  }

  public static Text overdueInQueue(String locale, String title) {
    return new Text(
        isEnglish(locale) ? "Overdue task in the queue" : "Task in coda scaduto", shorten(title));
  }

  public static Text forResource(
      String locale, String resource, String title, String dueKind, Instant dueAt, ZoneId zone) {
    return new Text(
        isEnglish(locale) ? "Reminder for " + resource : "Promemoria per " + resource,
        withDue(locale, title, dueKind, dueAt, zone));
  }

  private static String withDue(
      String locale, String title, String dueKind, Instant dueAt, ZoneId zone) {
    boolean en = isEnglish(locale);
    boolean date = "DATE".equals(dueKind);
    DateTimeFormatter f = en ? (date ? EN_DATE : EN_DATETIME) : (date ? IT_DATE : IT_DATETIME);
    return shorten(title) + " · " + (en ? "due " : "scade ") + f.format(dueAt.atZone(zone));
  }

  private static boolean isEnglish(String locale) {
    return "en".equals(locale);
  }

  static String shorten(String title) {
    if (title.codePointCount(0, title.length()) <= MAX_TITLE) {
      return title;
    }
    return title.substring(0, title.offsetByCodePoints(0, MAX_TITLE - 1)) + "…";
  }
}
