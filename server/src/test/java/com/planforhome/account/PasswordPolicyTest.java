package com.planforhome.account;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PasswordPolicyTest {

  private final PasswordPolicy policy = new PasswordPolicy();

  @Test
  void acceptsAGoodPasswordAndExactly72Bytes() {
    assertThat(policy.violation("Lanterna-Blu-42")).isEmpty();
    assertThat(policy.violation("x".repeat(72))).isEmpty();
  }

  @Test
  void refusesShortCommonAndTooLongByBytes() {
    assertThat(policy.violation("Corta-1")).hasValue("password_too_short");
    assertThat(policy.violation("password123")).hasValue("password_too_common");
    assertThat(policy.violation("PASSWORD123")).hasValue("password_too_common");
    assertThat(policy.violation("a".repeat(73))).hasValue("password_too_long");
    assertThat(policy.violation("à".repeat(37))).hasValue("password_too_long");
    assertThat(policy.violation(null)).hasValue("password_too_short");
  }
}
