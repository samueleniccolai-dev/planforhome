package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * Round 019, T8 part 2 (server): isolation between families for the new endpoints {@code remove}
 * and {@code restore}, and for {@code clear-checked} with its new permission (CLAUDE.md rule 1).
 * Marco is not in Mamma; Giulia is a member of Mamma and a manager of Principale (she would have
 * every permission in Principale). With the real ids in the URL, nobody reaches the items of a
 * family that is not theirs, and an item is never reached through the URL of another list. Same
 * application context as rounds 003 to 018.
 */
class Giro019ShoppingIsolationAcceptanceTest extends Giro019AcceptanceSupport {

  enum Endpoint {
    REMOVE,
    RESTORE,
    CLEAR_CHECKED
  }

  record Lists(Families f, String sabato, String latte, String uova, String nonna, String pasta) {}

  /**
   * «Spesa del sabato» in Mamma (Latte checked, Uova struck by Davide); «Spesa per la nonna» in
   * Principale (Pasta checked).
   */
  Lists lists() throws Exception {
    Families f = families();
    String sabato = listOk(f.luca().token(), f.mamma(), SABATO);
    String latte = addOk(f.luca().token(), f.mamma(), sabato, "Latte");
    String uova = addOk(f.luca().token(), f.mamma(), sabato, "Uova");
    checkOk(f.luca().token(), f.mamma(), sabato, latte);
    assertStruck(remove(f.davide().token(), f.mamma(), sabato, uova), f.davide());
    String nonna = listOk(f.giulia().token(), f.principale(), NONNA);
    String pasta = addOk(f.giulia().token(), f.principale(), nonna, "Pasta");
    checkOk(f.giulia().token(), f.principale(), nonna, pasta);
    return new Lists(f, sabato, latte, uova, nonna, pasta);
  }

  /** On REMOVE the alive item, on RESTORE the struck one (both of «Spesa del sabato» if real). */
  Response call(
      Endpoint endpoint, String token, String familyId, String taskId, String alive, String struck)
      throws Exception {
    return switch (endpoint) {
      case REMOVE -> remove(token, familyId, taskId, alive);
      case RESTORE -> restore(token, familyId, taskId, struck);
      case CLEAR_CHECKED -> clearChecked(token, familyId, taskId);
    };
  }

  void assertNoEffect(
      Lists l, List<Map<String, Object>> sabato, List<Map<String, Object>> nonna, int logRows)
      throws Exception {
    Families f = l.f();
    assertThat(items(f.anna().token(), f.mamma(), l.sabato())).isEqualTo(sabato);
    assertThat(items(f.giulia().token(), f.principale(), l.nonna())).isEqualTo(nonna);
    assertThat(shoppingLogRows()).isEqualTo(logRows);
  }

  @ParameterizedTest
  @EnumSource(Endpoint.class)
  void marcoWithTheRealIdsOfMammaGets404(Endpoint endpoint) throws Exception {
    Lists l = lists();
    Families f = l.f();
    var sabato = items(f.anna().token(), f.mamma(), l.sabato());
    var nonna = items(f.giulia().token(), f.principale(), l.nonna());
    int logRows = shoppingLogRows();

    Response viaMamma =
        call(endpoint, f.marco().token(), f.mamma(), l.sabato(), l.latte(), l.uova());
    Response viaPrincipale =
        call(endpoint, f.marco().token(), f.principale(), l.sabato(), l.latte(), l.uova());
    Response unknown = call(endpoint, f.marco().token(), f.principale(), id(), id(), id());

    assertError(viaMamma, 404, "not_found");
    assertError(viaPrincipale, 404, "not_found");
    assertError(unknown, 404, "not_found");
    assertThat(viaMamma.body()).doesNotContain("Latte", "Uova");
    assertThat(viaPrincipale.body()).isEqualTo(unknown.body());
    assertNoEffect(l, sabato, nonna, logRows);
  }

  @ParameterizedTest
  @EnumSource(Endpoint.class)
  void giuliaCannotReachAListOfMammaThroughTheUrlOfPrincipale(Endpoint endpoint) throws Exception {
    Lists l = lists();
    Families f = l.f();
    var sabato = items(f.anna().token(), f.mamma(), l.sabato());
    var nonna = items(f.giulia().token(), f.principale(), l.nonna());
    int logRows = shoppingLogRows();

    Response crossed =
        call(endpoint, f.giulia().token(), f.principale(), l.sabato(), l.latte(), l.uova());

    assertError(crossed, 404, "not_found");
    assertThat(crossed.body()).doesNotContain("Latte", "Uova");
    assertNoEffect(l, sabato, nonna, logRows);
  }

  @ParameterizedTest
  @EnumSource(
      value = Endpoint.class,
      names = {"REMOVE", "RESTORE"})
  void anItemOfAnotherListIsNotFoundThroughTheUrlOfThisList(Endpoint endpoint) throws Exception {
    Lists l = lists();
    Families f = l.f();
    String other = listOk(f.anna().token(), f.mamma(), "Spesa del mercato");
    String uva = addOk(f.anna().token(), f.mamma(), other, "Uva");
    assertStruck(remove(f.davide().token(), f.mamma(), other, uva), f.davide());
    var sabato = items(f.anna().token(), f.mamma(), l.sabato());
    var nonna = items(f.giulia().token(), f.principale(), l.nonna());
    int logRows = shoppingLogRows();

    // Same family, another list: Uva under the URL of «Spesa del sabato», by its creator Luca.
    assertError(
        call(endpoint, f.luca().token(), f.mamma(), l.sabato(), uva, uva), 404, "not_found");
    // Giulia is in both families: Pasta (Principale) under the URL of «Spesa del sabato» (Mamma),
    // and Latte, Uova (Mamma) under the URL of «Spesa per la nonna», where she is a manager.
    assertError(
        call(endpoint, f.giulia().token(), f.mamma(), l.sabato(), l.pasta(), l.pasta()),
        404,
        "not_found");
    assertError(
        call(endpoint, f.giulia().token(), f.principale(), l.nonna(), l.latte(), l.uova()),
        404,
        "not_found");

    assertNoEffect(l, sabato, nonna, logRows);
    assertThat(removers(items(f.anna().token(), f.mamma(), other)))
        .containsExactly(f.davide().personId());
  }
}
