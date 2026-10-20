package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Round 003, T3: login, the identical refusal, logout, session expiry on the server clock, {@code
 * /api/me}, password change and the login attempt limit (keyed on the normalised e-mail, also for
 * e-mails that do not exist). Black box over HTTP.
 */
class Giro003LoginAcceptanceTest extends Giro003AcceptanceSupport {

  @Test
  void loginGivesATokenForThirtyDaysThatOpensMeAndLogoutClosesIt() throws Exception {
    Response created =
        register("accesso.base@example.com", GOOD_PASSWORD, "Famiglia Accesso", null);
    assertThat(created.status()).as(created.body()).isEqualTo(201);

    Response login = login("accesso.base@example.com", GOOD_PASSWORD);
    assertThat(login.status()).as(login.body()).isEqualTo(200);
    String token = login.json("$.token");
    assertThat(token).hasSizeGreaterThanOrEqualTo(32);
    assertThat((String) login.json("$.personId")).isEqualTo((String) created.json("$.personId"));
    assertThat(Instant.parse(login.json("$.expiresAt")))
        .as("30 days after the server clock")
        .isEqualTo(clock.instant().plus(Duration.ofDays(30)));

    Response me = get("/api/me", token);
    assertThat(me.status()).isEqualTo(200);
    assertThat((String) me.json("$.email")).isEqualTo("accesso.base@example.com");
    assertThat((String) me.json("$.displayName")).isEqualTo("Persona di prova");
    assertThat((String) me.json("$.locale")).isEqualTo("it");

    Response logout = send("POST", "/api/auth/logout", token, null);
    assertThat(logout.status()).isEqualTo(204);
    assertThat(get("/api/me", token).status()).as("token after logout").isEqualTo(401);
    assertThat(get("/api/families", token).status()).as("token after logout").isEqualTo(401);
  }

  @Test
  void aSessionExpiresThirtyDaysAfterLoginOnTheServerClock() throws Exception {
    assertThat(register("sessione.lunga@example.com", GOOD_PASSWORD, "Famiglia S", null).status())
        .isEqualTo(201);
    String token = token("sessione.lunga@example.com", GOOD_PASSWORD);

    clock.advance(Duration.ofDays(29));
    assertThat(get("/api/me", token).status()).as("after 29 days").isEqualTo(200);

    clock.advance(Duration.ofDays(1).plusMinutes(1));
    assertThat(get("/api/me", token).status()).as("after 30 days and 1 minute").isEqualTo(401);
    assertThat(get("/api/families", token).status()).isEqualTo(401);
  }

  @Test
  void unknownEmailAndWrongPasswordGetTheSameRefusal() throws Exception {
    assertThat(register("rifiuto.uguale@example.com", GOOD_PASSWORD, "Famiglia U", null).status())
        .isEqualTo(201);

    Response wrongPassword = login("rifiuto.uguale@example.com", "Sbagliata-Del-Tutto-9");
    Response unknownEmail = login("nessuno.qui@example.com", GOOD_PASSWORD);
    Response tooLong = login("rifiuto.uguale@example.com", "a".repeat(200));

    assertThat(wrongPassword.status()).isEqualTo(401);
    assertThat(wrongPassword.error()).isEqualTo("invalid_credentials");
    assertThat(unknownEmail.status()).isEqualTo(wrongPassword.status());
    assertThat(unknownEmail.body()).isEqualTo(wrongPassword.body());
    assertThat(tooLong.status()).as("an overlong password is a refusal, not a 500").isEqualTo(401);
    assertThat(tooLong.body()).isEqualTo(wrongPassword.body());
  }

  @Test
  void anUnknownEmailTakesAsLongAsAWrongPassword() throws Exception {
    // The server checks a dummy hash for unknown e-mails: no shortcut that reveals who exists.
    assertThat(register("tempo.uguale@example.com", GOOD_PASSWORD, "Famiglia T", null).status())
        .isEqualTo(201);
    List<Long> unknown = new ArrayList<>();
    List<Long> wrong = new ArrayList<>();
    for (int round = 0; round < 7; round++) {
      clock.advance(Duration.ofMinutes(16));
      long t0 = System.nanoTime();
      assertThat(login("tempo.nessuno@example.com", GOOD_PASSWORD).status()).isEqualTo(401);
      long t1 = System.nanoTime();
      assertThat(login("tempo.uguale@example.com", "Sbagliata-Del-Tutto-9").status())
          .isEqualTo(401);
      long t2 = System.nanoTime();
      if (round > 0) {
        unknown.add(t1 - t0);
        wrong.add(t2 - t1);
      }
    }
    Collections.sort(unknown);
    Collections.sort(wrong);
    long unknownMedian = unknown.get(unknown.size() / 2);
    long wrongMedian = wrong.get(wrong.size() / 2);
    assertThat(unknownMedian)
        .as("median ns, unknown e-mail %d vs wrong password %d", unknownMedian, wrongMedian)
        .isGreaterThanOrEqualTo(wrongMedian * 4 / 10);
  }

