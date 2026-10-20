package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Round 006, T4: ids of other families in the URL and in the body, and the races of the plan
 * ("Rischi di concorrenza"), each repeated 10 times. Demo data only read: Luca is only in Famiglia
 * Mamma, Rosa manages Famiglia Babbo, Marco is in Famiglia Principale.
 */
class Giro006IsolationAcceptanceTest extends Giro006AcceptanceSupport {

  static final int ROUNDS = 10;

  // ---------------------------------------------------------------- ids of other families

  @Test
  void anOutsiderGetsTheSameNotFoundAsForAFamilyThatDoesNotExist() throws Exception {
    String luca = demoToken("luca");
    String rosaToken = demoToken("rosa");
    String babbo = familyId(rosaToken, BABBO);
    String rosa = personIdOf(rosaToken);
    String lucaId = personIdOf(luca);
    String nobody = UUID.randomUUID().toString();

    for (String family : List.of(babbo, nobody)) {
      Map<String, Response> answers =
          Map.of(
              "resources", addResource(luca, family, null, "Intruso", lucaId),
              "role", setRole(luca, family, rosa, "MEMBER"),
              "referent", setReferent(luca, family, rosa, lucaId),
              "delete", removeMember(luca, family, rosa));
      answers.forEach(
          (name, answer) -> {
            assertThat(answer.status())
                .as(name + " on " + family + ": " + answer.body())
                .isEqualTo(404);
            assertThat(answer.body())
                .as(name)
                .isEqualToIgnoringWhitespace("{\"error\":\"not_found\"}");
          });
    }
    assertThat(familyIds(rosaToken)).contains(babbo);
    assertThat(member(rosaToken, babbo, rosa)).containsEntry("role", "MANAGER");
  }

  @Test
  void aPersonOfAnotherFamilyInTheUrlIsNotFound() throws Exception {
    Faggio f = faggio();
    String rosaToken = demoToken("rosa");
    String rosa = personIdOf(rosaToken);
    String babbo = familyId(rosaToken, BABBO);

    Response role = setRole(f.irene().token(), f.id(), rosa, "MEMBER");
    Response referent = setReferent(f.irene().token(), f.id(), rosa, f.irene().personId());
    Response delete = removeMember(f.irene().token(), f.id(), rosa);

    assertThat(role.status()).as(role.body()).isEqualTo(404);
    assertThat(referent.status()).as(referent.body()).isEqualTo(404);
    assertThat(delete.status()).as(delete.body()).isEqualTo(404);
    assertThat(familyIds(rosaToken)).contains(babbo);
    assertThat(member(rosaToken, babbo, rosa)).containsEntry("role", "MANAGER");
  }

  @Test
  void aPersonOfAnotherFamilyInTheBodyIsNotAReferent() throws Exception {
    Faggio f = faggio();
    String marco = personIdOf(demoToken("marco"));
    String nina = resourceOk(f.irene().token(), f.id(), "Nina", f.irene().personId());
    List<String> before = memberIds(f.irene().token(), f.id());

    Response added = addResource(f.irene().token(), f.id(), null, "Otto", marco);
    Response moved = setReferent(f.irene().token(), f.id(), nina, marco);

    assertThat(added.status()).as(added.body()).isEqualTo(400);
    assertThat(added.error()).isEqualTo("referent_invalid");
    assertThat(moved.status()).as(moved.body()).isEqualTo(400);
    assertThat(moved.error()).isEqualTo("referent_invalid");
    assertThat(memberIds(f.irene().token(), f.id())).containsExactlyInAnyOrderElementsOf(before);
    assertThat(member(f.irene().token(), f.id(), nina))
        .containsEntry("referentPersonId", f.irene().personId());
  }

  // ---------------------------------------------------------------- races

  @Test
  void theLastTwoManagersLeavingTogetherLeaveOneBehind() throws Exception {
    User alba = newManager("Alba", "Famiglia Salice");
    User berto = newManager("Berto", "Famiglia Cedro");
    for (int round = 0; round < ROUNDS; round++) {
      String pioppo = UUID.randomUUID().toString();
      Response created = createFamily(alba.token(), pioppo, "Famiglia Pioppo " + round, null);
      assertThat(created.status()).as(created.body()).isEqualTo(201);
      joinOk(berto, invite(alba.token(), pioppo));
      setRoleOk(alba.token(), pioppo, berto.personId(), "MANAGER");

      List<Response> both =
          together(
              () -> removeMember(alba.token(), pioppo, alba.personId()),
              () -> removeMember(berto.token(), pioppo, berto.personId()));

      assertThat(statuses(both))
          .as("round " + round + ": " + both)
          .containsExactlyInAnyOrder(204, 409);
      Response refused = both.stream().filter(r -> r.status() == 409).findFirst().orElseThrow();
      assertThat(refused.error()).isEqualTo("last_manager");
      String stayer = both.get(0).status() == 409 ? alba.token() : berto.token();
      List<Map<String, Object>> members = members(stayer, pioppo);
      assertThat(members).as("round " + round).hasSize(1);
      assertThat(members.get(0)).containsEntry("role", "MANAGER");
    }
  }

