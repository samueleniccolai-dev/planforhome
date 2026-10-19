package com.planforhome.health;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class HealthControllerTest {

  @Test
  void reportsUpWithTheConfiguredSha() {
    var health = new HealthController("abc123").health();

    assertThat(health.status()).isEqualTo("UP");
    assertThat(health.sha()).isEqualTo("abc123");
  }
}
