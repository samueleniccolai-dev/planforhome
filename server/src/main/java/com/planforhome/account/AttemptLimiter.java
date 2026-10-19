package com.planforhome.account;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory sliding-window limit on attempts per key (one process in R0). Windows are measured on
 * the injected clock; expired windows are dropped and the map never holds more than {@code maxKeys}
 * keys: beyond that the keys with the oldest last attempt are discarded.
 */
public final class AttemptLimiter {

  private final Clock clock;
  private final int maxAttempts;
  private final Duration window;
  private final int maxKeys;
  private final ConcurrentHashMap<String, ArrayDeque<Instant>> attempts = new ConcurrentHashMap<>();

  public AttemptLimiter(Clock clock, int maxAttempts, Duration window, int maxKeys) {
    this.clock = clock;
    this.maxAttempts = maxAttempts;
    this.window = window;
    this.maxKeys = maxKeys;
  }

  /** Empty if the key may proceed; otherwise the seconds to wait (at least 1). */
  public OptionalLong retryAfterSeconds(String key) {
    ArrayDeque<Instant> deque = attempts.get(key);
    if (deque == null) {
      return OptionalLong.empty();
    }
    Instant now = clock.instant();
    synchronized (deque) {
      prune(deque, now);
      if (deque.size() < maxAttempts) {
        return OptionalLong.empty();
      }
      Instant free = deque.peekFirst().plus(window);
      long seconds = Duration.between(now, free).toSeconds();
      return OptionalLong.of(Math.max(1, seconds));
    }
  }

  public void record(String key) {
    Instant now = clock.instant();
    ArrayDeque<Instant> deque = attempts.computeIfAbsent(key, k -> new ArrayDeque<>());
    synchronized (deque) {
      prune(deque, now);
      deque.addLast(now);
    }
    if (attempts.size() > maxKeys) {
      evict(now);
    }
  }

  int size() {
    return attempts.size();
  }

  private void prune(ArrayDeque<Instant> deque, Instant now) {
    while (!deque.isEmpty() && !deque.peekFirst().plus(window).isAfter(now)) {
      deque.removeFirst();
    }
  }

  private void evict(Instant now) {
    attempts.entrySet().removeIf(e -> isExpired(e.getValue(), now));
    int target = maxKeys * 9 / 10;
    if (attempts.size() <= maxKeys) {
      return;
    }
    List<Map.Entry<String, ArrayDeque<Instant>>> oldestFirst =
        attempts.entrySet().stream()
            .sorted(Comparator.comparing(e -> lastOf(e.getValue())))
            .toList();
    for (int i = 0; i < oldestFirst.size() && attempts.size() > target; i++) {
      attempts.remove(oldestFirst.get(i).getKey());
    }
  }

  private boolean isExpired(ArrayDeque<Instant> deque, Instant now) {
    synchronized (deque) {
      prune(deque, now);
      return deque.isEmpty();
    }
  }

  private Instant lastOf(ArrayDeque<Instant> deque) {
    synchronized (deque) {
      return deque.isEmpty() ? Instant.MIN : deque.peekLast();
    }
  }
}
