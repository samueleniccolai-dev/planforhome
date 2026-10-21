package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 023, S4: Luca joins Famiglia Principale with an invite code and gets the whole family in
 * one snapshot, with a seq; then only what changes after that seq.
 */
class Giro023SyncSnapshotAcceptanceTest extends Giro023SyncAcceptanceSupport {

  @Test
  void whoJoinsGetsTheWholeFamilyThenOnlyTheChangesAfterIt() throws Exception {
    Families f = families();
    User giulia = f.giulia();
    String p = f.principale();
    String piante = taskOk(giulia.token(), p, PIANTE);
    List3 spesa = spesa(giulia, p);
    String zucchero = addOk(giulia.token(), p, spesa.list(), "zucchero");
    assertCancelled(remove(giulia.token(), p, spesa.list(), zucchero), giulia);
    joinOk(f.luca(), invite(giulia.token(), p));

    Map<String, Object> snapshot = snapshotOk(f.luca().token(), p);
    assertThat(snapshot).containsEntry("familyId", p);
    long seq = number(snapshot.get("seq"));
    List<Long> raw = rawSeqs(p, 0);
    assertThat(seq).as("seq of the snapshot").isPositive().isEqualTo(raw.get(raw.size() - 1));

    List<Map<String, Object>> tasks = list(snapshot, "tasks");
    assertThat(ids(tasks)).containsExactlyInAnyOrder(piante, spesa.list());
    Map<String, Object> task = find(tasks, piante);
    assertThat(task)
        .containsEntry("title", PIANTE)
        .containsEntry("status", "OPEN")
        .containsKeys("version", "assigneePersonId", "dueAt", "template");
    assertThat(find(tasks, spesa.list())).containsEntry("template", "SHOPPING_LIST");

    List<Map<String, Object>> items = list(snapshot, "shoppingItems");
    assertThat(texts(items)).containsExactlyInAnyOrderElementsOf(SPESA);
    for (Map<String, Object> item : items) {
      assertThat(item)
          .containsEntry("taskId", spesa.list())
          .containsEntry("checked", false)
          .containsKeys("id", "position", "version");
    }

    List<Map<String, Object>> members = list(snapshot, "members");
    assertThat(members.stream().map(m -> m.get("personId")).toList())
        .containsExactlyInAnyOrder(giulia.personId(), f.marco().personId(), f.luca().personId());
    Map<String, Object> luca =
        members.stream()
            .filter(m -> f.luca().personId().equals(m.get("personId")))
            .findFirst()
            .orElseThrow();
    assertThat(luca).containsEntry("displayName", "Luca").containsEntry("role", "MEMBER");

    assertOk(update(giulia.token(), p, piante, id(), "title", PIANTE_BALCONE));
    Page after = changesOk(f.luca().token(), p, seq, null);
    assertThat(after.changes().stream().map(c -> c.get("entityId")).toList())
        .containsExactly(piante);
    assertThat(data(after.changes().get(0))).containsEntry("title", PIANTE_BALCONE);
    assertThat(after.hasMore()).isFalse();
  }
}
