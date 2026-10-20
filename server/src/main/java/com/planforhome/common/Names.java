package com.planforhome.common;

import java.time.ZoneId;
import java.util.UUID;

/** Validation shared by every endpoint that takes a person, family or time zone name. */
public final class Names {

  private static final int MAX_NAME = 80;
  public static final String DEFAULT_TIME_ZONE = "Europe/Rome";

  private Names() {}

  /** The trimmed display name; 400 {@code display_name_invalid} if empty, too long or with NUL. */
  public static String displayName(String raw) {
    return valid(raw, "display_name_invalid");
  }

  /** The trimmed family name; 400 {@code family_name_invalid} if empty, too long or with NUL. */
  public static String familyName(String raw) {
    return valid(raw, "family_name_invalid");
  }

  /**
   * The zone id, {@value #DEFAULT_TIME_ZONE} if absent; 400 {@code time_zone_invalid} if unknown.
   */
  public static String timeZone(String raw) {
    if (raw == null || raw.isBlank()) {
      return DEFAULT_TIME_ZONE;
    }
    if (!ZoneId.getAvailableZoneIds().contains(raw.trim())) {
      throw ApiException.badRequest("time_zone_invalid");
    }
    return raw.trim();
  }

  /** The UUID of a text, or null if it is absent or not a UUID. */
  public static UUID uuidOrNull(String raw) {
    try {
      return raw == null ? null : UUID.fromString(raw.trim());
    } catch (IllegalArgumentException e) {
      return null;
    }
  }

  private static String valid(String raw, String code) {
    String name = raw == null ? "" : raw.trim();
    if (name.isEmpty() || name.length() > MAX_NAME || name.indexOf('\0') >= 0) {
      throw ApiException.badRequest(code);
    }
    return name;
  }
}
