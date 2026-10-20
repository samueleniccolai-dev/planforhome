package com.planforhome.task;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * The rule of a recurring task (SPEC 2.2.5) and the date of the next occurrence. Pure: no Spring,
 * no clock (the caller passes "now").
 *
 * <p>A monthly rule clamps to the end of the month (the 31st becomes the 28th, 29th or 30th). This
 * is a product choice, different from RFC 5545, where {@code BYMONTHDAY=31} skips the short months.
 *
 * <p>A DATETIME rule carries {@code time}, the local time of the first due in the zone of the
 * family, saved once: later occurrences use it, not the previous due, so a day lost to the spring
 * gap does not move the following ones.
 */
public final class Recurrence {

  enum Type {
    DAILY,
    EVERY_N_DAYS,
    WEEKLY,
    MONTHLY
  }

  /** The rule is not one of the four shapes of the API. */
  public static final class Invalid extends RuntimeException {
    Invalid() {
      super("recurrence_invalid", null, false, false);
    }
  }

  private static final JsonMapper MAPPER = JsonMapper.builder().build();
  private static final DateTimeFormatter HOUR_MINUTE = DateTimeFormatter.ofPattern("HH:mm");

  private final Type type;
  private final int interval;
  private final List<DayOfWeek> days;
  private final int dayOfMonth;
  private final LocalTime time;

  private Recurrence(
      Type type, int interval, List<DayOfWeek> days, int dayOfMonth, LocalTime time) {
    this.type = type;
    this.interval = interval;
    this.days = days;
    this.dayOfMonth = dayOfMonth;
    this.time = time;
  }

  /** The rule sent by a client ({@code time} is refused: the server adds it). */
  public static Recurrence fromRequest(JsonNode node) {
    return parse(node, false);
  }

  /** The rule as saved by the server. */
  public static Recurrence fromStored(String json) {
    return parse(MAPPER.readTree(json), true);
  }

  private static Recurrence parse(JsonNode node, boolean stored) {
    if (node == null || !node.isObject()) {
      throw new Invalid();
    }
    Collection<String> keys = node.propertyNames();
    JsonNode typeNode = node.get("type");
    if (typeNode == null || !typeNode.isString()) {
      throw new Invalid();
    }
    Type type;
    try {
      type = Type.valueOf(typeNode.stringValue());
    } catch (IllegalArgumentException e) {
      throw new Invalid();
    }
    Set<String> allowed = new java.util.HashSet<>(List.of("type"));
    int interval = 0;
    List<DayOfWeek> days = List.of();
    int dayOfMonth = 0;
    switch (type) {
      case EVERY_N_DAYS -> {
        allowed.add("interval");
        interval = integer(node.get("interval"), 2, 365);
      }
      case WEEKLY -> {
        allowed.add("days");
        days = days(node.get("days"));
      }
      case MONTHLY -> {
        allowed.add("dayOfMonth");
        dayOfMonth = integer(node.get("dayOfMonth"), 1, 31);
      }
      default -> {
        // DAILY has no parameters
      }
    }
    LocalTime time = null;
    if (stored && node.has("time")) {
      allowed.add("time");
      try {
        time = LocalTime.parse(node.get("time").asString(), HOUR_MINUTE);
      } catch (DateTimeParseException e) {
        throw new Invalid();
      }
    }
    if (!allowed.containsAll(keys)) {
      throw new Invalid();
    }
    return new Recurrence(type, interval, days, dayOfMonth, time);
  }

  private static int integer(JsonNode node, int min, int max) {
    if (node == null || !node.isInt() || node.intValue() < min || node.intValue() > max) {
      throw new Invalid();
    }
    return node.intValue();
  }

  private static List<DayOfWeek> days(JsonNode node) {
    if (node == null || !node.isArray() || node.size() < 1 || node.size() > 7) {
      throw new Invalid();
    }
    Set<DayOfWeek> seen = EnumSet.noneOf(DayOfWeek.class);
    for (JsonNode item : node) {
      if (!item.isString()) {
        throw new Invalid();
      }
      try {
        if (!seen.add(DayOfWeek.valueOf(item.stringValue()))) {
          throw new Invalid();
        }
      } catch (IllegalArgumentException e) {
        throw new Invalid();
      }
    }
    return new ArrayList<>(seen);
  }

  /** The same rule with the local time of the first due (DATETIME only). */
  public Recurrence withTime(LocalTime localTime) {
    return new Recurrence(type, interval, days, dayOfMonth, localTime.withSecond(0).withNano(0));
  }

  public LocalTime time() {
    return time;
  }

  /** The canonical form: only the keys of the type, in a fixed order. */
  public String toJson() {
    ObjectNode out = MAPPER.createObjectNode();
    out.put("type", type.name());
    switch (type) {
      case EVERY_N_DAYS -> out.put("interval", interval);
      case WEEKLY -> {
        var array = out.putArray("days");
        days.forEach(d -> array.add(d.name()));
      }
      case MONTHLY -> out.put("dayOfMonth", dayOfMonth);
      default -> {
        // DAILY has no parameters
      }
    }
    if (time != null) {
      out.put("time", time.format(HOUR_MINUTE));
    }
    return out.toString();
  }

  public static JsonNode toNode(String json) {
    return json == null ? null : MAPPER.readTree(json);
  }

  /** The first date of the rule after {@code day}. */
  LocalDate after(LocalDate day) {
    return switch (type) {
      case DAILY -> day.plusDays(1);
      case EVERY_N_DAYS -> day.plusDays(interval);
      case WEEKLY -> {
        LocalDate next = day.plusDays(1);
        while (!days.contains(next.getDayOfWeek())) {
          next = next.plusDays(1);
        }
        yield next;
      }
      case MONTHLY -> {
        YearMonth month = YearMonth.from(day);
        LocalDate candidate = month.atDay(Math.min(dayOfMonth, month.lengthOfMonth()));
        if (!candidate.isAfter(day)) {
          month = month.plusMonths(1);
          candidate = month.atDay(Math.min(dayOfMonth, month.lengthOfMonth()));
        }
        yield candidate;
      }
    };
  }

  /**
   * The due of the next occurrence: the first date of the rule after the day of {@code previous}
   * (in {@code zone}) that is not already past at {@code now}. A DATE is past when its day is
   * before today; a DATETIME when its instant is not after {@code now}.
   */
  public Instant next(Instant previous, boolean dateOnly, ZoneId zone, Instant now) {
    LocalDate today = now.atZone(zone).toLocalDate();
    LocalDate day = previous.atZone(zone).toLocalDate();
    while (true) {
      day = after(day);
      if (dateOnly) {
        if (!day.isBefore(today)) {
          return day.atStartOfDay(zone).toInstant();
        }
      } else {
        Instant at = ZonedDateTime.of(day, time, zone).withEarlierOffsetAtOverlap().toInstant();
        if (at.isAfter(now)) {
          return at;
        }
      }
    }
  }
}
