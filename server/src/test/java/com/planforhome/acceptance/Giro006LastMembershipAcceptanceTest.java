package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Round 006, T4: P15 (leaving a family) and "nobody is left without a family" (SPEC 2.2.1): the
 * last membership of a user disables the account, the last membership of a resource deletes it, a
 * referent in use cannot go. Managers who leave have a second family, so {@code last_manager} is
 * never mistaken for {@code last_family}.
 */
class Giro006LastMembershipAcceptanceTest extends Giro006AcceptanceSupport {

  // ---------------------------------------------------------------- P15

  @Test
  void aMemberWithTwoFamiliesLeavesOne() throws Exception {
    Faggio f = faggio();

    Response left = removeMember(f.bruno().token(), f.id(), f.bruno().personId());

    assertThat(left.status()).as(left.body()).isEqualTo(204);
    assertThat(familyIds(f.bruno().token())).containsExactly(f.bruno().familyId());
    assertThat(memberIds(f.irene().token(), f.id())).doesNotContain(f.bruno().personId());
  }

  @Test
  void aManagerLeavesOnlyIfAnotherManagerStays() throws Exception {
    Faggio f = faggio();
    joinOk(f.irene(), invite(f.bruno().token(), f.bruno().familyId()));
    setRoleOk(f.irene().token(), f.id(), f.carla().personId(), "MANAGER");

    Response carlaLeaves = removeMember(f.carla().token(), f.id(), f.carla().personId());
    assertThat(carlaLeaves.status()).as(carlaLeaves.body()).isEqualTo(204);

    Response ireneLeaves = removeMember(f.irene().token(), f.id(), f.irene().personId());
    assertThat(ireneLeaves.status()).as(ireneLeaves.body()).isEqualTo(409);
    assertThat(ireneLeaves.error()).isEqualTo("last_manager");
    assertThat(member(f.irene().token(), f.id(), f.irene().personId()))
        .containsEntry("role", "MANAGER");
  }

  @Test
  void aUserCannotLeaveHerOnlyFamily() throws Exception {
    Faggio f = faggio();

    Response left = removeMember(f.ettore().token(), f.id(), f.ettore().personId());

    assertThat(left.status()).as(left.body()).isEqualTo(409);
    assertThat(left.error()).isEqualTo("last_family");
    assertThat(memberIds(f.irene().token(), f.id())).contains(f.ettore().personId());
    assertThat(meStatus(f.ettore().token())).isEqualTo(200);
  }

  @Test
  void theOnlyManagerOfHerOnlyFamilyIsToldLastManagerFirst() throws Exception {
    User irene = newManager("Irene", FAGGIO);

    Response left = removeMember(irene.token(), irene.familyId(), irene.personId());

    assertThat(left.status()).as(left.body()).isEqualTo(409);
    assertThat(left.error()).isEqualTo("last_manager");
  }

  // ---------------------------------------------------------------- last membership

  @Test
  void removingTheLastFamilyOfAUserDisablesTheAccount() throws Exception {
    Faggio f = faggio();
    var web = webCookies(f.ettore().email());
    assertThat(send("GET", "/api/me", null, null, web).status()).isEqualTo(200);

    Response removed = removeMember(f.irene().token(), f.id(), f.ettore().personId());

    assertThat(removed.status()).as(removed.body()).isEqualTo(204);
    assertThat(memberIds(f.irene().token(), f.id())).doesNotContain(f.ettore().personId());
    assertThat(meStatus(f.ettore().token())).as("token").isEqualTo(401);
    assertThat(send("GET", "/api/me", null, null, web).status()).as("web cookie").isEqualTo(401);
    Response rightPassword = login(f.ettore().email(), GOOD_PASSWORD);
    Response wrongPassword = login(f.ettore().email(), "Password-Sbagliata-9");
    assertThat(rightPassword.status()).isEqualTo(401);
    assertThat(rightPassword.status()).isEqualTo(wrongPassword.status());
    assertThat(rightPassword.body()).isEqualTo(wrongPassword.body());
  }

  @Test
  void removingTheLastFamilyOfAResourceDeletesIt() throws Exception {
    Faggio f = faggio();
    String nina = resourceOk(f.irene().token(), f.id(), "Nina", f.irene().personId());

    Response removed = removeMember(f.irene().token(), f.id(), nina);
    assertThat(removed.status()).as(removed.body()).isEqualTo(204);
    assertThat(memberIds(f.irene().token(), f.id())).doesNotContain(nina);

    Response again = removeMember(f.irene().token(), f.id(), nina);
    assertThat(again.status()).as(again.body()).isEqualTo(404);
  }

  @Test
  void aReferentInUseCannotGo() throws Exception {
    Faggio f = faggio();
    String nina = resourceOk(f.irene().token(), f.id(), "Nina", f.bruno().personId());

    Response removed = removeMember(f.irene().token(), f.id(), f.bruno().personId());
    assertThat(removed.status()).as(removed.body()).isEqualTo(409);
    assertThat(removed.error()).isEqualTo("referent_in_use");

    Response left = removeMember(f.bruno().token(), f.id(), f.bruno().personId());
    assertThat(left.status()).as(left.body()).isEqualTo(409);
    assertThat(left.error()).isEqualTo("referent_in_use");

    assertThat(memberIds(f.irene().token(), f.id())).contains(f.bruno().personId(), nina);
  }

  int meStatus(String token) throws Exception {
    return get("/api/me", token).status();
  }
}
