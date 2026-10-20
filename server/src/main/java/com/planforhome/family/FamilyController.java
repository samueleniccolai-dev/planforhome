package com.planforhome.family;

import com.planforhome.account.AuthUser;
import com.planforhome.common.ApiException;
import com.planforhome.common.Names;
import com.planforhome.family.FamilyRepository.FamilyView;
import com.planforhome.family.FamilyRepository.MemberView;
import com.planforhome.family.FamilyService.Created;
import com.planforhome.family.FamilyService.CreatedInvite;
import com.planforhome.family.MembershipService.Added;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class FamilyController {

  private final FamilyService service;
  private final MembershipService membership;

  public FamilyController(FamilyService service, MembershipService membership) {
    this.service = service;
    this.membership = membership;
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
    UUID id = Names.uuidOrNull(body.id());
    if (body.id() != null && id == null) {
      throw ApiException.badRequest("invalid_request");
    }
    Created created = service.create(user.personId(), id, body.name(), body.timeZone());
    return ResponseEntity.status(created.isNew() ? HttpStatus.CREATED : HttpStatus.OK)
        .body(created.family());
  }

  @PostMapping("/api/families/join")
  public FamilyView join(
      @AuthenticationPrincipal AuthUser user, @RequestBody JoinBody body, HttpServletRequest http) {
    return service.join(user.personId(), body.code(), http.getRemoteAddr());
  }

  public record ResourceBody(String id, String displayName, String referentPersonId) {}

  public record RoleBody(String role) {}

  public record ReferentBody(String referentPersonId) {}

  @PostMapping("/api/families/{familyId}/resources")
  public ResponseEntity<MemberView> addResource(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @RequestBody ResourceBody body) {
    Added added =
        membership.addResource(
            user.personId(), familyId, body.id(), body.displayName(), body.referentPersonId());
    return ResponseEntity.status(added.isNew() ? HttpStatus.CREATED : HttpStatus.OK)
        .body(added.member());
  }

  @PutMapping("/api/families/{familyId}/members/{personId}/role")
  public MemberView setRole(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID personId,
      @RequestBody RoleBody body) {
    return membership.setRole(user.personId(), familyId, personId, body.role());
  }

  @PutMapping("/api/families/{familyId}/members/{personId}/referent")
  public MemberView setReferent(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID personId,
      @RequestBody ReferentBody body) {
    return membership.setReferent(user.personId(), familyId, personId, body.referentPersonId());
  }

  @DeleteMapping("/api/families/{familyId}/members/{personId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void remove(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID personId) {
    membership.remove(user.personId(), familyId, personId);
  }

  @PostMapping("/api/families/{familyId}/invites")
  @ResponseStatus(HttpStatus.CREATED)
  public CreatedInvite createInvite(
      @AuthenticationPrincipal AuthUser user, @PathVariable UUID familyId) {
    return service.createInvite(user.personId(), familyId);
  }
}
