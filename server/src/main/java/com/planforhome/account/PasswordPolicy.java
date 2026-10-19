package com.planforhome.account;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Password rules: at least 10 characters, at most 72 UTF-8 bytes (BCrypt), not a common one. */
@Component
public class PasswordPolicy {

  static final int MIN_LENGTH = 10;
  static final int MAX_BYTES = 72;

  private final Set<String> common = loadCommon();

  /** The error code of the first broken rule, or empty if the password is acceptable. */
  public Optional<String> violation(String password) {
    if (password == null || password.length() < MIN_LENGTH) {
      return Optional.of("password_too_short");
    }
    if (tooLong(password)) {
      return Optional.of("password_too_long");
    }
    if (common.contains(password.toLowerCase(Locale.ROOT))) {
      return Optional.of("password_too_common");
    }
    return Optional.empty();
  }

  static boolean tooLong(String password) {
    return password.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES;
  }

  private static Set<String> loadCommon() {
    try (BufferedReader reader =
        new BufferedReader(
            new InputStreamReader(
                PasswordPolicy.class.getResourceAsStream("/common-passwords.txt"),
                StandardCharsets.UTF_8))) {
      return reader
          .lines()
          .map(String::trim)
          .filter(line -> !line.isEmpty() && !line.startsWith("#"))
          .map(line -> line.toLowerCase(Locale.ROOT))
          .collect(Collectors.toUnmodifiableSet());
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
