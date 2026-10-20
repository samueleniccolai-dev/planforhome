package com.planforhome.family;

import com.planforhome.account.AttemptLimits;
import com.planforhome.common.ApiException;
import com.planforhome.common.Names;
import com.planforhome.common.UuidV7;
import com.planforhome.family.FamilyRepository.FamilyView;
import com.planforhome.family.FamilyRepository.MemberView;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/** Reads of the caller's families and invites; the server decides who may do what. */
@Service
public class FamilyService {

  public record CreatedInvite(String code, Instant expiresAt) {}

  static final Duration INVITE_LENGTH = Duration.ofDays(7);
  private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  private static final int CODE_LENGTH = 20; // 5 bits each: 100 bits
  private static final SecureRandom RANDOM = new SecureRandom();

  private final FamilyRepository families;
  private final AttemptLimits limits;
  private final TransactionTemplate tx;
  private final Clock clock;

  public FamilyService(
      FamilyRepository families, AttemptLimits limits, TransactionTemplate tx, Clock clock) {
    this.families = families;
    this.limits = limits;
    this.tx = tx;
    this.clock = clock;
  }

  public record Created(FamilyView family, boolean isNew) {}

  /**
   * P14: anyone creates a family and manages it. The insert is not preceded by a check: a duplicate
   * key (a replay, or a parallel twin) rolls back and re-reads, so replays are 200 and strangers
   * 409.
   */
  public Created create(UUID personId, UUID id, String rawName, String rawTimeZone) {
    String name = Names.familyName(rawName);
    String timeZone = Names.timeZone(rawTimeZone);
    UUID familyId = id != null ? id : UuidV7.next(clock);
    try {
      tx.executeWithoutResult(
          s -> {
            families.insertFamily(familyId, name, timeZone, clock.instant());
            families.insertMembership(familyId, personId, "MANAGER", null);
          });
    } catch (DuplicateKeyException e) {
      FamilyView existing = families.familyView(familyId, personId).orElseThrow(() -> idConflict());
      if (!existing.name().equals(name) || !existing.role().equals("MANAGER")) {
        throw idConflict();
      }
      return new Created(existing, false);
    }
    return new Created(families.familyView(familyId, personId).orElseThrow(), true);
  }

  /**
   * A registered user uses an invite code. The membership is checked before the code is consumed,
   * in one transaction that rolls back whole; locks: family, then person (as in MembershipService).
   * Only wrong codes count against the per-IP limit.
   */
  public FamilyView join(UUID personId, String rawCode, String clientIp) {
    var slot = limits.inviteCodes.tryAcquire(clientIp);
    if (!slot.granted()) {
      throw ApiException.tooManyAttempts(slot.retryAfterSeconds());
    }
    String code = rawCode == null ? "" : rawCode.trim();
    boolean wrongCode = false;
    try {
      return tx.execute(s -> joinInTransaction(personId, code));
    } catch (DuplicateKeyException e) {
      throw new ApiException(HttpStatus.CONFLICT, "already_member");
    } catch (ApiException e) {
      wrongCode = e.code().equals("invite_invalid");
      throw e;
    } finally {
      if (!wrongCode) {
        limits.inviteCodes.release(clientIp, slot.at());
      }
    }
  }

  private FamilyView joinInTransaction(UUID personId, String code) {
    ApiException invalid = ApiException.badRequest("invite_invalid");
    UUID familyId = families.openInviteFamily(code, clock.instant()).orElseThrow(() -> invalid);
    families.lockFamily(familyId);
    families.lockPerson(personId);
    if (families.isDisabled(personId)) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_session");
    }
    if (families.roleIn(familyId, personId).isPresent()) {
      throw new ApiException(HttpStatus.CONFLICT, "already_member");
    }
    families.consumeInvite(code, personId, clock.instant()).orElseThrow(() -> invalid);
    families.insertMembership(familyId, personId, "MEMBER", null);
    return families.familyView(familyId, personId).orElseThrow();
  }

  private static ApiException idConflict() {
    return new ApiException(HttpStatus.CONFLICT, "id_conflict");
  }

  public List<FamilyView> familiesOf(UUID personId) {
    return families.familiesOf(personId);
  }

  /** Not a member (or no such family): 404, the same answer for both. */
  public List<MemberView> members(UUID personId, UUID familyId) {
    families.roleIn(familyId, personId).orElseThrow(ApiException::notFound);
    return families.members(familyId);
  }

  public CreatedInvite createInvite(UUID personId, UUID familyId) {
    String role = families.roleIn(familyId, personId).orElseThrow(ApiException::notFound);
    if (!role.equals("MANAGER")) {
      throw new ApiException(HttpStatus.FORBIDDEN, "forbidden");
    }
    StringBuilder code = new StringBuilder();
    for (int i = 0; i < CODE_LENGTH; i++) {
      code.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
    }
    Instant now = clock.instant();
    Instant expiresAt = now.plus(INVITE_LENGTH);
    families.insertInvite(code.toString(), familyId, personId, now, expiresAt);
    return new CreatedInvite(code.toString(), expiresAt);
  }
}
