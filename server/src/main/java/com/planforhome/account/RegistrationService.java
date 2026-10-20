package com.planforhome.account;

import com.planforhome.common.ApiException;
import com.planforhome.common.Names;
import com.planforhome.common.UuidV7;
import com.planforhome.family.FamilyRepository;
import com.planforhome.family.FamilyRepository.FamilyView;
import java.time.Clock;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/** Registration with a new family or with an invite code; a refusal creates nothing. */
@Service
public class RegistrationService {

  public record Request(
      String email,
      String password,
      String displayName,
      String locale,
      String familyName,
      String inviteCode) {}

  public record Result(UUID personId, List<FamilyView> families) {}

  private static final Set<String> LOCALES = Set.of("it", "en");
  private static final int MAX_EMAIL = 254;

  private final AccountService accountService;
  private final FamilyRepository families;
  private final PasswordPolicy policy;
  private final PasswordEncoder encoder;
  private final AttemptLimits limits;
  private final TransactionTemplate tx;
  private final Clock clock;

  public RegistrationService(
      AccountService accountService,
      FamilyRepository families,
      PasswordPolicy policy,
      PasswordEncoder encoder,
      AttemptLimits limits,
      TransactionTemplate tx,
      Clock clock) {
    this.accountService = accountService;
    this.families = families;
    this.policy = policy;
    this.encoder = encoder;
    this.limits = limits;
    this.tx = tx;
    this.clock = clock;
  }

  public Result register(Request request, String clientIp) {
    var blocked = limits.registration.tryAcquire(clientIp);
    if (!blocked.granted()) {
      throw ApiException.tooManyAttempts(blocked.retryAfterSeconds());
    }

    String rawFamilyName = blankToNull(request.familyName());
    String inviteCode = blankToNull(request.inviteCode());
    if ((rawFamilyName == null) == (inviteCode == null)) {
      throw ApiException.badRequest("registration_mode_required");
    }
    String email = AccountService.normalizeEmail(request.email());
    if (email.indexOf('\0') >= 0) {
      throw ApiException.badRequest("email_invalid");
    }
    if (email.isEmpty() || !email.contains("@") || email.length() > MAX_EMAIL) {
      throw ApiException.badRequest("email_invalid");
    }
    String displayName = Names.displayName(request.displayName());
    policy
        .violation(request.password())
        .ifPresent(
            code -> {
              throw ApiException.badRequest(code);
            });
    String familyName = rawFamilyName == null ? null : Names.familyName(rawFamilyName);
    if (!LOCALES.contains(request.locale())) {
      throw ApiException.badRequest("locale_invalid");
    }
    AttemptLimiter.Acquisition codeSlot = null;
    if (inviteCode != null) {
      codeSlot = limits.inviteCodes.tryAcquire(clientIp);
      if (!codeSlot.granted()) {
        throw ApiException.tooManyAttempts(codeSlot.retryAfterSeconds());
      }
    }

    String hash = encoder.encode(request.password());
    try {
      Result result =
          tx.execute(
              status -> create(email, hash, displayName, request.locale(), familyName, inviteCode));
      releaseCodeSlot(clientIp, codeSlot);
      return result;
    } catch (DuplicateKeyException e) {
      releaseCodeSlot(clientIp, codeSlot);
      throw new ApiException(HttpStatus.CONFLICT, "email_taken");
    } catch (InvalidInvite e) {
      throw ApiException.badRequest("invite_invalid");
    }
  }

  /** Only wrong codes count against the limit: a code that was not judged gives its slot back. */
  private void releaseCodeSlot(String clientIp, AttemptLimiter.Acquisition slot) {
    if (slot != null) {
      limits.inviteCodes.release(clientIp, slot.at());
    }
  }

  private Result create(
      String email,
      String hash,
      String displayName,
      String locale,
      String familyName,
      String inviteCode) {
    UUID personId = accountService.createPersonWithAccount(email, hash, displayName, locale);
    if (familyName != null) {
      UUID familyId = UuidV7.next(clock);
      families.insertFamily(familyId, familyName, clock.instant());
      families.insertMembership(familyId, personId, "MANAGER", null);
    } else {
      UUID familyId =
          families
              .consumeInvite(inviteCode, personId, clock.instant())
              .orElseThrow(InvalidInvite::new);
      families.insertMembership(familyId, personId, "MEMBER", null);
    }
    return new Result(personId, families.familiesOf(personId));
  }

  private static String blankToNull(String text) {
    return text == null || text.isBlank() ? null : text.trim();
  }

  /** Thrown inside the transaction to roll it back. */
  private static final class InvalidInvite extends RuntimeException {
    InvalidInvite() {
      super("invite_invalid", null, false, false);
    }
  }
}
