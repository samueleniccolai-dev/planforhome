package com.planforhome.family;

import com.planforhome.account.AuthUser;
import com.planforhome.common.Names;
import com.planforhome.family.FamilyRepository.FamilyView;
import com.planforhome.family.FamilyRepository.MemberView;
import com.planforhome.family.FamilyService.Created;
import com.planforhome.family.FamilyService.CreatedInvite;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class FamilyController {

  private final FamilyService service;

  public FamilyController(FamilyService service) {
    this.service = service;
  }

  @GetMapping("/api/families")
  public List<FamilyView> families(@AuthenticationPrincipal AuthUser user) {
    return service.familiesOf(user.personId());
  }

  @GetMapping("/api/families/{familyId}/members")
  public List<MemberView> members(
      @AuthenticationPrincipal AuthUser user, @PathVariable UUID familyId) {
    return service.members(user.personId(), familyId);
  }

  public record CreateBody(String id, String name, String timeZone) {}

  public record JoinBody(String code) {}

  @PostMapping("/api/families")
  public ResponseEntity<FamilyView> create(
      @AuthenticationPrincipal AuthUser user, @RequestBody CreateBody body) {
    Created created =
        service.create(user.personId(), Names.uuidOrNull(body.id()), body.name(), body.timeZone());
    return ResponseEntity.status(created.isNew() ? HttpStatus.CREATED : HttpStatus.OK)
        .body(created.family());
  }

  @PostMapping("/api/families/join")
  public FamilyView join(
      @AuthenticationPrincipal AuthUser user, @RequestBody JoinBody body, HttpServletRequest http) {
    return service.join(user.personId(), body.code(), http.getRemoteAddr());
  }

  @PostMapping("/api/families/{familyId}/invites")
  @ResponseStatus(HttpStatus.CREATED)
  public CreatedInvite createInvite(
      @AuthenticationPrincipal AuthUser user, @PathVariable UUID familyId) {
    return service.createInvite(user.personId(), familyId);
  }
}
