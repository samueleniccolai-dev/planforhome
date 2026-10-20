package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 003, T3: registration with a new family or with an invite code, password rules, field
 * limits, the registration and invite-code attempt limits. Black box over HTTP.
 */
class Giro003RegistrationAcceptanceTest extends Giro003AcceptanceSupport {

  private void assertNoAccount(String email) throws Exception {
    Response login = login(email, GOOD_PASSWORD);
    assertThat(login.status())
        .as("login of " + email + " after a refused registration")
        .isEqualTo(401);
  }

  @Test
  void registrationWithAFamilyNameMakesTheNewPersonManagerOfTheNewFamily() throws Exception {
    Response created =
        register("nuova.gestrice@example.com", GOOD_PASSWORD, "Famiglia Verdi", null);

    assertThat(created.status()).as(created.body()).isEqualTo(201);
    assertThat((String) created.json("$.personId")).isNotBlank();
    assertThat((String) created.json("$.families[0].name")).isEqualTo("Famiglia Verdi");
    assertThat((String) created.json("$.families[0].role")).isEqualTo("MANAGER");

    String token = token("nuova.gestrice@example.com", GOOD_PASSWORD);
    Response families = get("/api/families", token);
    assertThat(families.status()).isEqualTo(200);
    assertThat((List<?>) families.json("$")).hasSize(1);
    assertThat((String) families.json("$[0].name")).isEqualTo("Famiglia Verdi");
    assertThat((String) families.json("$[0].role")).isEqualTo("MANAGER");
    assertThat((String) families.json("$[0].timeZone")).isEqualTo("Europe/Rome");
    assertThat((String) families.json("$[0].id"))
        .isEqualTo((String) created.json("$.families[0].id"));
  }

  @Test
  void registrationWithAValidCodeMakesTheNewPersonMemberAndTheCodeIsNotReusable() throws Exception {
    String familyId = registerManager("gestore.rossi@example.com", "Famiglia Rossi");
    String manager = token("gestore.rossi@example.com", GOOD_PASSWORD);

    Response invite = send("POST", "/api/families/" + familyId + "/invites", manager, null);
    assertThat(invite.status()).as(invite.body()).isEqualTo(201);
    String code = invite.json("$.code");
    // At least 80 bits of randomness: at least 16 characters of base32 or hex-like alphabet.
    assertThat(code).hasSizeGreaterThanOrEqualTo(16);
    assertThat(Instant.parse(invite.json("$.expiresAt")))
        .as("expires 7 days after the server clock")
        .isEqualTo(clock.instant().plus(Duration.ofDays(7)));

    Response joined = register("nuovo.membro@example.com", GOOD_PASSWORD, null, code);
    assertThat(joined.status()).as(joined.body()).isEqualTo(201);
    assertThat((String) joined.json("$.families[0].id")).isEqualTo(familyId);
    assertThat((String) joined.json("$.families[0].role")).isEqualTo("MEMBER");

    String member = token("nuovo.membro@example.com", GOOD_PASSWORD);
    Response families = get("/api/families", member);
    assertThat((List<?>) families.json("$")).hasSize(1);
    assertThat((String) families.json("$[0].role")).isEqualTo("MEMBER");

    Response members = get("/api/families/" + familyId + "/members", manager);
    assertThat(members.status()).isEqualTo(200);
    List<String> roles =
        JsonPath.read(
            members.body(), "$[?(@.personId == '" + joined.json("$.personId") + "')].role");
    assertThat(roles).containsExactly("MEMBER");

    Response reused = register("codice.usato@example.com", GOOD_PASSWORD, null, code);
    assertThat(reused.status()).isEqualTo(400);
    assertThat(reused.error()).isEqualTo("invite_invalid");
    assertNoAccount("codice.usato@example.com");
  }