  @Test
  void aUserRemovedFromHisLastTwoFamiliesTogetherIsDisabled() throws Exception {
    User alba = newManager("Alba", "Famiglia Salice");
    User berto = newManager("Berto", "Famiglia Cedro");
    for (int round = 0; round < ROUNDS; round++) {
      User dario = newMemberWithCode("Dario", invite(alba.token(), alba.familyId()));
      joinOk(dario, invite(berto.token(), berto.familyId()));

      List<Response> both =
          together(
              () -> removeMember(alba.token(), alba.familyId(), dario.personId()),
              () -> removeMember(berto.token(), berto.familyId(), dario.personId()));

      assertThat(statuses(both)).as("round " + round + ": " + both).containsExactly(204, 204);
      assertThat(login(dario.email(), GOOD_PASSWORD).status())
          .as("round " + round + ": no family left, so the account is disabled")
          .isEqualTo(401);
      assertThat(get("/api/me", dario.token()).status()).isEqualTo(401);
    }
  }

  @Test
  void joiningWhileLosingTheLastFamilyNeverLeavesAnInconsistentAccount() throws Exception {
    User irene = newManager("Irene", FAGGIO);
    User bruno = newManager("Bruno", OLMO);
    for (int round = 0; round < ROUNDS; round++) {
      User ettore = newMemberWithCode("Ettore", invite(irene.token(), irene.familyId()));
      String olmoCode = invite(bruno.token(), bruno.familyId());

      List<Response> both =
          together(
              () -> join(ettore.token(), olmoCode),
              () -> removeMember(irene.token(), irene.familyId(), ettore.personId()));

      assertThat(both.get(1).status()).as("round " + round + ": " + both).isEqualTo(204);
      assertThat(both.get(0).status()).as("round " + round + ": " + both).isIn(200, 401);
      boolean active = login(ettore.email(), GOOD_PASSWORD).status() == 200;
      boolean inFaggio = memberIds(irene.token(), irene.familyId()).contains(ettore.personId());
      boolean inOlmo = memberIds(bruno.token(), bruno.familyId()).contains(ettore.personId());
      assertThat(inFaggio).as("round " + round).isFalse();
      assertThat(active)
          .as(
              "round "
                  + round
                  + ": active exactly when he still has a family (Olmo: "
                  + inOlmo
                  + ")")
          .isEqualTo(inOlmo);
      assertThat(inOlmo).as("round " + round).isEqualTo(both.get(0).status() == 200);
    }
  }

  @Test
  void aResourceAddedWhileItsReferentIsRemovedNeverFailsTheServer() throws Exception {
    User irene = newManager("Irene", FAGGIO);
    User carla = newManager("Carla", TIGLIO);
    joinOk(carla, invite(irene.token(), irene.familyId()));
    setRoleOk(irene.token(), irene.familyId(), carla.personId(), "MANAGER");
    for (int round = 0; round < ROUNDS; round++) {
      User bruno = newManager("Bruno", OLMO);
      joinOk(bruno, invite(irene.token(), irene.familyId()));
      String resource = UUID.randomUUID().toString();

      List<Response> both =
          together(
              () ->
                  addResource(irene.token(), irene.familyId(), resource, "Nina", bruno.personId()),
              () -> removeMember(carla.token(), irene.familyId(), bruno.personId()));

      List<Integer> statuses = statuses(both);
      assertThat(statuses)
          .as("round " + round + ": " + both)
          .isIn(List.of(201, 409), List.of(400, 204));
      if (statuses.get(1) == 409) {
        assertThat(both.get(1).error()).isEqualTo("referent_in_use");
      } else {
        assertThat(both.get(0).error()).isEqualTo("referent_invalid");
        assertThat(memberIds(irene.token(), irene.familyId())).doesNotContain(resource);
      }
    }
  }
}
