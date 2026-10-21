package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 019, T8 part 2 (server): a forwarded list (contestation 018-a, ratification 019-a). The
 * creator counts only while he is a member of the family where the list is now: after the forward
 * only the managers of the family of arrival remove for real and clear the checked; if the creator
 * later joins that family, he is the creator again. The items keep who added them. Same application
 * context as rounds 003 to 018.
 */
class Giro019ForwardedListAcceptanceTest extends Giro019AcceptanceSupport {

  record Nonna(Families f, String list, String pasta, String riso, String olio) {}

  /** «Spesa per la nonna» of Marco in Principale (Pasta by Marco, Riso and Olio by Giulia). */
  Nonna forwarded() throws Exception {
    Families f = families();
    String list = listOk(f.marco().token(), f.principale(), NONNA);
    String pasta = addOk(f.marco().token(), f.principale(), list, "Pasta");
    String riso = addOk(f.giulia().token(), f.principale(), list, "Riso");
    String olio = addOk(f.giulia().token(), f.principale(), list, "Olio");
    Response moved = forwardTo(f.giulia().token(), f.principale(), list, f.mamma());
    assertThat(moved.status()).as("forward: " + moved.body()).isEqualTo(200);
    return new Nonna(f, list, pasta, riso, olio);
  }

  @Test
  void inMammaOnlyTheManagersRemoveForRealAndTheAuthorsStay() throws Exception {
    Nonna n = forwarded();
    Families f = n.f();

    List<Map<String, Object>> items = items(f.davide().token(), f.mamma(), n.list());
    assertThat(createdBy(item(items, n.pasta()))).isEqualTo(f.marco().personId());
    assertThat(createdBy(item(items, n.riso()))).isEqualTo(f.giulia().personId());
    assertThat(createdBy(item(items, n.olio()))).isEqualTo(f.giulia().personId());

    assertStruck(remove(f.davide().token(), f.mamma(), n.list(), n.pasta()), f.davide());
    checkOk(f.davide().token(), f.mamma(), n.list(), n.olio());
    assertError(clearChecked(f.davide().token(), f.mamma(), n.list()), 403, "forbidden");
    assertCancelled(remove(f.pietro().token(), f.mamma(), n.list(), n.riso()), f.pietro());
    assertOk(clearChecked(f.anna().token(), f.mamma(), n.list()));

    List<Map<String, Object>> after = items(f.anna().token(), f.mamma(), n.list());
    assertThat(texts(after)).containsExactly("Pasta");
    assertThat(removedBy(item(after, n.pasta()))).isEqualTo(f.davide().personId());
    assertThat(createdBy(item(after, n.pasta()))).isEqualTo(f.marco().personId());
  }

  @Test
  void giuliaAMemberOfMammaStrikesInTheForwardedList() throws Exception {
    Nonna n = forwarded();
    Families f = n.f();
    // Giulia forwarded the list and added Riso, but in Mamma she is a plain member.
    assertStruck(remove(f.giulia().token(), f.mamma(), n.list(), n.riso()), f.giulia());
    assertThat(texts(items(f.anna().token(), f.mamma(), n.list())))
        .containsExactly("Pasta", "Riso", "Olio");
  }

  @Test
  void marcoJoinsMammaAndIsTheCreatorAgain() throws Exception {
    Nonna n = forwarded();
    Families f = n.f();
    joinOk(f.marco(), invite(f.anna().token(), f.mamma()));

    assertCancelled(remove(f.marco().token(), f.mamma(), n.list(), n.olio()), f.marco());
    checkOk(f.marco().token(), f.mamma(), n.list(), n.riso());
    assertOk(clearChecked(f.marco().token(), f.mamma(), n.list()));
    assertThat(texts(items(f.anna().token(), f.mamma(), n.list()))).containsExactly("Pasta");
  }
}
