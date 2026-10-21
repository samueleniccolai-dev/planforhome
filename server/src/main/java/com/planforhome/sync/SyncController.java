package com.planforhome.sync;

import com.planforhome.account.AuthUser;
import com.planforhome.sync.SyncService.Changes;
import com.planforhome.sync.SyncService.Snapshot;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SyncController {

  private final SyncService service;

  public SyncController(SyncService service) {
    this.service = service;
  }

  @GetMapping("/api/sync/families/{familyId}/snapshot")
  public Snapshot snapshot(@AuthenticationPrincipal AuthUser user, @PathVariable UUID familyId) {
    return service.snapshot(user.personId(), familyId);
  }

  @GetMapping("/api/sync/families/{familyId}/changes")
  public Changes changes(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @RequestParam(defaultValue = "0") String after,
      @RequestParam(defaultValue = "500") String limit) {
    // the service checks membership first, so a stranger never learns about bad parameters
    long from;
    int max;
    try {
      from = Long.parseLong(after);
      max = Integer.parseInt(limit);
    } catch (NumberFormatException e) {
      return service.changes(user.personId(), familyId, -1, -1);
    }
    return service.changes(user.personId(), familyId, from, max);
  }
}
