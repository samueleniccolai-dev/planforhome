package com.planforhome.reminder;

import com.planforhome.common.ApiException;
import com.planforhome.family.FamilyRepository;
import com.planforhome.reminder.ReminderRepository.Row;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class ReminderReadService {

  private final FamilyRepository families;
  private final ReminderRepository reminders;

  public ReminderReadService(FamilyRepository families, ReminderRepository reminders) {
    this.families = families;
    this.reminders = reminders;
  }

  /** Managers only; family and task are checked (404) before the role (403). */
  public List<Row> read(UUID caller, UUID familyId, UUID taskId) {
    String role = families.roleIn(familyId, caller).orElseThrow(ApiException::notFound);
    List<Row> rows = reminders.ofTask(familyId, taskId).orElseThrow(ApiException::notFound);
    if (!"MANAGER".equals(role)) {
      throw new ApiException(HttpStatus.FORBIDDEN, "forbidden");
    }
    return rows;
  }
}
