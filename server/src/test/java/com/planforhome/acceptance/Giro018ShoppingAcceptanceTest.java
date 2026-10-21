package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 018, T8 part 1 (server): the shopping list of a task (SPEC 2.2.7). A task created with
 * {@code template = SHOPPING_LIST} has items: added with one line at the bottom, checked one by one
 * (only that row changes), reordered (the last one wins), and the checked ones cleared. Every
 * member of the family may do all of it (decision 018-a). Same application context as rounds 003 to
 * 016; every test registers its own families.
 */
class Giro018ShoppingAcceptanceTest extends Giro018AcceptanceSupport {

  record Sabato(World w, String list, String latte, String pane, String uova, String mele) {}

  /** «Spesa del sabato» of Luca, in Mamma, with «Latte», «Pane», «Uova», «Mele». */
  Sabato sabato() throws Exception {
    World w = world();
    String list = listOk(w.luca().token(), w.mamma(), SABATO);
    String latte = addOk(w.luca().token(), w.mamma(), list, "Latte");
    String pane = addOk(w.luca().token(), w.mamma(), list, "Pane");
    String uova = addOk(w.luca().token(), w.mamma(), list, "Uova");
    String mele = addOk(w.luca().token(), w.mamma(), list, "Mele");
    return new Sabato(w, list, latte, pane, uova, mele);
  }

  // ---------------------------------------------------------------- creation with a template

  @Test
  void lucaCreatesAShoppingListAndATaskWithoutTemplateIsNone() throws Exception {
    World w = world();
    String listId = id();
    Response list =
        createWithTemplate(w.luca().token(), w.mamma(), listId, SABATO, "\"SHOPPING_LIST\"");
    assertThat(list.status()).as(list.body()).isEqualTo(201);
    assertThat(object(list)).containsEntry("template", "SHOPPING_LIST");
    assertThat(task(w.anna().token(), w.mamma(), listId))
        .containsEntry("template", "SHOPPING_LIST");

    String plainId = id();
    Response plain = createWithTemplate(w.luca().token(), w.mamma(), plainId, FOTO, null);
    assertThat(plain.status()).as(plain.body()).isEqualTo(201);
    assertThat(object(plain)).containsEntry("template", "NONE");

    String wrongId = id();
    assertError(
        createWithTemplate(w.luca().token(), w.mamma(), wrongId, "Dichiarazione", "\"730\""),
        400,
        "template_invalid");
    assertThat(ids(tasks(w.anna().token(), w.mamma()))).doesNotContain(wrongId);
  }

  @Test
  void theTemplateDoesNotChangeWithThePutOfTheTask() throws Exception {
    World w = world();
    String list = listOk(w.luca().token(), w.mamma(), SABATO);
    Response put =
        updateRaw(
            w.luca().token(),
            w.mamma(),
            list,
            "{\"mutationId\":"
                + quote(id())
                + ",\"title\":\"Spesa del sabato mattina\",\"criticality\":\"NORMAL\","
                + "\"template\":\"NONE\"}");
    if (put.status() == 200) {
      assertThat(object(put)).containsEntry("template", "SHOPPING_LIST");
    }
    assertThat(task(w.anna().token(), w.mamma(), list)).containsEntry("template", "SHOPPING_LIST");
  }

  // ---------------------------------------------------------------- add with one line

  @Test
  void lucaAddsFourItemsAndTheyComeBackInThatOrderUnchecked() throws Exception {
    World w = world();
    String list = listOk(w.luca().token(), w.mamma(), SABATO);

    String latteId = id();
    Response latte = add(w.luca().token(), w.mamma(), list, id(), latteId, "  Latte  ");
    assertThat(latte.status()).as(latte.body()).isEqualTo(201);
    assertThat((String) latte.json("$.id")).isEqualTo(latteId);
    assertThat((String) latte.json("$.taskId")).isEqualTo(list);
    assertThat((String) latte.json("$.text")).isEqualTo("Latte");
    assertThat((Boolean) latte.json("$.checked")).isFalse();
    assertThat(version(latte)).isEqualTo(1L);
    assertThat((Object) latte.json("$.updatedAt")).isNotNull();
    for (String text : List.of("Pane", "Uova", "Mele")) {
      assertThat(add(w.luca().token(), w.mamma(), list, text).status()).as(text).isEqualTo(201);
    }

    List<Map<String, Object>> items = items(w.davide().token(), w.mamma(), list);
    assertThat(texts(items)).containsExactly("Latte", "Pane", "Uova", "Mele");
    assertThat(positions(items)).isSorted().doesNotHaveDuplicates();
    assertThat(checks(items)).containsOnly(false);
    assertThat(itemsLog(list)).hasSize(4).containsOnly(itemRow(w.mamma(), "UPSERT"));
    assertThat(version(task(w.anna().token(), w.mamma(), list))).isEqualTo(1L);
  }

