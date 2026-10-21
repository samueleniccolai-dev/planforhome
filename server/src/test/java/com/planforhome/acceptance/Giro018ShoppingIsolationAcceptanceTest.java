package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * Round 018, T8 part 1 (server): isolation between families for every new endpoint (CLAUDE.md rule
 * 1). Marco is not in Mamma; Giulia is in Mamma and in Principale. With the real ids in the URL or
 * in the body, nobody reads or writes the items of a list of a family that is not theirs, and an
 * item of a list is never reached through the URL of another list. Same application context as
 * rounds 003 to 016.
 */
class Giro018ShoppingIsolationAcceptanceTest extends Giro018AcceptanceSupport {

  enum Endpoint {
    GET_ITEMS,
    ADD,
    CHECK,
    ORDER,
    CLEAR_CHECKED
  }

  record Lists(
      World w, String sabato, String latte, String pane, String settimanale, String pasta) {}

  /**
   * «Spesa del sabato» in Mamma (Latte, Pane checked); «Spesa settimanale» in Principale (Pasta).
   */
  Lists lists() throws Exception {
    World w = world();
    String sabato = listOk(w.luca().token(), w.mamma(), SABATO);
    String latte = addOk(w.luca().token(), w.mamma(), sabato, "Latte");
    String pane = addOk(w.luca().token(), w.mamma(), sabato, "Pane");
    checkOk(w.luca().token(), w.mamma(), sabato, pane);
    String settimanale = listOk(w.giulia().token(), w.principale(), SETTIMANALE);
    String pasta = addOk(w.giulia().token(), w.principale(), settimanale, "Pasta");
    return new Lists(w, sabato, latte, pane, settimanale, pasta);
  }

  Response call(Endpoint endpoint, String token, String familyId, String taskId, String itemId)
      throws Exception {
    return switch (endpoint) {
      case GET_ITEMS -> getItems(token, familyId, taskId);
      case ADD -> add(token, familyId, taskId, "Burro");
      case CHECK -> check(token, familyId, taskId, itemId, false);
      case ORDER -> order(token, familyId, taskId, List.of(itemId));
      case CLEAR_CHECKED -> clearChecked(token, familyId, taskId);
    };
  }

  /** Both lists are as {@link #lists} left them, and no change_log row of items was added. */
  void assertNoEffect(
      Lists l, List<Map<String, Object>> sabato, List<Map<String, Object>> sett, int logRows)
      throws Exception {
    World w = l.w();
    assertThat(items(w.luca().token(), w.mamma(), l.sabato())).isEqualTo(sabato);
    assertThat(items(w.giulia().token(), w.principale(), l.settimanale())).isEqualTo(sett);
    assertThat(storedItems(l.sabato())).hasSize(2);
    assertThat(storedItems(l.settimanale())).hasSize(1);
    assertThat(shoppingLogRows()).isEqualTo(logRows);
  }

  @ParameterizedTest
  @EnumSource(Endpoint.class)
  void marcoWithTheRealIdsOfMammaGets404(Endpoint endpoint) throws Exception {
    Lists l = lists();
    World w = l.w();
    var sabato = items(w.luca().token(), w.mamma(), l.sabato());
    var sett = items(w.giulia().token(), w.principale(), l.settimanale());
    int logRows = shoppingLogRows();

    Response viaMamma = call(endpoint, w.marco().token(), w.mamma(), l.sabato(), l.latte());
    Response viaPrincipale =
        call(endpoint, w.marco().token(), w.principale(), l.sabato(), l.latte());
    Response unknown = call(endpoint, w.marco().token(), w.principale(), id(), id());

    assertError(viaMamma, 404, "not_found");
    assertError(viaPrincipale, 404, "not_found");
    assertError(unknown, 404, "not_found");
    assertThat(viaMamma.body()).doesNotContain("Latte", "Pane");
    assertThat(viaPrincipale.body()).isEqualTo(unknown.body());
    assertNoEffect(l, sabato, sett, logRows);
  }

  @ParameterizedTest
  @EnumSource(Endpoint.class)
  void giuliaCannotReachAListOfMammaThroughTheUrlOfPrincipale(Endpoint endpoint) throws Exception {
    Lists l = lists();
    World w = l.w();
    var sabato = items(w.luca().token(), w.mamma(), l.sabato());
    var sett = items(w.giulia().token(), w.principale(), l.settimanale());
    int logRows = shoppingLogRows();

    Response crossed = call(endpoint, w.giulia().token(), w.principale(), l.sabato(), l.latte());

    assertError(crossed, 404, "not_found");
    assertThat(crossed.body()).doesNotContain("Latte", "Pane");
    assertNoEffect(l, sabato, sett, logRows);
  }

  @Test
  void anItemOfAnotherListIsNotFoundThroughTheUrlOfThisList() throws Exception {
    Lists l = lists();
    World w = l.w();
    var sabato = items(w.luca().token(), w.mamma(), l.sabato());
    var sett = items(w.giulia().token(), w.principale(), l.settimanale());
    int logRows = shoppingLogRows();
    String other = listOk(w.anna().token(), w.mamma(), "Spesa del mercato");
    String uva = addOk(w.anna().token(), w.mamma(), other, "Uva");
    logRows++;

    // Giulia is in both families: Pasta (Principale) under the URL of «Spesa del sabato» (Mamma).
    assertError(
        check(w.giulia().token(), w.mamma(), l.sabato(), l.pasta(), true), 404, "not_found");
    assertError(
        check(w.giulia().token(), w.principale(), l.settimanale(), l.latte(), true),
        404,
        "not_found");
    // Same family, another list.
    assertError(check(w.luca().token(), w.mamma(), l.sabato(), uva, true), 404, "not_found");
    assertError(
        order(w.giulia().token(), w.mamma(), l.sabato(), List.of(l.pasta(), l.latte())),
        400,
        "invalid_request");

    assertNoEffect(l, sabato, sett, logRows);
    assertThat(checks(items(w.anna().token(), w.mamma(), other))).containsExactly(false);
  }

  @Test
  void aClientIdAlreadyUsedByATaskOrAnItemOfOthersIsAConflict() throws Exception {
    Lists l = lists();
    World w = l.w();
    var sabato = items(w.luca().token(), w.mamma(), l.sabato());
    var sett = items(w.giulia().token(), w.principale(), l.settimanale());
    int logRows = shoppingLogRows();

    assertError(
        add(w.luca().token(), w.mamma(), l.sabato(), id(), l.pasta(), "Burro"), 409, "id_conflict");
    assertError(
        add(w.luca().token(), w.mamma(), l.sabato(), id(), l.settimanale(), "Burro"),
        409,
        "id_conflict");
    assertError(
        add(w.luca().token(), w.mamma(), l.sabato(), id(), w.principale(), "Burro"),
        409,
        "id_conflict");

    assertNoEffect(l, sabato, sett, logRows);
  }

  @Test
  void theChangeLogRowsOfTheItemsHaveTheFamilyOfTheirTask() throws Exception {
    Lists l = lists();
    World w = l.w();
    assertThat(itemsLog(l.sabato())).hasSize(3).containsOnly(itemRow(w.mamma(), "UPSERT"));
    assertThat(itemsLog(l.settimanale())).containsExactly(itemRow(w.principale(), "UPSERT"));
    assertOk(clearChecked(w.giulia().token(), w.mamma(), l.sabato()));
    assertThat(changeLog(l.pane())).last().isEqualTo(itemRow(w.mamma(), "DELETE"));
  }
}
