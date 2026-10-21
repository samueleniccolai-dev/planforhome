package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 019, T8 part 2 (server): removes, strikes, checks and «remove the checked» at the same time
 * on the same item (SPEC 7). Every write takes the lock of the family and of the task, so one
 * arrives first: an item is never struck and cancelled by two different people, never checked after
 * it was cancelled, and its {@code version} grows once per accepted write. The parallel cases
 * repeat {@link #ROUNDS} times. Same application context as rounds 003 to 018.
 */
class Giro019ShoppingConcurrencyAcceptanceTest extends Giro019AcceptanceSupport {

  private static final int ROUNDS = 20;

  @Test
  void aDoubleTapOnRemoveByAMemberStrikesOnce() throws Exception {
    Families f = families();
    for (int round = 0; round < ROUNDS; round++) {
      String list = listOk(f.luca().token(), f.mamma(), SABATO);
      String uova = addOk(f.luca().token(), f.mamma(), list, "Uova");
      int rows = changeLog(uova).size();

      List<Response> answers =
          together(
              () -> remove(f.davide().token(), f.mamma(), list, uova),
              () -> remove(f.davide().token(), f.mamma(), list, uova));

      assertThat(statuses(answers)).as("round " + round).containsExactlyInAnyOrder(200, 409);
      Map<String, Object> item = item(items(f.anna().token(), f.mamma(), list), uova);
      assertThat(removedBy(item)).as("round " + round).isEqualTo(f.davide().personId());
      assertThat(version(item)).as("round " + round).isEqualTo(2L);
      assertThat(changeLog(uova)).as("round " + round).hasSize(rows + 1);
    }
  }

  @Test
  void theClearOfTheCreatorAndAStrikeOfACheckedItemNeverMix() throws Exception {
    Families f = families();
    String probe = listOk(f.luca().token(), f.mamma(), DOMENICA);
    String sale = addOk(f.luca().token(), f.mamma(), probe, "Sale");
    assertStruck(remove(f.davide().token(), f.mamma(), probe, sale), f.davide());
    for (int round = 0; round < ROUNDS; round++) {
      String list = listOk(f.luca().token(), f.mamma(), SABATO);
      String uova = addOk(f.luca().token(), f.mamma(), list, "Uova");
      checkOk(f.luca().token(), f.mamma(), list, uova);

      List<Response> answers =
          together(
              () -> clearChecked(f.luca().token(), f.mamma(), list),
              () -> remove(f.davide().token(), f.mamma(), list, uova));

      assertThat(answers.get(0).status()).as("round " + round).isEqualTo(200);
      int strike = answers.get(1).status();
      assertThat(strike).as("round " + round + ": " + answers.get(1).body()).isIn(200, 404);
      Map<String, Object> stored = storedItem(uova);
      if (strike == 200) {
        // The strike came first: the clear left the struck item alone.
        assertThat(stored.get("deleted_at")).as("round " + round).isNull();
        assertThat(stored.get("removed_by")).isEqualTo(f.davide().personId());
        assertThat(texts(items(f.anna().token(), f.mamma(), list))).containsExactly("Uova");
      } else {
        // The clear came first: cancelled by Luca, and the strike found nothing.
        assertThat(stored.get("deleted_at")).as("round " + round).isNotNull();
        assertThat(stored.get("removed_by")).isEqualTo(f.luca().personId());
        assertThat(items(f.anna().token(), f.mamma(), list)).isEmpty();
      }
    }
  }

  @Test
  void aRemoveOfTheCreatorAndACheckTogetherNeverCheckACancelledItem() throws Exception {
    Families f = families();
    for (int round = 0; round < ROUNDS; round++) {
      String list = listOk(f.luca().token(), f.mamma(), SABATO);
      String pane = addOk(f.luca().token(), f.mamma(), list, "Pane");

      List<Response> answers =
          together(
              () -> remove(f.luca().token(), f.mamma(), list, pane),
              () -> check(f.davide().token(), f.mamma(), list, pane, true));

      assertCancelled(answers.get(0), f.luca());
      int checked = answers.get(1).status();
      assertThat(checked).as("round " + round).isIn(200, 404);
      Map<String, Object> stored = storedItem(pane);
      assertThat(stored.get("deleted_at")).as("round " + round).isNotNull();
      assertThat(stored.get("checked")).as("round " + round).isEqualTo(checked == 200);
      assertThat(((Number) stored.get("version")).longValue())
          .as("round " + round)
          .isEqualTo(checked == 200 ? 3L : 2L);
    }
  }

  @Test
  void aStrikeOfAMemberAndARemoveOfTheCreatorTogetherAlwaysEndCancelled() throws Exception {
    Families f = families();
    for (int round = 0; round < ROUNDS; round++) {
      String list = listOk(f.luca().token(), f.mamma(), SABATO);
      String mele = addOk(f.luca().token(), f.mamma(), list, "Mele");

      List<Response> answers =
          together(
              () -> remove(f.davide().token(), f.mamma(), list, mele),
              () -> remove(f.luca().token(), f.mamma(), list, mele));

      assertCancelled(answers.get(1), f.luca());
      int strike = answers.get(0).status();
      assertThat(strike).as("round " + round).isIn(200, 404);
      assertThat(items(f.anna().token(), f.mamma(), list)).as("round " + round).isEmpty();
      List<Object> ops = changeLog(mele).stream().map(r -> r.get("op")).toList();
      assertThat(ops).as("round " + round).endsWith("DELETE");
      assertThat(ops).hasSize(strike == 200 ? 3 : 2);
    }
  }
}
