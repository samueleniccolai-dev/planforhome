package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Round 006, T4: P13, what only a manager does: invite codes, resources without an account, roles,
 * referents, removing another person's membership. Famiglia Faggio of the plan.
 */
class Giro006MembersAcceptanceTest extends Giro006AcceptanceSupport {

  @Test
  void aManagerCreatesInviteCodesAndAMemberCannot() throws Exception {
    Faggio f = faggio();
    Response byManager =
        send("POST", "/api/families/" + f.id() + "/invites", f.irene().token(), null);
    Response byMember =
        send("POST", "/api/families/" + f.id() + "/invites", f.bruno().token(), null);
    assertThat(byManager.status()).as(byManager.body()).isEqualTo(201);
    assertThat(byMember.status()).as(byMember.body()).isEqualTo(403);
  }

  // ---------------------------------------------------------------- resources

  @Test
  void aManagerAddsAResourceWithAReferent() throws Exception {
    Faggio f = faggio();
    String nina = UUID.randomUUID().toString();

    Response added = addResource(f.irene().token(), f.id(), nina, "Nina", f.irene().personId());

    assertThat(added.status()).as(added.body()).isEqualTo(201);
    assertThat((String) added.json("$.personId")).isEqualTo(nina);
    assertThat((String) added.json("$.displayName")).isEqualTo("Nina");
    assertThat((String) added.json("$.role")).isEqualTo("MEMBER");
    assertThat((Boolean) added.json("$.hasAccount")).isFalse();
    assertThat((String) added.json("$.referentPersonId")).isEqualTo(f.irene().personId());
    Map<String, Object> listed = member(f.irene().token(), f.id(), nina);
    assertThat(listed).containsEntry("hasAccount", false);
    assertThat(listed).containsEntry("referentPersonId", f.irene().personId());

    Response again = addResource(f.irene().token(), f.id(), nina, "Nina", f.irene().personId());
    assertThat(again.status()).as("same id again: " + again.body()).isEqualTo(200);
    assertThat((String) again.json("$.personId")).isEqualTo(nina);
    assertThat(memberIds(f.irene().token(), f.id())).hasSize(5);
  }

  @Test
  void aWrongResourceRequestAddsNobody() throws Exception {
    Faggio f = faggio();
    String irene = f.irene().personId();
    String nina = resourceOk(f.irene().token(), f.id(), "Nina", irene);
    List<String> before = memberIds(f.irene().token(), f.id());
    String luca = personIdOf(demoToken("luca"));
    String marco = personIdOf(demoToken("marco"));

    Response byMember = addResource(f.bruno().token(), f.id(), null, "Otto", irene);
    assertThat(byMember.status()).as(byMember.body()).isEqualTo(403);

    Response resourceReferent = addResource(f.irene().token(), f.id(), null, "Otto", nina);
    assertThat(resourceReferent.status()).as(resourceReferent.body()).isEqualTo(400);
    assertThat(resourceReferent.error()).isEqualTo("referent_invalid");

    Response otherFamilyReferent = addResource(f.irene().token(), f.id(), null, "Otto", luca);
    assertThat(otherFamilyReferent.status()).as(otherFamilyReferent.body()).isEqualTo(400);
    assertThat(otherFamilyReferent.error()).isEqualTo("referent_invalid");

    Response blank = addResource(f.irene().token(), f.id(), null, "  ", irene);
    assertThat(blank.status()).as(blank.body()).isEqualTo(400);
    assertThat(blank.error()).isEqualTo("display_name_invalid");

    Response marcoId = addResource(f.irene().token(), f.id(), marco, "Otto", irene);
    assertThat(marcoId.status()).as(marcoId.body()).isEqualTo(409);
    assertThat(marcoId.body()).isEqualToIgnoringWhitespace("{\"error\":\"id_conflict\"}");

    assertThat(memberIds(f.irene().token(), f.id())).containsExactlyInAnyOrderElementsOf(before);
  }

  // ---------------------------------------------------------------- roles

  @Test
  void aManagerChangesRolesButNeverLeavesTheFamilyWithoutOne() throws Exception {
    Faggio f = faggio();
    String token = f.irene().token();

    Response alone = setRole(token, f.id(), f.irene().personId(), "MEMBER");
    assertThat(alone.status()).as(alone.body()).isEqualTo(409);
    assertThat(alone.error()).isEqualTo("last_manager");

    Response promoted = setRole(token, f.id(), f.bruno().personId(), "MANAGER");
    assertThat(promoted.status()).as(promoted.body()).isEqualTo(200);
    assertThat((String) promoted.json("$.role")).isEqualTo("MANAGER");
    assertThat(member(token, f.id(), f.bruno().personId())).containsEntry("role", "MANAGER");

    Response demoted = setRole(token, f.id(), f.bruno().personId(), "MEMBER");
    assertThat(demoted.status()).as("two managers: " + demoted.body()).isEqualTo(200);
    assertThat(member(token, f.id(), f.bruno().personId())).containsEntry("role", "MEMBER");
  }