  @Test
  void theSixthFailedLoginIsRefusedEvenWithTheRightPasswordUntilFifteenMinutesPass()
      throws Exception {
    assertThat(register("blocco.login@example.com", GOOD_PASSWORD, "Famiglia B", null).status())
        .isEqualTo(201);
    for (int i = 1; i <= 5; i++) {
      Response wrong = login("blocco.login@example.com", "Sbagliata-" + i + "-xxxx");
      assertThat(wrong.status()).as("failed login " + i).isEqualTo(401);
    }
    Response sixth = login("blocco.login@example.com", GOOD_PASSWORD);
    assertThat(sixth.status()).as(sixth.body()).isEqualTo(429);
    assertThat(sixth.error()).isEqualTo("too_many_attempts");
    assertThat(sixth.raw().headers().firstValue("Retry-After"))
        .hasValueSatisfying(value -> assertThat(Long.parseLong(value)).isPositive());

    clock.advance(Duration.ofMinutes(15).plusSeconds(1));
    assertThat(login("blocco.login@example.com", GOOD_PASSWORD).status()).isEqualTo(200);
  }

  @Test
  void theLimitCountsAlsoEmailsThatDoNotExist() throws Exception {
    for (int i = 1; i <= 5; i++) {
      assertThat(login("fantasma@example.com", "Sbagliata-" + i + "-xxxx").status())
          .as("failed login " + i)
          .isEqualTo(401);
    }
    Response sixth = login("fantasma@example.com", GOOD_PASSWORD);
    assertThat(sixth.status()).as("same answer as for an existing e-mail").isEqualTo(429);
    assertThat(sixth.error()).isEqualTo("too_many_attempts");
  }

  @Test
  void theLimitIsKeyedOnTheNormalisedEmail() throws Exception {
    assertThat(register("Maiuscole.Miste@Example.com", GOOD_PASSWORD, "Famiglia M", null).status())
        .isEqualTo(201);
    String token = token("maiuscole.miste@example.com", GOOD_PASSWORD);
    assertThat((String) get("/api/me", token).json("$.email"))
        .isEqualTo("maiuscole.miste@example.com");
    assertThat(login("  MAIUSCOLE.MISTE@example.COM ", GOOD_PASSWORD).status())
        .as("login with another case and spaces")
        .isEqualTo(200);

    List<String> variants =
        List.of(
            "maiuscole.miste@example.com",
            "MAIUSCOLE.MISTE@EXAMPLE.COM",
            " maiuscole.miste@example.com",
            "Maiuscole.Miste@Example.com ",
            "maiuscole.MISTE@example.com");
    for (String variant : variants) {
      assertThat(login(variant, "Sbagliata-Del-Tutto-9").status()).as(variant).isEqualTo(401);
    }
    Response sixth = login("MAIUSCOLE.MISTE@EXAMPLE.COM", GOOD_PASSWORD);
    assertThat(sixth.status()).as("sixth attempt in upper case").isEqualTo(429);
  }

  @Test
  void passwordChange() throws Exception {
    assertThat(register("cambio.password@example.com", GOOD_PASSWORD, "Famiglia C", null).status())
        .isEqualTo(201);
    String token = token("cambio.password@example.com", GOOD_PASSWORD);
    String newPassword = "Girasole-Verde-77";

    Response wrongCurrent =
        send(
            "PUT",
            "/api/me/password",
            token,
            json("currentPassword", "Non-E-Questa-1", "newPassword", newPassword));
    assertThat(wrongCurrent.status()).isEqualTo(400);
    assertThat(wrongCurrent.error()).isEqualTo("current_password_wrong");

    Response tooShort =
        send(
            "PUT",
            "/api/me/password",
            token,
            json("currentPassword", GOOD_PASSWORD, "newPassword", SHORT_PASSWORD));
    assertThat(tooShort.status()).isEqualTo(400);
    assertThat(tooShort.error()).isEqualTo("password_too_short");

    Response common =
        send(
            "PUT",
            "/api/me/password",
            token,
            json("currentPassword", GOOD_PASSWORD, "newPassword", COMMON_PASSWORD));
    assertThat(common.status()).isEqualTo(400);
    assertThat(common.error()).isEqualTo("password_too_common");

    Response tooLong =
        send(
            "PUT",
            "/api/me/password",
            token,
            json("currentPassword", GOOD_PASSWORD, "newPassword", "b".repeat(73)));
    assertThat(tooLong.status()).isEqualTo(400);
    assertThat(tooLong.error()).isEqualTo("password_too_long");

    Response changed =
        send(
            "PUT",
            "/api/me/password",
            token,
            json("currentPassword", GOOD_PASSWORD, "newPassword", newPassword));
    assertThat(changed.status()).as(changed.body()).isEqualTo(204);

    clock.advance(Duration.ofMinutes(16));
    assertThat(login("cambio.password@example.com", GOOD_PASSWORD).status())
        .as("old password")
        .isEqualTo(401);
    assertThat(login("cambio.password@example.com", newPassword).status())
        .as("new password")
        .isEqualTo(200);
  }
}
