package com.planforhome.acceptance;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * A clock the acceptance tests move by hand. It replaces the server clock as the primary bean, so
 * every instant the server writes or compares (sessions, invites, attempt windows) must come from
 * it: an instant taken from the database ({@code now()}) or from the system would be years away.
 */
public class AcceptanceClock extends Clock {

  /** Far from the real date on purpose: an instant not taken from this clock stands out. */
  public static final Instant START = Instant.parse("2031-01-06T08:00:00Z");

  private final AtomicReference<Instant> now = new AtomicReference<>(START);

  @Override
  public ZoneId getZone() {
    return ZoneOffset.UTC;
  }

  @Override
  public Clock withZone(ZoneId zone) {
    return Clock.fixed(now.get(), zone);
  }

  @Override
  public Instant instant() {
    return now.get();
  }

  public Instant advance(Duration duration) {
    return now.updateAndGet(current -> current.plus(duration));
  }

  /**
   * Moves the clock forward to {@code target}. Never backwards: sessions, invites and attempt
   * windows already written would be in the future. A target in the past is a mistake in the order
   * of the tests, and fails at once.
   */
  public Instant setTo(Instant target) {
    return now.updateAndGet(
        current -> {
          if (target.isBefore(current)) {
            throw new IllegalStateException(
                "the acceptance clock only moves forward: " + current + " -> " + target);
          }
          return target;
        });
  }

  @TestConfiguration(proxyBeanMethods = false)
  public static class Config {

    @Bean
    @Primary
    public AcceptanceClock acceptanceClock() {
      return new AcceptanceClock();
    }
  }
}
