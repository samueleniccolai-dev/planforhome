package com.planforhome.family;

import com.planforhome.common.ApiException;
import com.planforhome.family.FamilyRepository.FamilyView;
import com.planforhome.family.FamilyRepository.MemberView;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Reads of the caller's families and invites; the server decides who may do what. */
@Service
public class FamilyService {

  public record CreatedInvite(String code, Instant expiresAt) {}

  static final Duration INVITE_LENGTH = Duration.ofDays(7);
  private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  private static final int CODE_LENGTH = 20; // 5 bits each: 100 bits
  private static final SecureRandom RANDOM = new SecureRandom();

  private final FamilyRepository families;
  private final Clock clock;

  public FamilyService(FamilyRepository families, Clock clock) {
    this.families = families;
    this.clock = clock;
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
