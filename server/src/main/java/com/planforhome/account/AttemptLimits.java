package com.planforhome.account;

import java.time.Clock;
import java.time.Duration;
import org.springframework.stereotype.Component;

/** The three attempt limits of the access API. */
@Component
public class AttemptLimits {

  static final int MAX_KEYS = 10_000;

  /** Failed logins per normalised e-mail: 5 in 15 minutes. */
  public final AttemptLimiter login;

  /** Registrations per IP: 10 in an hour. */
  public final AttemptLimiter registration;

  /** Refused invite codes per IP: 5 in an hour. */
  public final AttemptLimiter inviteCodes;

  public AttemptLimits(Clock clock) {
    this.login = new AttemptLimiter(clock, 5, Duration.ofMinutes(15), MAX_KEYS);
    this.registration = new AttemptLimiter(clock, 10, Duration.ofHours(1), MAX_KEYS);
    this.inviteCodes = new AttemptLimiter(clock, 5, Duration.ofHours(1), MAX_KEYS);
  }
}
