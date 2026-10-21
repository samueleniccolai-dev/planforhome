package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 018, T8 part 1 (server): two people writing the same list at the same time (SPEC 7, merge
 * item by item). Checks of different items never step on each other; parallel adds get distinct
 * positions; an order is «the last one wins», and an item added meanwhile stays alive at the
 * bottom. The parallel cases repeat {@link #ROUNDS} times. Same application context as rounds 003
 * to 016.
 */
class Giro018ShoppingConcurrencyAcceptanceTest extends Giro018AcceptanceSupport {

  private static final int ROUNDS = 20;

  @Test
  void lucaAndDavideCheckDifferentItemsTogetherAndBothChecksStay() throws Exception {
    World w = world();
    for (int round = 0; round < ROUNDS; round++) {
      String list = listOk(w.luca().token(), w.mamma(), SABATO);
      String latte = addOk(w.luca().token(), w.mamma(), list, "Latte");
      String mele = addOk(w.luca().token(), w.mamma(), list, "Mele");

      List<Response> answers =
          together(
              () -> check(w.luca().token(), w.mamma(), list, latte, true),
              () -> check(w.davide().token(), w.mamma(), list, mele, true));

      assertThat(statuses(answers)).as("round " + round).containsExactly(200, 200);
      List<Map<String, Object>> items = items(w.anna().token(), w.mamma(), list);
      assertThat(checks(items)).as("round " + round).containsExactly(true, true);
      assertThat(version(item(items, latte))).isEqualTo(2L);
      assertThat(version(item(items, mele))).isEqualTo(2L);
    }
  }

  @Test
  void twoAddsTogetherAreBothThereWithDistinctPositions() throws Exception {
    World w = world();
    for (int round = 0; round < ROUNDS; round++) {
      String list = listOk(w.luca().token(), w.mamma(), SABATO);
      addOk(w.luca().token(), w.mamma(), list, "Latte");

      List<Response> answers =
          together(
              () -> add(w.luca().token(), w.mamma(), list, "Burro"),
              () -> add(w.davide().token(), w.mamma(), list, "Sale"));

      assertThat(statuses(answers)).as("round " + round).containsExactly(201, 201);
      List<Map<String, Object>> items = items(w.anna().token(), w.mamma(), list);
      assertThat(texts(items)).as("round " + round).hasSize(3).startsWith("Latte");
      assertThat(texts(items)).contains("Burro", "Sale");
      assertThat(positions(items)).as("round " + round).doesNotHaveDuplicates();
    }
  }

  @Test
  void twoOrdersFromTheSameReadTheLastOneWins() throws Exception {
    World w = world();
    String list = listOk(w.luca().token(), w.mamma(), SABATO);
    String a = addOk(w.luca().token(), w.mamma(), list, "Pasta");
    String b = addOk(w.luca().token(), w.mamma(), list, "Riso");
    String c = addOk(w.luca().token(), w.mamma(), list, "Caffè");
    items(w.luca().token(), w.mamma(), list);
    items(w.davide().token(), w.mamma(), list);

    Response first = order(w.luca().token(), w.mamma(), list, List.of(a, b, c));
    Response second = order(w.davide().token(), w.mamma(), list, List.of(c, b, a));

    assertThat(first.status()).as(first.body()).isEqualTo(200);
    assertThat(second.status()).as(second.body()).isEqualTo(200);
    assertThat(texts(items(w.anna().token(), w.mamma(), list)))
        .containsExactly("Caffè", "Riso", "Pasta");
  }

  @Test
  void anOrderThatDoesNotListAnItemAddedMeanwhileLeavesItAliveAtTheBottom() throws Exception {
    World w = world();
    String list = listOk(w.luca().token(), w.mamma(), SABATO);
    String a = addOk(w.luca().token(), w.mamma(), list, "Pasta");
    String b = addOk(w.luca().token(), w.mamma(), list, "Riso");
    String c = addOk(w.luca().token(), w.mamma(), list, "Caffè");
    items(w.davide().token(), w.mamma(), list); // Davide reads A, B, C

    addOk(w.luca().token(), w.mamma(), list, "Zucchero");
    Response ordered = order(w.davide().token(), w.mamma(), list, List.of(c, b, a));

    assertThat(ordered.status()).as(ordered.body()).isEqualTo(200);
    List<Map<String, Object>> items = items(w.anna().token(), w.mamma(), list);
    assertThat(texts(items)).containsExactly("Caffè", "Riso", "Pasta", "Zucchero");
    assertThat(positions(items)).doesNotHaveDuplicates();
  }

  @Test
  void anOrderAndAnAddTogetherNeverLoseTheNewItem() throws Exception {
    World w = world();
    for (int round = 0; round < ROUNDS; round++) {
      String list = listOk(w.luca().token(), w.mamma(), SABATO);
      String a = addOk(w.luca().token(), w.mamma(), list, "Pasta");
      String b = addOk(w.luca().token(), w.mamma(), list, "Riso");
      String c = addOk(w.luca().token(), w.mamma(), list, "Caffè");

      List<Response> answers =
          together(
              () -> order(w.davide().token(), w.mamma(), list, List.of(c, b, a)),
              () -> add(w.luca().token(), w.mamma(), list, "Zucchero"));

      assertThat(statuses(answers)).as("round " + round).containsExactly(200, 201);
      assertThat(texts(items(w.anna().token(), w.mamma(), list)))
          .as("round " + round)
          .containsExactly("Caffè", "Riso", "Pasta", "Zucchero");
    }
  }
}
