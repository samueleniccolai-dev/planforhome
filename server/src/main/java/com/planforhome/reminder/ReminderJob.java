package com.planforhome.reminder;

import com.planforhome.push.NotificationText;
import com.planforhome.push.PushService;
import com.planforhome.reminder.ReminderPlanner.Slot;
import com.planforhome.reminder.ReminderRepository.Due;
import java.time.Clock;
import java.time.ZoneId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Sends the pending reminders that are due. Per row, in one transaction: lock the task, lock the
 * row (skip locked, still pending), check it again with the same calculation, mark it {@code
 * sending}. The push goes out after the commit. Never locks the family.
 */
@Component
public class ReminderJob {

  private static final Logger LOG = LoggerFactory.getLogger(ReminderJob.class);
  private static final int BATCH = 100;

  private final ReminderRepository repository;
  private final ReminderPlanner planner;
  private final PushService push;
  private final TransactionTemplate tx;
  private final Clock clock;

  public ReminderJob(
      ReminderRepository repository,
      ReminderPlanner planner,
      PushService push,
      TransactionTemplate tx,
      Clock clock) {
    this.repository = repository;
    this.planner = planner;
    this.push = push;
    this.tx = tx;
    this.clock = clock;
  }

  @Scheduled(fixedDelayString = "${planforhome.reminders.poll:PT30S}")
  public void tick() {
    try {
      runDue();
    } catch (RuntimeException e) {
      LOG.warn("Reminder pass failed: {}", e.getClass().getSimpleName());
    }
  }

  /** One pass. */
  public void runDue() {
    for (Due row : repository.due(clock.instant(), BATCH)) {
      try {
        NotificationText.Text text = claim(row);
        if (text != null) {
          push.sendReminder(row.id(), row.taskId(), row.recipient(), row.dueAt(), text);
        }
      } catch (RuntimeException e) {
        LOG.warn("Reminder failed: {}", e.getClass().getSimpleName());
      }
    }
  }

  /** The text to send if the row is now {@code sending}, else null. */
  private NotificationText.Text claim(Due row) {
    return tx.execute(
        s -> {
          if (!repository.lockTask(row.taskId())) {
            if (repository.lockPending(row.id())) {
              repository.setResult(row.id(), "stale");
            }
            return null;
          }
          if (!repository.lockPending(row.id())) {
            return null;
          }
          boolean valid =
              planner.slots(row.taskId()).contains(new Slot(row.recipient(), row.dueAt()));
          repository.setResult(row.id(), valid ? "sending" : "stale");
          return valid ? compose(row) : null;
        });
  }

  private NotificationText.Text compose(Due row) {
    var task = repository.info(row.taskId()).orElseThrow();
    var words = repository.words(row.taskId(), row.recipient());
    ZoneId zone = ZoneId.of(task.timeZone());
    if (task.assignee() == null) {
      return NotificationText.overdueInQueue(words.locale(), words.title());
    }
    if (!row.recipient().equals(task.assignee())) {
      return NotificationText.forResource(
          words.locale(), words.assigneeName(), words.title(), task.dueKind(), task.dueAt(), zone);
    }
    return NotificationText.reminder(
        words.locale(), words.title(), task.dueKind(), task.dueAt(), zone);
  }
}
