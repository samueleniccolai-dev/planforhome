package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 023, S7: the parametric isolation of the two sync endpoints. Rosa (Famiglia Babbo) asks for
 * Famiglia Principale with its id in the URL and gets the same 404 as for a family that does not
 * exist; her own family shows only her data; a list forwarded from Principale to Mamma leaks
 * neither its title nor its items to who reads Principale; without login, 401.
 */
class Giro023SyncIsolationAcceptanceTest extends Giro023SyncAcceptanceSupport {

  record Babbo(Families f, User rosa, String grondaia) {}

  Babbo babbo() throws Exception {
    Families f = families();
    User rosa = founder("Rosa", BABBO);
    String grondaia = taskOk(rosa.token(), rosa.familyId(), GRONDAIA);
    return new Babbo(f, rosa, grondaia);
  }

  @Test
  void anotherFamilyWithItsIdInTheUrlIsTheSame404AsAMissingOne() throws Exception {
    Babbo b = babbo();
    String rosa = b.rosa().token();
    String p = b.f().principale();
    String missing = id();
    snapshotOk(rosa, b.rosa().familyId());
    changesOk(rosa, b.rosa().familyId(), 0, null);

    Response snapshot = snapshot(rosa, p);
    Response snapshotMissing = snapshot(rosa, missing);
    assertThat(snapshot.status()).as(snapshot.body()).isEqualTo(404);
    assertThat(snapshotMissing.status()).isEqualTo(404);
    assertThat(snapshot.body()).isEqualTo(snapshotMissing.body());

    for (String query : List.of("", "?after=0", "?after=0&limit=1")) {
      Response changes = changes(rosa, p, query);
      Response changesMissing = changes(rosa, missing, query);
      assertThat(changes.status()).as(query + ": " + changes.body()).isEqualTo(404);
      assertThat(changesMissing.status()).isEqualTo(404);
      assertThat(changes.body()).isEqualTo(changesMissing.body());
    }
  }

  @Test
  void theOwnFamilyShowsNothingOfTheOthers() throws Exception {
    Babbo b = babbo();
    User giulia = b.f().giulia();
    String piante = taskOk(giulia.token(), b.f().principale(), PIANTE);
    String pranzo = taskOk(b.f().anna().token(), b.f().mamma(), PRANZO);
    String rosa = b.rosa().token();
    String babbo = b.rosa().familyId();

    Map<String, Object> snapshot = snapshotOk(rosa, babbo);
    assertThat(ids(list(snapshot, "tasks"))).containsExactly(b.grondaia());
    assertThat(list(snapshot, "shoppingItems")).isEmpty();
    assertThat(list(snapshot, "members").stream().map(m -> m.get("personId")).toList())
        .containsExactly(b.rosa().personId());

    List<Page> pages = walk(rosa, babbo, 0, 1);
    pages.add(changesOk(rosa, babbo, 0, null));
    for (Page page : pages) {
      assertThat(page.changes().stream().map(c -> c.get("entityId")).toList())
          .containsOnly(b.grondaia());
      assertThat(page.body()).doesNotContain(piante, pranzo, PIANTE, PRANZO);
    }
  }

  @Test
  void aForwardedListLeaksNothingToWhoReadsTheFamilyItLeft() throws Exception {
    Families f = families();
    User giulia = f.giulia();
    String p = f.principale();
    List3 spesa = spesa(giulia, p);
    Response forwarded = forwardTo(giulia.token(), p, spesa.list(), f.mamma());
    assertThat(forwarded.status()).as("forward: " + forwarded.body()).isEqualTo(200);

    for (User reader : List.of(giulia, f.marco())) {
      List<Page> pages = walk(reader.token(), p, 0, 1);
      pages.add(changesOk(reader.token(), p, 0, null));
      for (Page page : pages) {
        assertThat(page.body()).as(reader.name() + " reads Principale").doesNotContain(PANE);
        for (String text : SPESA) {
          assertThat(page.body()).doesNotContain("\"" + text + "\"");
        }
      }
      Map<String, Object> snapshot = snapshotOk(reader.token(), p);
      assertThat(ids(list(snapshot, "tasks"))).doesNotContain(spesa.list());
      assertThat(list(snapshot, "shoppingItems")).isEmpty();
    }
  }

  @Test
  void withoutLoginBothEndpointsAre401() throws Exception {
    Families f = families();
    String p = f.principale();
    snapshotOk(f.giulia().token(), p);
    assertThat(snapshot(null, p).status()).isEqualTo(401);
    assertThat(changes(null, p, "?after=0").status()).isEqualTo(401);
  }
}
