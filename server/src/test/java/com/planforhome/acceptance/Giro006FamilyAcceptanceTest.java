package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Round 006, T4: P14 (any user creates a family and becomes its manager) and an invite code used by
 * a person who is already registered. People of the plan: Irene manages Famiglia Faggio; Bruno
 * (Famiglia Olmo), Carla (Famiglia Tiglio) and Ettore (only Faggio) are members.
 */
class Giro006FamilyAcceptanceTest extends Giro006AcceptanceSupport {

  // ---------------------------------------------------------------- P14

  @Test
  void aMemberCreatesAFamilyAndBecomesItsManager() throws Exception {
    Faggio f = faggio();
    String id = UUID.randomUUID().toString();

    Response created = createFamily(f.ettore().token(), id, "Famiglia Larice", null);

    assertThat(created.status()).as(created.body()).isEqualTo(201);
    assertThat((String) created.json("$.id")).isEqualTo(id);
    assertThat((String) created.json("$.name")).isEqualTo("Famiglia Larice");
    assertThat((String) created.json("$.timeZone")).isEqualTo("Europe/Rome");
    assertThat((String) created.json("$.role")).isEqualTo("MANAGER");
    assertThat(familyIds(f.ettore().token())).containsExactlyInAnyOrder(f.id(), id);
    List<Map<String, Object>> members = members(f.ettore().token(), id);
    assertThat(members).hasSize(1);
    assertThat(members.get(0)).containsEntry("personId", f.ettore().personId());
    assertThat(members.get(0)).containsEntry("role", "MANAGER");
  }

  @Test
  void aFamilyKeepsTheTimeZoneItWasCreatedWith() throws Exception {
    User irene = newManager("Irene", FAGGIO);
    Response created = createFamily(irene.token(), null, "Famiglia Sequoia", "America/New_York");
    assertThat(created.status()).as(created.body()).isEqualTo(201);
    assertThat((String) created.json("$.timeZone")).isEqualTo("America/New_York");
  }

  @Test
  void aBadRequestCreatesNoFamily() throws Exception {
    User irene = newManager("Irene", FAGGIO);

    Response anonymous = createFamily(null, null, "Famiglia Abusiva", null);
    assertThat(anonymous.status()).isEqualTo(401);

    Response blank = createFamily(irene.token(), null, "   ", null);
    assertThat(blank.status()).as(blank.body()).isEqualTo(400);
    assertThat(blank.error()).isEqualTo("family_name_invalid");

    Response tooLong = createFamily(irene.token(), null, "F".repeat(81), null);
    assertThat(tooLong.status()).as(tooLong.body()).isEqualTo(400);
    assertThat(tooLong.error()).isEqualTo("family_name_invalid");

    Response zone = createFamily(irene.token(), null, "Famiglia Marziana", "Marte/Olimpo");
    assertThat(zone.status()).as(zone.body()).isEqualTo(400);
    assertThat(zone.error()).isEqualTo("time_zone_invalid");

    assertThat(familyIds(irene.token())).containsExactly(irene.familyId());
  }

  @Test
  void theSameIdSentTwiceGivesTheSameFamily() throws Exception {
    User irene = newManager("Irene", FAGGIO);
    String id = UUID.randomUUID().toString();

    Response first = createFamily(irene.token(), id, "Famiglia Noce", null);
    Response again = createFamily(irene.token(), id, "Famiglia Noce", null);

    assertThat(first.status()).as(first.body()).isEqualTo(201);
    assertThat(again.status()).as(again.body()).isEqualTo(200);
    assertThat((String) again.json("$.id")).isEqualTo(id);
    assertThat((String) again.json("$.role")).isEqualTo("MANAGER");
    assertThat(familyIds(irene.token())).containsExactlyInAnyOrder(irene.familyId(), id);
    assertThat(memberIds(irene.token(), id)).containsExactly(irene.personId());
  }

  @Test
  void theSameIdSentTwiceAtTheSameTimeGivesOneFamily() throws Exception {
    User irene = newManager("Irene", FAGGIO);
    String id = UUID.randomUUID().toString();

    List<Response> both =
        together(
            () -> createFamily(irene.token(), id, "Famiglia Gelso", null),
            () -> createFamily(irene.token(), id, "Famiglia Gelso", null));

    assertThat(statuses(both)).as(both.toString()).containsExactlyInAnyOrder(201, 200);
    assertThat(familyIds(irene.token())).containsExactlyInAnyOrder(irene.familyId(), id);
    assertThat(memberIds(irene.token(), id)).containsExactly(irene.personId());
  }

  @Test
  void theIdOfAFamilyOfSomeoneElseIsAConflictAndLeaksNothing() throws Exception {
    User irene = newManager("Irene", FAGGIO);
    User bruno = newManager("Bruno", OLMO);

    Response taken = createFamily(bruno.token(), irene.familyId(), "Famiglia Faggio", null);

    assertThat(taken.status()).as(taken.body()).isEqualTo(409);
    assertThat(taken.body()).isEqualToIgnoringWhitespace("{\"error\":\"id_conflict\"}");
    assertThat(familyIds(bruno.token())).containsExactly(bruno.familyId());
    assertThat(memberIds(irene.token(), irene.familyId())).containsExactly(irene.personId());
    assertThat(get("/api/families/" + irene.familyId() + "/members", bruno.token()).status())
        .isEqualTo(404);
  }

