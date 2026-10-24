package com.planforhome.push;

import com.planforhome.common.ApiException;
import com.planforhome.common.UuidV7;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** Device tokens (SPEC section 8) and the push of a nudge, sent after the commit of the nudge. */
@Service
public class PushService {

  private static final Logger LOG = LoggerFactory.getLogger(PushService.class);
  private static final int MAX_TOKEN = 4096;

  private final PushRepository repository;
  private final FcmClient fcm;
  private final Clock clock;

  public PushService(PushRepository repository, FcmClient fcm, Clock clock) {
    this.repository = repository;
    this.fcm = fcm;
    this.clock = clock;
  }

  public void register(UUID personId, UUID sessionId, String token, String platform) {
    if (token == null
        || token.isBlank()
        || token.length() > MAX_TOKEN
        || !"ANDROID".equals(platform)) {
      throw ApiException.badRequest("invalid_request");
    }
    repository.saveDevice(
        UuidV7.next(clock), personId, sessionId, token, platform, clock.instant());
  }

  /** The device of a session that logged out gets nothing more (hunt 040, SPEC section 9). */
  public void forgetSession(UUID sessionId) {
    repository.deleteDevicesOfSession(sessionId);
  }

  /** After a password change only the devices of the session that changed it stay. */
  public void forgetOtherSessions(UUID personId, UUID keepSessionId) {
    repository.deleteDevicesOfOtherSessions(personId, keepSessionId);
  }

  /**
   * One {@code reminder} row per device token tried, or one if none is tried. Never throws: the
   * nudge is already registered.
   */
  public void sendNudge(UUID familyId, UUID taskId, UUID assignee, UUID caller, Instant at) {
    try {
      UUID recipient = repository.recipient(familyId, assignee).orElse(null);
      if (recipient == null) {
        return;
      }
      if (!fcm.enabled()) {
        row(taskId, recipient, at, null, "push_disabled");
        return;
      }
      var tokens = repository.tokensOf(recipient);
      if (tokens.isEmpty()) {
        row(taskId, recipient, at, null, "no_device");
        return;
      }
      var text =
          NotificationText.nudge(
              repository.localeOf(recipient),
              repository.nameOf(caller),
              repository.titleOf(taskId));
      for (String token : tokens) {
        FcmClient.Outcome outcome = fcm.send(token, taskId.toString(), text.title(), text.body());
        if (outcome.rejected()) {
          repository.deleteDevice(token);
        }
        row(taskId, recipient, at, at, outcome.result());
      }
    } catch (RuntimeException e) {
      LOG.warn("Nudge push failed: {}", e.getClass().getSimpleName());
    }
  }

  /**
   * Sends an automatic reminder whose row is {@code sending}: the first token settles that row,
   * every other token adds an AUTO row with the same due. Never throws.
   */
  public void sendReminder(
      UUID rowId, UUID taskId, UUID recipient, Instant dueAt, NotificationText.Text text) {
    Instant attempt = clock.instant();
    try {
      if (!fcm.enabled()) {
        repository.settleReminder(rowId, null, "push_disabled");
        return;
      }
      var tokens = repository.tokensOf(recipient);
      if (tokens.isEmpty()) {
        repository.settleReminder(rowId, null, "no_device");
        return;
      }
      boolean first = true;
      for (String token : tokens) {
        FcmClient.Outcome outcome = fcm.send(token, taskId.toString(), text.title(), text.body());
        if (outcome.rejected()) {
          repository.deleteDevice(token);
        }
        if (first) {
          repository.settleReminder(rowId, attempt, outcome.result());
          first = false;
        } else {
          repository.saveAutoReminder(
              UuidV7.next(clock), taskId, recipient, dueAt, attempt, outcome.result());
        }
      }
    } catch (RuntimeException e) {
      LOG.warn("Reminder push failed: {}", e.getClass().getSimpleName());
      repository.settleReminder(rowId, attempt, "error:network");
    }
  }

  private void row(UUID taskId, UUID recipient, Instant dueAt, Instant sentAt, String result) {
    repository.saveReminder(UuidV7.next(clock), taskId, recipient, dueAt, sentAt, result);
  }
}
