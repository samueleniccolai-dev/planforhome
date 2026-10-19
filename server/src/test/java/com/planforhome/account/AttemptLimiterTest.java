package com.planforhome.account;

import static org.assertj.core.api.Assertions.assertThat;

import com.planforhome.acceptance.AcceptanceClock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;

class AttemptLimiterTest {

  private final AcceptanceClock clock = new AcceptanceClock();

  @Test
  void blocksAfterTheMaximumAndFreesWhenTheWindowPasses() {
    AttemptLimiter limiter = new AttemptLimiter(clock, 3, Duration.ofMinutes(15), 100);
    for (int i = 0; i < 3; i++) {
      assertThat(limiter.retryAfterSeconds("a")).isEmpty();
      limiter.record("a");
    }
    assertThat(limiter.retryAfterSeconds("a")).hasValue(900);
    assertThat(limiter.retryAfterSeconds("b")).isEmpty();

    clock.advance(Duration.ofMinutes(15));
    assertThat(limiter.retryAfterSeconds("a")).isEmpty();
  }

  @Test
  void theMapNeverGrowsPastTheCapAndDropsTheOldestKeys() {
    AttemptLimiter limiter = new AttemptLimiter(clock, 1, Duration.ofHours(1), 10);
    for (int i = 0; i < 50; i++) {
      limiter.record("key" + i);
      clock.advance(Duration.ofSeconds(1));
    }
    assertThat(limiter.size()).isLessThanOrEqualTo(10);
    assertThat(limiter.retryAfterSeconds("key49")).isPresent();
    assertThat(limiter.retryAfterSeconds("key0")).isEmpty();
  }

  @Test
  void expiredWindowsAreRemoved() {
    AttemptLimiter limiter = new AttemptLimiter(clock, 1, Duration.ofMinutes(1), 10);
    for (int i = 0; i < 10; i++) {
      limiter.record("old" + i);
    }
    clock.advance(Duration.ofMinutes(2));
    limiter.record("new");
    limiter.record("new2");
    assertThat(limiter.size()).isLessThanOrEqualTo(10);
    assertThat(limiter.retryAfterSeconds("new")).isPresent();
  }

  @Test
  void parallelCallersNeverGetMoreSlotsThanTheMaximum() throws Exception {
    AttemptLimiter limiter = new AttemptLimiter(clock, 5, Duration.ofMinutes(15), 100);
    int threads = 30;
    CountDownLatch ready = new CountDownLatch(threads);
    CountDownLatch go = new CountDownLatch(1);
    ExecutorService pool = Executors.newFixedThreadPool(threads);
    try {
      List<Future<Boolean>> results = new ArrayList<>();
      for (int i = 0; i < threads; i++) {
        results.add(
            pool.submit(
                () -> {
                  ready.countDown();
                  go.await();
                  return limiter.tryAcquire("ip").granted();
                }));
      }
      ready.await();
      go.countDown();
      int granted = 0;
      for (Future<Boolean> f : results) {
        if (f.get()) {
          granted++;
        }
      }
      assertThat(granted).isEqualTo(5);
    } finally {
      pool.shutdownNow();
    }
    assertThat(limiter.tryAcquire("ip").retryAfterSeconds()).isEqualTo(900);
  }

  @Test
  void aReleasedSlotIsFreeAgain() {
    AttemptLimiter limiter = new AttemptLimiter(clock, 1, Duration.ofMinutes(15), 100);
    AttemptLimiter.Acquisition first = limiter.tryAcquire("a");
    assertThat(first.granted()).isTrue();
    assertThat(limiter.tryAcquire("a").granted()).isFalse();
    limiter.release("a", first.at());
    assertThat(limiter.tryAcquire("a").granted()).isTrue();
  }
}