  @Test
  void theIdOfADemoFamilyIsAConflict() throws Exception {
    User irene = newManager("Irene", FAGGIO);
    String babbo = familyId(demoToken("rosa"), BABBO);

    Response taken = createFamily(irene.token(), babbo, "Famiglia Babbo", null);

    assertThat(taken.status()).as(taken.body()).isEqualTo(409);
    assertThat(taken.body()).isEqualToIgnoringWhitespace("{\"error\":\"id_conflict\"}");
    assertThat(familyIds(irene.token())).containsExactly(irene.familyId());
  }

  // ---------------------------------------------------------------- code from a registered user

  @Test
  void aRegisteredUserJoinsAFamilyWithACode() throws Exception {
    User irene = newManager("Irene", FAGGIO);
    User bruno = newManager("Bruno", OLMO);

    Response joined = join(bruno.token(), invite(irene.token(), irene.familyId()));

    assertThat(joined.status()).as(joined.body()).isEqualTo(200);
    assertThat((String) joined.json("$.id")).isEqualTo(irene.familyId());
    assertThat((String) joined.json("$.name")).isEqualTo(FAGGIO);
    assertThat((String) joined.json("$.role")).isEqualTo("MEMBER");
    assertThat(familyIds(bruno.token()))
        .containsExactlyInAnyOrder(bruno.familyId(), irene.familyId());
    assertThat(member(irene.token(), irene.familyId(), bruno.personId()))
        .containsEntry("role", "MEMBER");
  }

  @Test
  void aUsedAnExpiredOrAnInventedCodeChangesNothing() throws Exception {
    User irene = newManager("Irene", FAGGIO);
    User bruno = newManager("Bruno", OLMO);
    User carla = newManager("Carla", TIGLIO);
    String used = invite(irene.token(), irene.familyId());
    joinOk(bruno, used);
    String expiring = invite(irene.token(), irene.familyId());

    Response again = join(carla.token(), used);
    assertThat(again.status()).as(again.body()).isEqualTo(400);
    assertThat(again.error()).isEqualTo("invite_invalid");

    Response invented = join(carla.token(), "CODICEINVENTATO23456");
    assertThat(invented.status()).as(invented.body()).isEqualTo(400);
    assertThat(invented.error()).isEqualTo("invite_invalid");

    clock.advance(Duration.ofDays(7).plusMinutes(1));
    Response expired = join(carla.token(), expiring);
    assertThat(expired.status()).as(expired.body()).isEqualTo(400);
    assertThat(expired.error()).isEqualTo("invite_invalid");

    assertThat(memberIds(irene.token(), irene.familyId())).doesNotContain(carla.personId());
    assertThat(familyIds(carla.token())).containsExactly(carla.familyId());
  }

  @Test
  void alreadyMemberIsAConflictAndDoesNotUseTheCode() throws Exception {
    User irene = newManager("Irene", FAGGIO);
    User bruno = newManager("Bruno", OLMO);
    User carla = newManager("Carla", TIGLIO);
    joinOk(bruno, invite(irene.token(), irene.familyId()));
    String second = invite(irene.token(), irene.familyId());

    Response twice = join(bruno.token(), second);
    assertThat(twice.status()).as(twice.body()).isEqualTo(409);
    assertThat(twice.error()).isEqualTo("already_member");
    assertThat(familyIds(bruno.token()))
        .containsExactlyInAnyOrder(bruno.familyId(), irene.familyId());

    Response forCarla = join(carla.token(), second);
    assertThat(forCarla.status()).as("the code is still good: " + forCarla.body()).isEqualTo(200);
  }

  @Test
  void wrongCodesFromOneIpAreLimitedAndAlreadyMemberGivesItsSlotBack() throws Exception {
    User irene = newManager("Irene", FAGGIO);
    User bruno = newManager("Bruno", OLMO);
    joinOk(bruno, invite(irene.token(), irene.familyId()));

    String guesser = freshIp();
    for (int i = 0; i < 5; i++) {
      Response wrong = join(bruno.token(), "CODICESBAGLIATO" + (22222 + i), guesser);
      assertThat(wrong.status()).as("wrong code " + i + ": " + wrong.body()).isEqualTo(400);
    }
    Response sixth = join(bruno.token(), "CODICESBAGLIATO99999", guesser);
    assertThat(sixth.status()).as(sixth.body()).isEqualTo(429);
    assertThat(sixth.error()).isEqualTo("too_many_attempts");

    String member = freshIp();
    String good = invite(irene.token(), irene.familyId());
    for (int i = 0; i < 6; i++) {
      Response twice = join(bruno.token(), good, member);
      assertThat(twice.status()).as("already member " + i + ": " + twice.body()).isEqualTo(409);
    }
    Response wrong = join(bruno.token(), "CODICESBAGLIATO88888", member);
    assertThat(wrong.status()).as("slots given back: " + wrong.body()).isEqualTo(400);
  }
}
