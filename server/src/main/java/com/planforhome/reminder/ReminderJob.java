package com.planforhome.reminder;

import com.planforhome.push.PushService;
import com.planforhome.reminder.ReminderPlanner.Slot;
import com.planforhome.reminder.ReminderRepository.Due;
import java.time.Clock;
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
        if (claim(row)) {
          push.sendReminder(row.id(), row.taskId(), row.recipient(), row.dueAt());
        }
      } catch (RuntimeException e) {
        LOG.warn("Reminder failed: {}", e.getClass().getSimpleName());
      }
    }
  }

  /** True if the row is now {@code sending} and must be sent. */
  private boolean claim(Due row) {
    return Boolean.TRUE.equals(
        tx.execute(
            s -> {
              if (!repository.lockTask(row.taskId())) {
                if (repository.lockPending(row.id())) {
                  repository.setResult(row.id(), "stale");
                }
                return false;
              }
              if (!repository.lockPending(row.id())) {
                return false;
              }
              boolean valid =
                  planner.slots(row.taskId()).contains(new Slot(row.recipient(), row.dueAt()));
              repository.setResult(row.id(), valid ? "sending" : "stale");
              return valid;
            }));
  }
}