  @Test
  void anEmptyOrTooLongTextIsRefused() throws Exception {
    World w = world();
    String list = listOk(w.luca().token(), w.mamma(), SABATO);
    addOk(w.luca().token(), w.mamma(), list, "Latte");

    assertError(add(w.luca().token(), w.mamma(), list, ""), 400, "text_invalid");
    assertError(add(w.luca().token(), w.mamma(), list, "   "), 400, "text_invalid");
    assertError(add(w.luca().token(), w.mamma(), list, "a".repeat(201)), 400, "text_invalid");
    assertThat(add(w.luca().token(), w.mamma(), list, "b".repeat(200)).status()).isEqualTo(201);
    assertThat(texts(items(w.luca().token(), w.mamma(), list)))
        .containsExactly("Latte", "b".repeat(200));
  }

  // ---------------------------------------------------------------- check

  @Test
  void davideChecksTheBreadOfLucaAndOnlyThatRowChanges() throws Exception {
    Sabato s = sabato();
    World w = s.w();

    Response checked = check(w.davide().token(), w.mamma(), s.list(), s.pane(), true);
    assertThat(checked.status()).as(checked.body()).isEqualTo(200);
    assertThat((String) checked.json("$.id")).isEqualTo(s.pane());
    assertThat((Boolean) checked.json("$.checked")).isTrue();
    assertThat(version(checked)).isEqualTo(2L);

    List<Map<String, Object>> items = items(w.luca().token(), w.mamma(), s.list());
    assertThat(checks(items)).containsExactly(false, true, false, false);
    assertThat(version(item(items, s.latte()))).isEqualTo(1L);
    assertThat(version(task(w.anna().token(), w.mamma(), s.list())))
        .as("the task keeps its version")
        .isEqualTo(1L);
    assertThat(changeLog(s.list())).hasSize(1);
    assertThat(changeLog(s.pane()))
        .containsExactly(itemRow(w.mamma(), "UPSERT"), itemRow(w.mamma(), "UPSERT"));

    Response unchecked = check(w.davide().token(), w.mamma(), s.list(), s.pane(), false);
    assertThat(unchecked.status()).as(unchecked.body()).isEqualTo(200);
    assertThat((Boolean) unchecked.json("$.checked")).isFalse();
    assertThat(version(unchecked)).isEqualTo(3L);
  }

  // ---------------------------------------------------------------- order

  @Test
  void annaReordersTheList() throws Exception {
    Sabato s = sabato();
    World w = s.w();

    Response ordered =
        order(
            w.anna().token(),
            w.mamma(),
            s.list(),
            List.of(s.mele(), s.latte(), s.uova(), s.pane()));
    assertThat(ordered.status()).as(ordered.body()).isEqualTo(200);
    assertThat((List<String>) ordered.json("$[*].text"))
        .containsExactly("Mele", "Latte", "Uova", "Pane");

    List<Map<String, Object>> items = items(w.luca().token(), w.mamma(), s.list());
    assertThat(texts(items)).containsExactly("Mele", "Latte", "Uova", "Pane");
    assertThat(positions(items)).containsExactly(0, 1, 2, 3);
    assertThat(version(task(w.anna().token(), w.mamma(), s.list()))).isEqualTo(1L);
  }

  @Test
  void anOrderWithAnItemOfAnotherListOrARepeatedIdIsRefusedWithoutEffect() throws Exception {
    Sabato s = sabato();
    World w = s.w();
    String other = listOk(w.anna().token(), w.mamma(), "Spesa del mercato");
    String uva = addOk(w.anna().token(), w.mamma(), other, "Uva");
    List<Map<String, Object>> before = items(w.luca().token(), w.mamma(), s.list());

    assertError(
        order(w.anna().token(), w.mamma(), s.list(), List.of(s.mele(), uva, s.latte())),
        400,
        "invalid_request");
    assertError(
        order(w.anna().token(), w.mamma(), s.list(), List.of(s.mele(), s.mele(), s.latte())),
        400,
        "invalid_request");
    assertError(
        order(w.anna().token(), w.mamma(), s.list(), List.of(s.mele(), id())),
        400,
        "invalid_request");

    assertThat(items(w.luca().token(), w.mamma(), s.list())).isEqualTo(before);
    assertThat(texts(items(w.anna().token(), w.mamma(), other))).containsExactly("Uva");
  }

