package com.planforhome.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClockConfig {

  /** The only source of "now" in the server; tests replace it with a fixed clock. */
  @Bean
  public Clock clock() {
    return Clock.systemUTC();
  }
}
