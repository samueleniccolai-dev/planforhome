package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 019, T8 part 2 (server): contestation 018-a. Every member adds, checks and reorders; the
 * creator of the list and the managers remove an item for real; any other member strikes it
 * («removed by X»): the item stays in {@code GET items} and anybody restores it. A struck item is
 * not checked ({@code 409 item_removed}). Same application context as rounds 003 to 018.
 */
class Giro019ShoppingRemovalAcceptanceTest extends Giro019AcceptanceSupport {

  // ---------------------------------------------------------------- everybody writes

  @Test
  void davideAndPaoloAddCheckAndReorderAListThatIsNotTheirs() throws Exception {
    Sabato s = sabato();
    Families f = s.f();

    String burro = addOk(f.paolo().token(), f.mamma(), s.list(), "Burro");
    assertOk(check(f.paolo().token(), f.mamma(), s.list(), s.latte(), true));
    assertOk(check(f.davide().token(), f.mamma(), s.list(), s.pane(), true));
    assertOk(
        order(
            f.paolo().token(),
            f.mamma(),
            s.list(),
            List.of(s.mele(), s.uova(), s.pane(), s.latte(), burro)));

    List<Map<String, Object>> items = items(f.anna().token(), f.mamma(), s.list());
    assertThat(texts(items)).containsExactly("Mele", "Uova", "Pane", "Latte", "Burro");
    assertThat(checks(items)).containsExactly(false, false, true, true, false);
    assertThat(createdBy(item(items, burro))).isEqualTo(f.paolo().personId());
  }

  // ---------------------------------------------------------------- author

  @Test
  void everyItemSaysWhoAddedItAndNobodyRemovedIt() throws Exception {
    Sabato s = sabato();
    Families f = s.f();

    List<Map<String, Object>> items = items(f.paolo().token(), f.mamma(), s.list());
    assertThat(createdBy(item(items, s.latte()))).isEqualTo(f.luca().personId());
    assertThat(createdBy(item(items, s.pane()))).isEqualTo(f.luca().personId());
    assertThat(createdBy(item(items, s.uova()))).isEqualTo(f.davide().personId());
    assertThat(createdBy(item(items, s.mele()))).isEqualTo(f.davide().personId());
    assertThat(removers(items)).containsOnlyNulls().hasSize(4);

    Response added = add(f.paolo().token(), f.mamma(), s.list(), "Burro");
    assertThat(added.status()).as(added.body()).isEqualTo(201);
    assertThat(createdBy(object(added))).isEqualTo(f.paolo().personId());
    assertThat(removedBy(object(added))).isNull();
  }

  // ---------------------------------------------------------------- creator and manager remove

  @Test
  void lucaTheCreatorAndAnnaTheManagerRemoveForReal() throws Exception {
    Sabato s = sabato();
    Families f = s.f();

    Response latte = remove(f.luca().token(), f.mamma(), s.list(), s.latte());
    assertCancelled(latte, f.luca());
    Response pane = remove(f.anna().token(), f.mamma(), s.list(), s.pane());
    assertCancelled(pane, f.anna());

    assertThat(texts(items(f.davide().token(), f.mamma(), s.list())))
        .containsExactly("Uova", "Mele");
    assertThat(changeLog(s.latte())).last().isEqualTo(itemRow(f.mamma(), "DELETE"));
    assertThat(changeLog(s.pane())).last().isEqualTo(itemRow(f.mamma(), "DELETE"));
    assertThat(storedItem(s.latte()).get("removed_by")).isEqualTo(f.luca().personId());
    assertThat(storedItem(s.pane()).get("deleted_at")).isNotNull();
  }

  @Test
  void pietroTheOtherManagerRemovesForRealToo() throws Exception {
    Sabato s = sabato();
    Families f = s.f();
    assertCancelled(remove(f.pietro().token(), f.mamma(), s.list(), s.uova()), f.pietro());
    assertThat(texts(items(f.luca().token(), f.mamma(), s.list())))
        .containsExactly("Latte", "Pane", "Mele");
  }

  // ---------------------------------------------------------------- a member strikes

  @Test
  void davideStrikesUovaItStaysAndPaoloCannotStrikeOrCheckItAgain() throws Exception {
    Sabato s = sabato();
    Families f = s.f();
    long before = version(item(items(f.luca().token(), f.mamma(), s.list()), s.uova()));
    int logRows = changeLog(s.uova()).size();

    Response struck = remove(f.davide().token(), f.mamma(), s.list(), s.uova());
    assertStruck(struck, f.davide());
    assertThat(version(struck)).isEqualTo(before + 1);

    List<Map<String, Object>> items = items(f.anna().token(), f.mamma(), s.list());
    assertThat(texts(items)).containsExactly("Latte", "Pane", "Uova", "Mele");
    assertThat(removedBy(item(items, s.uova()))).isEqualTo(f.davide().personId());
    assertThat(item(items, s.uova()).get("deletedAt")).isNull();
    assertThat(changeLog(s.uova()))
        .hasSize(logRows + 1)
        .last()
        .isEqualTo(itemRow(f.mamma(), "UPSERT"));

    assertError(remove(f.paolo().token(), f.mamma(), s.list(), s.uova()), 409, "item_removed");
    assertError(check(f.paolo().token(), f.mamma(), s.list(), s.uova(), true), 409, "item_removed");
    Map<String, Object> after = item(items(f.anna().token(), f.mamma(), s.list()), s.uova());
    assertThat(version(after)).isEqualTo(before + 1);
    assertThat(after.get("checked")).isEqualTo(false);
    assertThat(changeLog(s.uova())).hasSize(logRows + 1);
  }