  // ---------------------------------------------------------------- clear the checked ones

  @Test
  void clearCheckedLeavesTheUncheckedOnesAndLogsADeleteForEachRemoved() throws Exception {
    Sabato s = sabato();
    World w = s.w();
    checkOk(w.luca().token(), w.mamma(), s.list(), s.pane());
    checkOk(w.davide().token(), w.mamma(), s.list(), s.uova());

    Response cleared = clearChecked(w.anna().token(), w.mamma(), s.list());
    assertThat(cleared.status()).as(cleared.body()).isEqualTo(200);
    assertThat((List<String>) cleared.json("$[*].text")).containsExactly("Latte", "Mele");
    assertThat(texts(items(w.davide().token(), w.mamma(), s.list())))
        .containsExactly("Latte", "Mele");

    Map<String, Map<String, Object>> stored = new java.util.HashMap<>();
    storedItems(s.list()).forEach(r -> stored.put((String) r.get("id"), r));
    assertThat(stored).hasSize(4);
    assertThat(stored.get(s.pane()).get("deleted_at")).isNotNull();
    assertThat(stored.get(s.uova()).get("deleted_at")).isNotNull();
    assertThat(stored.get(s.latte()).get("deleted_at")).isNull();
    assertThat(stored.get(s.mele()).get("deleted_at")).isNull();

    assertThat(itemsLog(s.list()).stream().filter(r -> "DELETE".equals(r.get("op"))).toList())
        .containsExactly(itemRow(w.mamma(), "DELETE"), itemRow(w.mamma(), "DELETE"));
    assertThat(changeLog(s.pane())).last().isEqualTo(itemRow(w.mamma(), "DELETE"));
    assertThat(changeLog(s.latte())).containsExactly(itemRow(w.mamma(), "UPSERT"));

    // A cancelled id in an order of the same list is ignored.
    Response ordered =
        order(w.anna().token(), w.mamma(), s.list(), List.of(s.mele(), s.pane(), s.latte()));
    assertThat(ordered.status()).as(ordered.body()).isEqualTo(200);
    assertThat(texts(items(w.luca().token(), w.mamma(), s.list())))
        .containsExactly("Mele", "Latte");
  }

  // ---------------------------------------------------------------- rules

  @Test
  void aTaskWithoutTemplateHasNoItems() throws Exception {
    World w = world();
    String foto = taskOk(w.anna().token(), w.mamma(), FOTO);

    assertError(add(w.anna().token(), w.mamma(), foto, "Latte"), 409, "not_shopping_list");
    assertError(check(w.anna().token(), w.mamma(), foto, id(), true), 409, "not_shopping_list");
    assertError(order(w.anna().token(), w.mamma(), foto, List.of()), 409, "not_shopping_list");
    assertError(clearChecked(w.anna().token(), w.mamma(), foto), 409, "not_shopping_list");
    assertThat(changeLog(foto)).hasSize(1);
  }

  @Test
  void aListThatIsDoneTakesNoWritesButCanStillBeRead() throws Exception {
    Sabato s = sabato();
    World w = s.w();
    assertOk(done(w.anna().token(), w.mamma(), s.list()));

    assertError(add(w.luca().token(), w.mamma(), s.list(), "Burro"), 409, "not_open");
    assertError(check(w.luca().token(), w.mamma(), s.list(), s.pane(), true), 409, "not_open");
    assertError(order(w.luca().token(), w.mamma(), s.list(), List.of(s.mele())), 409, "not_open");
    assertError(clearChecked(w.luca().token(), w.mamma(), s.list()), 409, "not_open");

    List<Map<String, Object>> items = items(w.anna().token(), w.mamma(), s.list());
    assertThat(texts(items)).containsExactly("Latte", "Pane", "Uova", "Mele");
    assertThat(checks(items)).containsOnly(false);
  }

