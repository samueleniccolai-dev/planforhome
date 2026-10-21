package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Round 019, T8 part 2 (server): the doubt of round 018. A replayed {@code mutationId} of an item
 * write (add, check, remove, restore) is accepted only on the URL of the task where it was applied;
 * on the URL of another list it is {@code 409 mutation_conflict} and nothing changes: no item, no
 * change_log row. Same application context as rounds 003 to 018.
 */
class Giro019ReplayTaskAcceptanceTest extends Giro019AcceptanceSupport {

  record Two(Sabato s, String domenica) {}

  Two two() throws Exception {
    Sabato s = sabato();
    String domenica = listOk(s.f().luca().token(), s.f().mamma(), DOMENICA);
    return new Two(s, domenica);
  }

  @Test
  void anAddReplayedOnTheUrlOfAnotherListIsAConflict() throws Exception {
    Two t = two();
    Sabato s = t.s();
    Families f = s.f();
    String token = f.luca().token();

    String m = id();
    String burro = id();
    Response first = add(token, f.mamma(), s.list(), m, burro, "Burro");
    assertThat(first.status()).as(first.body()).isEqualTo(201);
    int logRows = shoppingLogRows();

    assertError(add(token, f.mamma(), t.domenica(), m, burro, "Burro"), 409, "mutation_conflict");

    String noId = id();
    Response second = add(token, f.mamma(), s.list(), noId, null, "Sale");
    assertThat(second.status()).as(second.body()).isEqualTo(201);
    logRows++;
    assertError(add(token, f.mamma(), t.domenica(), noId, null, "Sale"), 409, "mutation_conflict");

    assertThat(items(token, f.mamma(), t.domenica())).isEmpty();
    assertThat(storedItems(t.domenica())).isEmpty();
    assertThat(shoppingLogRows()).isEqualTo(logRows);
    assertThat(texts(items(token, f.mamma(), s.list())))
        .containsExactly("Latte", "Pane", "Uova", "Mele", "Burro", "Sale");
  }

  @Test
  void aCheckReplayedOnTheUrlOfAnotherListIsAConflict() throws Exception {
    Two t = two();
    Sabato s = t.s();
    Families f = s.f();
    String n = id();
    assertOk(check(f.luca().token(), f.mamma(), s.list(), s.mele(), n, true));
    int logRows = shoppingLogRows();

    assertError(
        check(f.luca().token(), f.mamma(), t.domenica(), s.mele(), n, true),
        409,
        "mutation_conflict");

    assertThat(shoppingLogRows()).isEqualTo(logRows);
    assertThat(storedItems(t.domenica())).isEmpty();
  }

  @Test
  void aRemoveOrARestoreReplayedOnTheUrlOfAnotherListIsAConflict() throws Exception {
    Two t = two();
    Sabato s = t.s();
    Families f = s.f();
    String token = f.davide().token();
    String struck = id();
    assertStruck(remove(token, f.mamma(), s.list(), s.uova(), struck), f.davide());
    String back = id();
    Response restored = restore(token, f.mamma(), s.list(), s.uova(), back);
    assertThat(restored.status()).as(restored.body()).isEqualTo(200);
    int logRows = shoppingLogRows();

    assertError(remove(token, f.mamma(), t.domenica(), s.uova(), struck), 409, "mutation_conflict");
    assertError(restore(token, f.mamma(), t.domenica(), s.uova(), back), 409, "mutation_conflict");

    assertThat(shoppingLogRows()).isEqualTo(logRows);
    assertThat(removedBy(item(items(token, f.mamma(), s.list()), s.uova()))).isNull();
    assertThat(storedItems(t.domenica())).isEmpty();
  }
}
