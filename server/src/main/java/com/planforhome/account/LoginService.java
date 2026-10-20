package com.planforhome.account;

import com.planforhome.account.AccountRepository.Credentials;
import com.planforhome.common.ApiException;
import com.planforhome.common.UuidV7;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Login, logout, bearer-token sessions and password change. */
@Service
public class LoginService {

  static final Duration SESSION_LENGTH = Duration.ofDays(30);

  public record LoginResult(String token, Instant expiresAt, UUID personId) {}

  private static final SecureRandom RANDOM = new SecureRandom();

  private final AccountRepository accounts;
  private final PasswordEncoder encoder;
  private final PasswordPolicy policy;
  private final AttemptLimits limits;
  private final Clock clock;

  /** Checked for unknown e-mails so that they cost as much as a wrong password. */
  private final String dummyHash;

  public LoginService(
      AccountRepository accounts,
      PasswordEncoder encoder,
      PasswordPolicy policy,
      AttemptLimits limits,
      Clock clock) {
    this.accounts = accounts;
    this.encoder = encoder;
    this.policy = policy;
    this.limits = limits;
    this.clock = clock;
    this.dummyHash = encoder.encode("not-the-password-of-anyone");
  }

  public LoginResult login(String rawEmail, String password) {
    String email = AccountService.normalizeEmail(rawEmail);
    if (email.indexOf('\0') >= 0) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials");
    }
    AttemptLimiter.Acquisition slot = limits.login.tryAcquire(email);
    if (!slot.granted()) {
      throw ApiException.tooManyAttempts(slot.retryAfterSeconds());
    }
    Optional<Credentials> found = accounts.credentials(email);
    String hash = found.map(Credentials::passwordHash).orElse(dummyHash);
    boolean usable = password != null && !PasswordPolicy.tooLong(password);
    boolean matches = encoder.matches(usable ? password : "", hash);
    if (!matches || !usable || found.isEmpty() || found.get().disabled()) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials");
    }
    limits.login.release(email, slot.at());
    Instant now = clock.instant();
    Instant expiresAt = now.plus(SESSION_LENGTH);
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    UUID personId = found.get().personId();
    if (!accounts.insertSessionIfHash(
        UuidV7.next(clock), hash(token), personId, hash, now, expiresAt)) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials");
    }
    return new LoginResult(token, expiresAt, personId);
  }

  /** Extends the session by the session length; 401 if it is no longer live. */
  public Instant refresh(AuthUser user) {
    Instant now = clock.instant();
    Instant expiresAt = now.plus(SESSION_LENGTH);
    if (!accounts.renewSession(user.sessionId(), now, expiresAt)) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "invalid_session");
    }
    return expiresAt;
  }

  public void logout(AuthUser user) {
    accounts.revokeSession(user.sessionId(), clock.instant());
  }

  /** The caller of a bearer token, if the session is live. */
  public Optional<AuthUser> authenticate(String token) {
    return accounts
        .liveSession(hash(token), clock.instant())
        .map(s -> new AuthUser(s.personId(), s.sessionId()));
  }

  @Transactional
  public void changePassword(UUID personId, UUID sessionId, String current, String next) {
    if (current == null || next == null) {
      throw ApiException.badRequest("invalid_request");
    }
    String hash = accounts.passwordHash(personId).orElseThrow(ApiException::notFound);
    if (PasswordPolicy.tooLong(current) || !encoder.matches(current, hash)) {
      throw ApiException.badRequest("current_password_wrong");
    }
    policy
        .violation(next)
        .ifPresent(
            code -> {
              throw ApiException.badRequest(code);
            });
    accounts.updatePasswordHash(personId, encoder.encode(next));
    accounts.revokeOtherSessions(personId, sessionId, clock.instant());
  }

  static String hash(String token) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
