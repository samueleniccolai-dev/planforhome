package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 023, S2, S2b and S3: the changes of a family after a seq. Raw pages of the change log
 * ({@code limit} counts raw rows, {@code lastSeq} is the highest raw seq of the page), one row per
 * entity, deletions with {@code data} null, and a forwarded list that never shows its title or its
 * items in the family it left.
 */
class Giro023SyncChangesAcceptanceTest extends Giro023SyncAcceptanceSupport {

  @Test
  void changesCarryTheCurrentStateAndTheDeletions() throws Exception {
    Families f = families();
    User giulia = f.giulia();
    String p = f.principale();
    long before = seqOk(giulia.token(), p);

    String piante = taskOk(giulia.token(), p, PIANTE);
    assertOk(update(giulia.token(), p, piante, id(), "title", PIANTE_BALCONE));
    List3 spesa = spesa(giulia, p);
    String latte = spesa.items().get(0);
    assertCancelled(remove(giulia.token(), p, spesa.list(), latte), giulia);

    Page page = changesOk(giulia.token(), p, before, null);
    Map<String, Object> task = rowOf(page.changes(), piante);
    assertUpsert(task, "task");
    assertThat(data(task)).containsEntry("title", PIANTE_BALCONE).containsEntry("status", "OPEN");
    assertThat(number(data(task).get("version"))).isEqualTo(2);
    assertDeletion(rowOf(page.changes(), latte), "shopping_item");
    assertUpsert(rowOf(page.changes(), spesa.list()), "task");
    Map<String, Object> uova = rowOf(page.changes(), spesa.items().get(1));
    assertUpsert(uova, "shopping_item");
    assertThat(data(uova)).containsEntry("text", "uova").containsEntry("taskId", spesa.list());
    assertThat(page.hasMore()).isFalse();
    List<Long> raw = rawSeqs(p, before);
    assertThat(page.lastSeq()).isEqualTo(raw.get(raw.size() - 1));
    List<Long> seqs = page.changes().stream().map(c -> number(c.get("seq"))).toList();
    assertThat(seqs).as("seq order").isSorted().doesNotHaveDuplicates();

    Page empty = changesOk(giulia.token(), p, page.lastSeq(), null);
    assertThat(empty.changes()).isEmpty();
    assertThat(empty.hasMore()).isFalse();
    assertThat(empty.lastSeq()).isEqualTo(page.lastSeq());
  }

  @Test
  void limitCountsTheRawRowsAndLastSeqIsTheHighestRawSeq() throws Exception {
    Families f = families();
    User giulia = f.giulia();
    String p = f.principale();
    long before = seqOk(giulia.token(), p);
    String piante = taskOk(giulia.token(), p, PIANTE);
    assertOk(update(giulia.token(), p, piante, id(), "title", PIANTE_BALCONE));
    assertOk(update(giulia.token(), p, piante, id(), "title", PIANTE_GIARDINO));
    String spesa = taskOk(giulia.token(), p, PANE);

    List<Page> pages = walk(giulia.token(), p, before, 1);
    List<Long> raw = rawSeqs(p, before);
    assertThat(raw).hasSize(4);
    assertThat(pages.stream().map(Page::lastSeq).toList())
        .as("lastSeq of every page")
        .isEqualTo(raw);
    for (int i = 0; i < pages.size(); i++) {
      assertThat(pages.get(i).changes()).as(pages.get(i).body()).hasSize(1);
      assertThat(pages.get(i).hasMore()).as("hasMore of page " + i).isEqualTo(i < raw.size() - 1);
    }
    assertThat(all(pages).stream().map(c -> c.get("entityId")).toList())
        .containsExactly(piante, piante, piante, spesa);

    Page two = changesOk(giulia.token(), p, before, 2);
    Map<String, Object> row = rowOf(two.changes(), piante);
    assertThat(two.changes()).as(two.body()).hasSize(1);
    assertThat(number(row.get("seq"))).isEqualTo(raw.get(1));
    assertThat(two.lastSeq()).isEqualTo(raw.get(1));
    assertThat(two.hasMore()).isTrue();
    assertThat(data(row)).containsEntry("title", PIANTE_GIARDINO);
  }

  @Test
  void anAfterOrALimitThatIsNotValidIsABadRequest() throws Exception {
    Families f = families();
    String token = f.giulia().token();
    String p = f.principale();
    assertThat(changesOk(token, p, 0, 500).changes()).isEmpty();
    for (String query : List.of("?limit=0", "?limit=501", "?after=-1", "?after=abc", "?limit=x")) {
      Response bad = changes(token, p, query);
      assertThat(bad.status()).as(query + ": " + bad.body()).isEqualTo(400);
    }
  }

  @Test
  void twoWritersAtOnceLeaveNoHoleInThePages() throws Exception {
    Families f = families();
    User giulia = f.giulia();
    User marco = f.marco();
    String p = f.principale();
    long before = seqOk(giulia.token(), p);
    String a = id();
    String b = id();
    String c = id();
    String d = id();
    List<Response> created =
        together(
            () -> createTask(giulia.token(), p, id(), "id", a, "title", PIANTE),
            () -> createTask(giulia.token(), p, id(), "id", b, "title", PANE),
            () -> createTask(marco.token(), p, id(), "id", c, "title", BIKE),
            () -> createTask(marco.token(), p, id(), "id", d, "title", PRANZO));
    assertThat(statuses(created)).containsOnly(201);

    List<Page> pages = walk(giulia.token(), p, before, 1);
    List<Object> seen = all(pages).stream().map(r -> r.get("entityId")).toList();
    assertThat(seen).containsExactlyInAnyOrder(a, b, c, d);
    assertThat(pages.stream().map(Page::lastSeq).toList()).isEqualTo(rawSeqs(p, before));
  }

  @Test
  void aForwardedListNeverShowsItsTitleOrItsItemsInTheFamilyItLeft() throws Exception {
    Families f = families();
    User giulia = f.giulia();
    String p = f.principale();
    String m = f.mamma();
    long before = seqOk(giulia.token(), p);
    List3 spesa = spesa(giulia, p);
    long mammaBefore = seqOk(giulia.token(), m);
    Response forwarded = forwardTo(giulia.token(), p, spesa.list(), m);
    assertThat(forwarded.status()).as("forward: " + forwarded.body()).isEqualTo(200);

    List<Page> pages = walk(giulia.token(), p, before, 1);
    pages.add(changesOk(giulia.token(), p, before, null));
    for (Page page : pages) {
      assertThat(page.body()).as("a page of Principale").doesNotContain(PANE);
      for (String text : SPESA) {
        assertThat(page.body()).as("a page of Principale").doesNotContain("\"" + text + "\"");
      }
      for (Map<String, Object> row : page.changes()) {
        assertDeletion(row, spesa.list().equals(row.get("entityId")) ? "task" : "shopping_item");
      }
    }
    Page latest = pages.get(pages.size() - 1);
    assertDeletion(rowOf(latest.changes(), spesa.list()), "task");
    for (String item : spesa.items()) {
      assertDeletion(rowOf(latest.changes(), item), "shopping_item");
    }

    Page mamma = changesOk(giulia.token(), m, mammaBefore, null);
    Map<String, Object> task = rowOf(mamma.changes(), spesa.list());
    assertUpsert(task, "task");
    assertThat(data(task)).containsEntry("title", PANE);
    for (int i = 0; i < SPESA.size(); i++) {
      Map<String, Object> item = rowOf(mamma.changes(), spesa.items().get(i));
      assertUpsert(item, "shopping_item");
      assertThat(data(item)).containsEntry("text", SPESA.get(i));
    }
  }
}
