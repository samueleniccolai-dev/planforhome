package com.planforhome.reminder;

import com.planforhome.account.AuthUser;
import com.planforhome.reminder.ReminderRepository.Row;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ReminderReadController {

  private final ReminderReadService service;

  public ReminderReadController(ReminderReadService service) {
    this.service = service;
  }

  @GetMapping("/api/families/{familyId}/tasks/{taskId}/reminders")
  public List<Row> read(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId) {
    return service.read(user.personId(), familyId, taskId);
  }
}