  @Test
  void anEmailAlreadyTakenIsRefusedAndDoesNotConsumeTheInvite() throws Exception {
    String familyId = registerManager("gestore.bianchi@example.com", "Famiglia Bianchi");
    String manager = token("gestore.bianchi@example.com", GOOD_PASSWORD);
    String code = invite(manager, familyId);

    Response taken = register("gestore.bianchi@example.com", GOOD_PASSWORD, null, code);
    assertThat(taken.status()).as(taken.body()).isEqualTo(409);
    assertThat(taken.error()).isEqualTo("email_taken");

    Response takenOtherCase =
        register("  Gestore.Bianchi@EXAMPLE.com ", GOOD_PASSWORD, "Famiglia Doppia", null);
    assertThat(takenOtherCase.status()).as("same e-mail, other case").isEqualTo(409);

    Response joined = register("membro.bianchi@example.com", GOOD_PASSWORD, null, code);
    assertThat(joined.status()).as("the code still works: " + joined.body()).isEqualTo(201);
    assertThat((String) joined.json("$.families[0].id")).isEqualTo(familyId);
  }

  @Test
  void registrationNeedsExactlyOneModeAndCreatesNothingWhenRefused() throws Exception {
    Response none = register("senza.famiglia@example.com", GOOD_PASSWORD, null, null);
    assertThat(none.status()).isEqualTo(400);
    assertThat(none.error()).isEqualTo("registration_mode_required");

    String familyId = registerManager("gestore.neri@example.com", "Famiglia Neri");
    String code = invite(token("gestore.neri@example.com", GOOD_PASSWORD), familyId);
    Response both = register("senza.famiglia@example.com", GOOD_PASSWORD, "Famiglia Due", code);
    assertThat(both.status()).isEqualTo(400);
    assertThat(both.error()).isEqualTo("registration_mode_required");

    assertNoAccount("senza.famiglia@example.com");
    Response later = register("senza.famiglia@example.com", GOOD_PASSWORD, "Famiglia Dopo", null);
    assertThat(later.status()).as(later.body()).isEqualTo(201);
  }

  @Test
  void anExpiredOrInventedCodeIsRefusedAndCreatesNothing() throws Exception {
    String familyId = registerManager("gestore.gialli@example.com", "Famiglia Gialli");
    String code = invite(token("gestore.gialli@example.com", GOOD_PASSWORD), familyId);

    clock.advance(Duration.ofDays(7).plusMinutes(1));
    Response expired = register("codice.scaduto@example.com", GOOD_PASSWORD, null, code);
    assertThat(expired.status()).isEqualTo(400);
    assertThat(expired.error()).isEqualTo("invite_invalid");
    assertNoAccount("codice.scaduto@example.com");

    Response invented =
        register("codice.inventato@example.com", GOOD_PASSWORD, null, "ZZZZ-NON-ESISTE-0000");
    assertThat(invented.status()).isEqualTo(400);
    assertThat(invented.error()).isEqualTo("invite_invalid");
    assertNoAccount("codice.inventato@example.com");

    Response later = register("codice.scaduto@example.com", GOOD_PASSWORD, "Famiglia Nuova", null);
    assertThat(later.status()).as(later.body()).isEqualTo(201);
  }

  @Test
  void weakPasswordsAreRefused() throws Exception {
    Response shortOne = register("debole.uno@example.com", SHORT_PASSWORD, "Famiglia A", null);
    assertThat(shortOne.status()).isEqualTo(400);
    assertThat(shortOne.error()).isEqualTo("password_too_short");

    Response common = register("debole.due@example.com", COMMON_PASSWORD, "Famiglia B", null);
    assertThat(common.status()).isEqualTo(400);
    assertThat(common.error()).isEqualTo("password_too_common");

    assertNoAccount("debole.uno@example.com");
    assertNoAccount("debole.due@example.com");
  }

  @Test
  void passwordsLongerThan72BytesAreRefusedWithoutAServerError() throws Exception {
    Response ascii = register("lunga.uno@example.com", "a".repeat(73), "Famiglia L", null);
    assertThat(ascii.status()).as(ascii.body()).isEqualTo(400);
    assertThat(ascii.error()).isEqualTo("password_too_long");

    // 37 accented letters are 74 bytes in UTF-8: the limit is on bytes, not characters.
    Response accented = register("lunga.due@example.com", "à".repeat(37), "Famiglia L", null);
    assertThat(accented.status()).as(accented.body()).isEqualTo(400);
    assertThat(accented.error()).isEqualTo("password_too_long");

    String limit = "Lanterna-Blu-" + "x".repeat(72 - "Lanterna-Blu-".length());
    Response exactly72 = register("lunga.tre@example.com", limit, "Famiglia L", null);
    assertThat(exactly72.status()).as("72 bytes are allowed: " + exactly72.body()).isEqualTo(201);
    assertThat(login("lunga.tre@example.com", limit).status()).isEqualTo(200);
  }

