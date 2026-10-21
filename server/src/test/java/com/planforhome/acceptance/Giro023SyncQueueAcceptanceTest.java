package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import org.junit.jupiter.api.Test;

/**
 * Round 023, S1: the offline queue of Giulia is sent in order, then sent again with the same
 * mutation ids. It takes effect once; the change log has one row per write of the first sending and
 * none for the second. The PUT carries no {@code version} (chained queued writes on the same entity
 * do not know the version produced by the previous ones).
 */
class Giro023SyncQueueAcceptanceTest extends Giro023SyncAcceptanceSupport {

  @Test
  void aQueueSentTwiceTakesEffectOnceAndInOrder() throws Exception {
    Families f = families();
    User giulia = f.giulia();
    String p = f.principale();
    long before = seqOk(giulia.token(), p);

    String taskId = id();
    String create = id();
    String takeIt = id();
    String edit = id();
    String finish = id();
    List<Callable<Response>> queue =
        List.of(
            () -> createTask(giulia.token(), p, create, "id", taskId, "title", PIANTE),
            () -> take(giulia.token(), p, taskId, takeIt),
            () -> update(giulia.token(), p, taskId, edit, "title", PIANTE_BALCONE),
            () -> done(giulia.token(), p, taskId, finish));

    List<Long> versions = new ArrayList<>();
    for (Callable<Response> write : queue) {
      Response answer = write.call();
      assertThat(answer.status()).as("first sending: " + answer.body()).isBetween(200, 201);
      versions.add(version(answer));
    }
    for (int i = 1; i < versions.size(); i++) {
      assertThat(versions.get(i)).as("versions " + versions).isEqualTo(versions.get(i - 1) + 1);
    }
    long last = versions.get(versions.size() - 1);
    assertThat(changeLog(taskId)).as("change_log after the first sending").hasSize(4);

    for (Callable<Response> write : queue) {
      Response answer = write.call();
      assertThat(answer.status()).as("second sending: " + answer.body()).isBetween(200, 201);
    }
    assertThat(changeLog(taskId)).as("change_log after the second sending").hasSize(4);
    assertThat(appliedMutations(taskId)).isEqualTo(4);
    Map<String, Object> stored = task(giulia.token(), p, taskId);
    assertThat(stored).containsEntry("status", "DONE").containsEntry("title", PIANTE_BALCONE);
    assertThat(version(stored)).isEqualTo(last);

    Page page = changesOk(giulia.token(), p, before, null);
    Map<String, Object> row = rowOf(page.changes(), taskId);
    assertUpsert(row, "task");
    assertThat(data(row)).containsEntry("status", "DONE").containsEntry("title", PIANTE_BALCONE);
    assertThat(number(data(row).get("version"))).isEqualTo(last);
    assertThat(page.hasMore()).isFalse();
  }
}
