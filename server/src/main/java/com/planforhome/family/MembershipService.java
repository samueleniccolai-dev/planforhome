package com.planforhome.family;

import com.planforhome.common.ApiException;
import com.planforhome.common.Names;
import com.planforhome.common.UuidV7;
import com.planforhome.family.FamilyRepository.MemberView;
import java.time.Clock;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * P13 and P15: resources, roles, referents and removing memberships. Every write takes the lock of
 * the family first (then the one of the person), and counts only after the locks, so two parallel
 * writes see each other. Checks come in a fixed order: membership 404, role 403, body 400, person
 * 404, state 409.
 */
@Service
public class MembershipService {

  private final FamilyRepository families;
  private final Clock clock;

  public MembershipService(FamilyRepository families, Clock clock) {
    this.families = families;
    this.clock = clock;
  }

  public record Added(MemberView member, boolean isNew) {}

  @Transactional
  public Added addResource(
      UUID caller, UUID familyId, String rawId, String rawName, String rawReferent) {
    requireManager(caller, familyId);
    String name = Names.displayName(rawName);
    UUID id = null;
    if (rawId != null) {
      id = Names.uuidOrNull(rawId);
      if (id == null) {
        throw ApiException.badRequest("invalid_request");
      }
      if (families.personExists(id)) {
        var existing = families.memberView(familyId, id);
        if (existing.isPresent() && !existing.get().hasAccount()) {
          return new Added(existing.get(), false);
        }
        throw idConflict();
      }
    }
    UUID referent = requireReferent(familyId, Names.uuidOrNull(rawReferent));
    UUID resourceId = id != null ? id : UuidV7.next(clock);
    try {
      families.insertResource(resourceId, name, caller, clock.instant());
    } catch (DuplicateKeyException e) {
      throw idConflict();
    }
    families.insertMembership(familyId, resourceId, "MEMBER", referent);
    return new Added(families.memberView(familyId, resourceId).orElseThrow(), true);
  }

  @Transactional
  public MemberView setRole(UUID caller, UUID familyId, UUID personId, String role) {
    requireManager(caller, familyId);
    if (!"MANAGER".equals(role) && !"MEMBER".equals(role)) {
      throw ApiException.badRequest("role_invalid");
    }
    MemberView target = target(familyId, personId);
    if (role.equals("MANAGER") && !target.hasAccount()) {
      throw ApiException.badRequest("role_invalid");
    }
    if (role.equals("MEMBER")
        && target.role().equals("MANAGER")
        && families.managerCount(familyId) <= 1) {
      throw new ApiException(HttpStatus.CONFLICT, "last_manager");
    }
    families.updateRole(familyId, personId, role);
    return families.memberView(familyId, personId).orElseThrow();
  }

  @Transactional
  public MemberView setReferent(UUID caller, UUID familyId, UUID personId, String rawReferent) {
    requireManager(caller, familyId);
    UUID referentId = Names.uuidOrNull(rawReferent);
    if (referentId == null) {
      throw ApiException.badRequest("referent_invalid");
    }
    MemberView target = target(familyId, personId);
    if (target.hasAccount()) {
      throw ApiException.badRequest("not_a_resource");
    }
    requireReferent(familyId, referentId);
    families.updateReferent(familyId, personId, referentId);
    return families.memberView(familyId, personId).orElseThrow();
  }

  /** P13 when {@code personId} is another person, P15 when it is the caller. */
  @Transactional
  public void remove(UUID caller, UUID familyId, UUID personId) {
    boolean self = caller.equals(personId);
    lockAsMember(caller, familyId);
    if (!self) {
      requireManagerRole(caller, familyId);
    }
    MemberView target = target(familyId, personId);
    families.lockPerson(personId);
    if (target.role().equals("MANAGER") && families.managerCount(familyId) <= 1) {
      throw new ApiException(HttpStatus.CONFLICT, "last_manager");
    }
    if (families.isReferentIn(familyId, personId)) {
      throw new ApiException(HttpStatus.CONFLICT, "referent_in_use");
    }
    if (self && families.membershipCount(personId) <= 1) {
      throw new ApiException(HttpStatus.CONFLICT, "last_family");
    }
    families.deleteMembership(familyId, personId);
    if (families.membershipCount(personId) == 0) {
      if (target.hasAccount()) {
        families.disableAccount(personId, clock.instant());
      } else {
        families.deletePerson(personId);
      }
    }
    onMembershipRemoved(familyId, personId);
  }

  /** The one place where T5 will send the tasks of the person back to the queue. */
  void onMembershipRemoved(UUID familyId, UUID personId) {}

  private MemberView target(UUID familyId, UUID personId) {
    return families.memberView(familyId, personId).orElseThrow(ApiException::notFound);
  }

  private UUID requireReferent(UUID familyId, UUID referentId) {
    if (referentId == null || !families.isUserIn(familyId, referentId)) {
      throw ApiException.badRequest("referent_invalid");
    }
    return referentId;
  }

  private void requireManager(UUID caller, UUID familyId) {
    lockAsMember(caller, familyId);
    requireManagerRole(caller, familyId);
  }

  /** Locks the family; 404 if it does not exist or the caller is not in it. */
  private void lockAsMember(UUID caller, UUID familyId) {
    if (!families.lockFamily(familyId) || families.roleIn(familyId, caller).isEmpty()) {
      throw ApiException.notFound();
    }
  }

  private void requireManagerRole(UUID caller, UUID familyId) {
    if (!families.roleIn(familyId, caller).orElseThrow().equals("MANAGER")) {
      throw new ApiException(HttpStatus.FORBIDDEN, "forbidden");
    }
  }

  private static ApiException idConflict() {
    return new ApiException(HttpStatus.CONFLICT, "id_conflict");
  }
}