  @Test
  void emailAndDisplayNameHaveLimits() throws Exception {
    String longEmail = "a".repeat(250) + "@example.com";
    Response tooLong = register(longEmail, GOOD_PASSWORD, "Persona", "Famiglia E", null, Map.of());
    assertThat(tooLong.status()).as(tooLong.body()).isEqualTo(400);
    assertThat(tooLong.error()).isEqualTo("email_invalid");

    Response noAt =
        register("senza-chiocciola", GOOD_PASSWORD, "Persona", "Famiglia E", null, Map.of());
    assertThat(noAt.status()).isEqualTo(400);
    assertThat(noAt.error()).isEqualTo("email_invalid");

    Response blankName =
        register("nome.vuoto@example.com", GOOD_PASSWORD, "  ", "Famiglia E", null, Map.of());
    assertThat(blankName.status()).isEqualTo(400);
    assertThat(blankName.error()).isEqualTo("display_name_invalid");

    Response longName =
        register(
            "nome.lungo@example.com", GOOD_PASSWORD, "N".repeat(81), "Famiglia E", null, Map.of());
    assertThat(longName.status()).isEqualTo(400);
    assertThat(longName.error()).isEqualTo("display_name_invalid");

    Response name80 =
        register(
            "nome.giusto@example.com", GOOD_PASSWORD, "N".repeat(80), "Famiglia E", null, Map.of());
    assertThat(name80.status()).as("80 characters are allowed: " + name80.body()).isEqualTo(201);
  }

  @Test
  void theEleventhRegistrationFromTheSameIpInAnHourIsRefused() throws Exception {
    for (int i = 1; i <= 10; i++) {
      Response ok =
          register("raffica." + i + "@example.com", GOOD_PASSWORD, "Famiglia R" + i, null);
      assertThat(ok.status()).as("registration " + i + ": " + ok.body()).isEqualTo(201);
    }
    Response eleventh = register("raffica.11@example.com", GOOD_PASSWORD, "Famiglia R11", null);
    assertThat(eleventh.status()).isEqualTo(429);
    assertThat(eleventh.error()).isEqualTo("too_many_attempts");
    assertThat(eleventh.raw().headers().firstValue("Retry-After")).isPresent();
    assertNoAccount("raffica.11@example.com");

    Response otherIp =
        register(
            "raffica.altro.ip@example.com",
            GOOD_PASSWORD,
            "Persona",
            "Famiglia Altro IP",
            null,
            Map.of("X-Forwarded-For", "203.0.113.7"));
    assertThat(otherIp.status()).as("the limit is per IP: " + otherIp.body()).isEqualTo(201);

    clock.advance(Duration.ofHours(1).plusMinutes(1));
    Response afterAnHour = register("raffica.11@example.com", GOOD_PASSWORD, "Famiglia R11", null);
    assertThat(afterAnHour.status()).as(afterAnHour.body()).isEqualTo(201);
  }

  @Test
  void theSixthCodeAfterFiveRefusedCodesIsRefusedEvenIfValid() throws Exception {
    String familyId = registerManager("gestore.viola@example.com", "Famiglia Viola");
    String code = invite(token("gestore.viola@example.com", GOOD_PASSWORD), familyId);

    for (int i = 1; i <= 5; i++) {
      Response wrong =
          register("tentativo." + i + "@example.com", GOOD_PASSWORD, null, "INVENTATO-000" + i);
      assertThat(wrong.status()).as("invented code " + i).isEqualTo(400);
      assertThat(wrong.error()).isEqualTo("invite_invalid");
    }
    Response sixth = register("membro.viola@example.com", GOOD_PASSWORD, null, code);
    assertThat(sixth.status()).as(sixth.body()).isEqualTo(429);
    assertThat(sixth.error()).isEqualTo("too_many_attempts");
    assertNoAccount("membro.viola@example.com");

    clock.advance(Duration.ofHours(1).plusMinutes(1));
    Response later = register("membro.viola@example.com", GOOD_PASSWORD, null, code);
    assertThat(later.status())
        .as("the valid code was not consumed: " + later.body())
        .isEqualTo(201);
  }
}