  @Test
  void aMemberCannotChangeRolesAndBadRolesAreRefused() throws Exception {
    Faggio f = faggio();
    String nina = resourceOk(f.irene().token(), f.id(), "Nina", f.irene().personId());

    Response self = setRole(f.carla().token(), f.id(), f.carla().personId(), "MANAGER");
    assertThat(self.status()).as(self.body()).isEqualTo(403);

    Response resource = setRole(f.irene().token(), f.id(), nina, "MANAGER");
    assertThat(resource.status()).as(resource.body()).isEqualTo(400);
    assertThat(resource.error()).isEqualTo("role_invalid");

    Response owner = setRole(f.irene().token(), f.id(), f.bruno().personId(), "OWNER");
    assertThat(owner.status()).as(owner.body()).isEqualTo(400);
    assertThat(owner.error()).isEqualTo("role_invalid");

    assertThat(member(f.irene().token(), f.id(), f.carla().personId()))
        .containsEntry("role", "MEMBER");
    assertThat(member(f.irene().token(), f.id(), nina)).containsEntry("role", "MEMBER");
  }

  @Test
  void checksComeInOrderMembershipThenRoleThenBody() throws Exception {
    Faggio f = faggio();
    String target = f.bruno().personId();

    Response outsider = setRole(demoToken("luca"), f.id(), target, null);
    Response member = setRole(f.carla().token(), f.id(), target, null);
    Response manager = setRole(f.irene().token(), f.id(), target, null);

    assertThat(outsider.status()).as(outsider.body()).isEqualTo(404);
    assertThat(member.status()).as(member.body()).isEqualTo(403);
    assertThat(manager.status()).as(manager.body()).isEqualTo(400);
  }

  // ---------------------------------------------------------------- referents

  @Test
  void aManagerMovesTheReferentOfAResource() throws Exception {
    Faggio f = faggio();
    String nina = resourceOk(f.irene().token(), f.id(), "Nina", f.irene().personId());

    Response moved = setReferent(f.irene().token(), f.id(), nina, f.bruno().personId());

    assertThat(moved.status()).as(moved.body()).isEqualTo(200);
    assertThat(member(f.irene().token(), f.id(), nina))
        .containsEntry("referentPersonId", f.bruno().personId());
  }

  @Test
  void wrongReferentChangesAreRefused() throws Exception {
    Faggio f = faggio();
    String irene = f.irene().personId();
    String nina = resourceOk(f.irene().token(), f.id(), "Nina", irene);
    String otto = resourceOk(f.irene().token(), f.id(), "Otto", irene);

    Response byMember = setReferent(f.carla().token(), f.id(), nina, f.carla().personId());
    assertThat(byMember.status()).as(byMember.body()).isEqualTo(403);

    Response toResource = setReferent(f.irene().token(), f.id(), nina, otto);
    assertThat(toResource.status()).as(toResource.body()).isEqualTo(400);
    assertThat(toResource.error()).isEqualTo("referent_invalid");

    Response ofAUser = setReferent(f.irene().token(), f.id(), f.bruno().personId(), irene);
    assertThat(ofAUser.status()).as(ofAUser.body()).isEqualTo(400);
    assertThat(ofAUser.error()).isEqualTo("not_a_resource");

    assertThat(member(f.irene().token(), f.id(), nina)).containsEntry("referentPersonId", irene);
    assertThat(member(f.irene().token(), f.id(), f.bruno().personId()).get("referentPersonId"))
        .isNull();
  }

  // ---------------------------------------------------------------- removing a membership

  @Test
  void aManagerRemovesAPersonWhoKeepsHerOtherFamily() throws Exception {
    Faggio f = faggio();

    Response byMember = removeMember(f.bruno().token(), f.id(), f.carla().personId());
    assertThat(byMember.status()).as(byMember.body()).isEqualTo(403);
    assertThat(memberIds(f.irene().token(), f.id())).contains(f.carla().personId());

    Response removed = removeMember(f.irene().token(), f.id(), f.carla().personId());
    assertThat(removed.status()).as(removed.body()).isEqualTo(204);
    assertThat(memberIds(f.irene().token(), f.id())).doesNotContain(f.carla().personId());

    String carla = token(f.carla().email(), GOOD_PASSWORD);
    assertThat(familyIds(carla)).containsExactly(f.carla().familyId());
    assertThat(get("/api/families/" + f.id() + "/members", carla).status()).isEqualTo(404);
  }
}
