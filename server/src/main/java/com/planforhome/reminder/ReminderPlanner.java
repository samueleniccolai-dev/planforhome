package com.planforhome.reminder;

import com.planforhome.common.UuidV7;
import com.planforhome.reminder.ReminderRepository.TaskInfo;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * SPEC 8: the automatic reminders of a task. {@link #slots} is the one calculation, used when a
 * write recalculates the pending rows and again when the job checks a row before sending it.
 */
@Service
public class ReminderPlanner {

  /** Who gets a reminder, and when. */
  public record Slot(UUID recipient, Instant at) {}

  private static final LocalTime NIGHT_START = LocalTime.of(22, 0);
  private static final LocalTime MORNING = LocalTime.of(7, 0);
  private static final LocalTime EVENING_LIMIT = LocalTime.of(21, 45);

  private final ReminderRepository repository;
  private final Clock clock;

  public ReminderPlanner(ReminderRepository repository, Clock clock) {
    this.repository = repository;
    this.clock = clock;
  }

  /**
   * Replaces the pending rows of the task with the future ones. The caller holds the lock of the
   * task, in its own transaction.
   */
  public void recalculate(UUID taskId) {
    repository.deletePending(taskId);
    Instant now = clock.instant();
    for (Slot slot : slots(taskId)) {
      if (slot.at().isAfter(now)) {
        repository.insertPending(UuidV7.next(clock), taskId, slot.recipient(), slot.at());
      }
    }
  }

  /** Recalculates the open tasks of a resource (her referent changed). */
  public void recalculateOfResource(UUID familyId, UUID personId) {
    for (UUID taskId : repository.openTasksOf(familyId, personId)) {
      recalculate(taskId);
    }
  }

  /** All the reminders the task should have, past ones included. */
  public Set<Slot> slots(UUID taskId) {
    Set<Slot> out = new LinkedHashSet<>();
    TaskInfo task = repository.info(taskId).orElse(null);
    if (task == null || !"OPEN".equals(task.status()) || task.dueAt() == null) {
      return out;
    }
    ZoneId zone = ZoneId.of(task.timeZone());
    Instant due = task.dueAt();
    Instant before;
    Instant at;
    if ("DATE".equals(task.dueKind())) {
      LocalDate day = due.atZone(zone).toLocalDate();
      before = ZonedDateTime.of(day, LocalTime.of(9, 0), zone).toInstant();
      at = ZonedDateTime.of(day, LocalTime.of(18, 0), zone).toInstant();
    } else {
      before = due.minus(Duration.ofMinutes(task.offsetMinutes()));
      at = due;
    }
    if (task.assignee() == null) {
      for (UUID manager : repository.managers(task.familyId())) {
        out.add(new Slot(manager, quiet(at, due, zone)));
      }
      return out;
    }
    UUID recipient = repository.recipient(task.familyId(), task.assignee()).orElse(null);
    if (recipient != null) {
      out.add(new Slot(recipient, quiet(before, due, zone)));
      out.add(new Slot(recipient, quiet(at, due, zone)));
    }
    return out;
  }

  /**
   * Night silence: 22:00 to 07:00 moves to 07:00, or to 21:45 before it if that is past the due.
   */
  static Instant quiet(Instant instant, Instant due, ZoneId zone) {
    ZonedDateTime local = instant.atZone(zone);
    LocalTime time = local.toLocalTime();
    boolean night = !time.isBefore(NIGHT_START) || time.isBefore(MORNING);
    if (!night) {
      return instant;
    }
    LocalDate day = time.isBefore(MORNING) ? local.toLocalDate() : local.toLocalDate().plusDays(1);
    Instant morning = ZonedDateTime.of(day, MORNING, zone).toInstant();
    if (!morning.isAfter(due)) {
      return morning;
    }
    return ZonedDateTime.of(day.minusDays(1), EVENING_LIMIT, zone).toInstant();
  }
}