  @Test
  void aMissingOrMalformedMutationIdIsRefused() throws Exception {
    Sabato s = sabato();
    World w = s.w();
    String token = w.luca().token();
    String m = w.mamma();

    assertError(add(token, m, s.list(), null, id(), "Burro"), 400, "invalid_request");
    assertError(add(token, m, s.list(), "not-a-uuid", id(), "Burro"), 400, "invalid_request");
    assertError(check(token, m, s.list(), s.pane(), null, true), 400, "invalid_request");
    assertError(check(token, m, s.list(), s.pane(), "nope", true), 400, "invalid_request");
    assertError(order(token, m, s.list(), null, List.of(s.mele())), 400, "invalid_request");
    assertError(clearChecked(token, m, s.list(), null), 400, "invalid_request");

    List<Map<String, Object>> items = items(token, m, s.list());
    assertThat(texts(items)).containsExactly("Latte", "Pane", "Uova", "Mele");
    assertThat(checks(items)).containsOnly(false);
  }

  @Test
  void theSameAddTwiceGivesOneItemAndTheSameMutationForAnotherItemConflicts() throws Exception {
    World w = world();
    String list = listOk(w.luca().token(), w.mamma(), SABATO);
    String mutation = id();
    String burro = id();

    Response first = add(w.luca().token(), w.mamma(), list, mutation, burro, "Burro");
    assertThat(first.status()).as(first.body()).isEqualTo(201);
    Response again = add(w.luca().token(), w.mamma(), list, mutation, burro, "Burro");
    assertThat(again.status()).as(again.body()).isEqualTo(200);
    assertThat((String) again.json("$.id")).isEqualTo(burro);

    assertThat(texts(items(w.luca().token(), w.mamma(), list))).containsExactly("Burro");
    assertThat(changeLog(burro)).hasSize(1);
    assertThat(appliedMutations(burro)).isEqualTo(1);

    String sale = id();
    assertError(
        add(w.luca().token(), w.mamma(), list, mutation, sale, "Sale"), 409, "mutation_conflict");
    assertThat(texts(items(w.luca().token(), w.mamma(), list))).containsExactly("Burro");
    assertThat(changeLog(sale)).isEmpty();
  }

  @Test
  void aReplayedCheckAnswers200EvenAfterTheListIsDone() throws Exception {
    Sabato s = sabato();
    World w = s.w();
    String mutation = id();

    Response first = check(w.davide().token(), w.mamma(), s.list(), s.pane(), mutation, true);
    assertThat(first.status()).as(first.body()).isEqualTo(200);
    assertOk(done(w.anna().token(), w.mamma(), s.list()));

    Response replay = check(w.davide().token(), w.mamma(), s.list(), s.pane(), mutation, true);
    assertThat(replay.status()).as("replay before not_open: " + replay.body()).isEqualTo(200);
    assertThat((String) replay.json("$.id")).isEqualTo(s.pane());
    assertThat((Boolean) replay.json("$.checked")).isTrue();
    assertThat(version(replay)).isEqualTo(2L);
    assertThat(changeLog(s.pane())).hasSize(2);
    assertThat(appliedMutations(s.pane())).isEqualTo(2);
  }

  @Test
  void aReplayedCheckOfAClearedItemAnswers200WithDeletedAt() throws Exception {
    Sabato s = sabato();
    World w = s.w();
    String mutation = id();

    Response first = check(w.davide().token(), w.mamma(), s.list(), s.uova(), mutation, true);
    assertThat(first.status()).as(first.body()).isEqualTo(200);
    assertThat(object(first)).containsEntry("deletedAt", null);
    assertOk(clearChecked(w.anna().token(), w.mamma(), s.list()));
    int logRows = changeLog(s.uova()).size();

    Response replay = check(w.davide().token(), w.mamma(), s.list(), s.uova(), mutation, true);
    assertThat(replay.status()).as("replay of a cleared item: " + replay.body()).isEqualTo(200);
    assertThat((String) replay.json("$.id")).isEqualTo(s.uova());
    assertThat(object(replay).get("deletedAt")).isNotNull();
    assertThat(changeLog(s.uova())).hasSize(logRows);
    assertThat(texts(items(w.luca().token(), w.mamma(), s.list())))
        .containsExactly("Latte", "Pane", "Mele");

    // A new check (new mutation) of a cleared item does not find it.
    assertError(check(w.davide().token(), w.mamma(), s.list(), s.uova(), true), 404, "not_found");
  }
}
