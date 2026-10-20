package com.planforhome.common;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/** Conversions between {@link Instant} and the {@code timestamptz} values of JDBC. */
public final class Time {

  private Time() {}

  public static OffsetDateTime db(Instant instant) {
    return instant == null ? null : OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
  }
}
