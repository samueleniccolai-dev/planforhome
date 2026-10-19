package com.planforhome.common;

import java.security.SecureRandom;
import java.time.Clock;
import java.util.UUID;

/** Time-ordered UUIDs (version 7, RFC 9562) without a library. */
public final class UuidV7 {

  private static final SecureRandom RANDOM = new SecureRandom();

  private UuidV7() {}

  public static UUID next(Clock clock) {
    long millis = clock.millis();
    long msb = (millis << 16) | 0x7000L | (RANDOM.nextInt() & 0x0FFF);
    long lsb = (RANDOM.nextLong() & 0x3FFFFFFFFFFFFFFFL) | 0x8000000000000000L;
    return new UUID(msb, lsb);
  }
}