  // ---------------------------------------------------------------- restore

  @Test
  void paoloRestoresUovaAndTheOtherRestoresAreRefused() throws Exception {
    Sabato s = sabato();
    Families f = s.f();
    Response struck = remove(f.davide().token(), f.mamma(), s.list(), s.uova());
    assertStruck(struck, f.davide());
    assertCancelled(remove(f.luca().token(), f.mamma(), s.list(), s.latte()), f.luca());

    Response restored = restore(f.paolo().token(), f.mamma(), s.list(), s.uova());
    assertThat(restored.status()).as(restored.body()).isEqualTo(200);
    assertThat(removedBy(object(restored))).isNull();
    assertThat(version(restored)).isEqualTo(version(struck) + 1);
    assertThat(changeLog(s.uova())).last().isEqualTo(itemRow(f.mamma(), "UPSERT"));
    assertThat(removers(items(f.anna().token(), f.mamma(), s.list()))).containsOnlyNulls();

    assertError(restore(f.paolo().token(), f.mamma(), s.list(), s.mele()), 409, "not_removed");
    assertError(restore(f.paolo().token(), f.mamma(), s.list(), s.latte()), 404, "not_found");
    // Restored, it is checked again like any other item.
    assertOk(check(f.paolo().token(), f.mamma(), s.list(), s.uova(), true));
  }

  @Test
  void theCreatorRemovesAStruckItemForReal() throws Exception {
    Sabato s = sabato();
    Families f = s.f();
    assertStruck(remove(f.davide().token(), f.mamma(), s.list(), s.mele()), f.davide());

    assertCancelled(remove(f.luca().token(), f.mamma(), s.list(), s.mele()), f.luca());
    assertThat(texts(items(f.anna().token(), f.mamma(), s.list())))
        .containsExactly("Latte", "Pane", "Uova");
    assertThat(changeLog(s.mele())).last().isEqualTo(itemRow(f.mamma(), "DELETE"));
  }

  // ---------------------------------------------------------------- order of the checks

  @Test
  void aMissingMutationIdAndAListThatIsNotOpenAreRefusedFirst() throws Exception {
    Sabato s = sabato();
    Families f = s.f();
    assertError(
        remove(f.luca().token(), f.mamma(), s.list(), s.uova(), null), 400, "invalid_request");
    assertError(
        restore(f.luca().token(), f.mamma(), s.list(), s.uova(), "nope"), 400, "invalid_request");
    assertError(remove(f.luca().token(), f.mamma(), s.list(), id()), 404, "not_found");

    String foto = taskOk(f.anna().token(), f.mamma(), FOTO);
    assertError(remove(f.anna().token(), f.mamma(), foto, s.uova()), 409, "not_shopping_list");

    assertOk(done(f.anna().token(), f.mamma(), s.list()));
    assertError(remove(f.luca().token(), f.mamma(), s.list(), s.uova()), 409, "not_open");
    assertError(restore(f.luca().token(), f.mamma(), s.list(), s.uova()), 409, "not_open");
    assertThat(removers(items(f.anna().token(), f.mamma(), s.list()))).containsOnlyNulls();
  }

  // ---------------------------------------------------------------- replay

  @Test
  void theSameMutationIdOfARemoveOrARestoreGivesTheItemAsItIsNow() throws Exception {
    Sabato s = sabato();
    Families f = s.f();
    String strike = id();
    Response first = remove(f.davide().token(), f.mamma(), s.list(), s.uova(), strike);
    assertStruck(first, f.davide());
    int rows = changeLog(s.uova()).size();

    Response again = remove(f.davide().token(), f.mamma(), s.list(), s.uova(), strike);
    assertStruck(again, f.davide());
    assertThat(version(again)).isEqualTo(version(first));
    assertThat(changeLog(s.uova())).hasSize(rows);

    String back = id();
    Response restored = restore(f.paolo().token(), f.mamma(), s.list(), s.uova(), back);
    assertThat(restored.status()).as(restored.body()).isEqualTo(200);
    Response restoredAgain = restore(f.paolo().token(), f.mamma(), s.list(), s.uova(), back);
    assertThat(restoredAgain.status()).as(restoredAgain.body()).isEqualTo(200);
    assertThat(removedBy(object(restoredAgain))).isNull();
    assertThat(version(restoredAgain)).isEqualTo(version(restored));
    assertThat(changeLog(s.uova())).hasSize(rows + 1);

    // Replayed after the item changed again: the item as it is now (struck by Paolo).
    assertStruck(remove(f.paolo().token(), f.mamma(), s.list(), s.uova()), f.paolo());
    Response late = restore(f.paolo().token(), f.mamma(), s.list(), s.uova(), back);
    assertThat(late.status()).as(late.body()).isEqualTo(200);
    assertThat(removedBy(object(late))).isEqualTo(f.paolo().personId());

    String cancel = id();
    Response cancelled = remove(f.luca().token(), f.mamma(), s.list(), s.latte(), cancel);
    assertCancelled(cancelled, f.luca());
    int latteRows = changeLog(s.latte()).size();
    assertCancelled(remove(f.luca().token(), f.mamma(), s.list(), s.latte(), cancel), f.luca());
    assertThat(changeLog(s.latte())).hasSize(latteRows);
  }
}
