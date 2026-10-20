package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 004, T3: the web session. A login with {@code "client":"web"} gives two cookies instead of
 * a token in the body; the session cookie authenticates, and every unsafe request authenticated by
 * cookie needs {@code X-CSRF-Token} equal to the {@code pfh_csrf} cookie of the same session. With
 * an {@code Authorization} header the cookie is ignored. The public endpoints do not check CSRF.
 */
class Giro004WebSessionAcceptanceTest extends Giro004AcceptanceSupport {

  @Test
  void aWebLoginSetsTheTwoCookiesAndNoTokenInTheBody() throws Exception {
    Response created =
        register("cookie.attributi.giro004@example.com", GOOD_PASSWORD, "Famiglia Biscotto", null);
    assertThat(created.status()).as(created.body()).isEqualTo(201);

    Response login =
        webLoginResponse("cookie.attributi.giro004@example.com", GOOD_PASSWORD, Map.of());
    assertThat(login.status()).as(login.body()).isEqualTo(200);
    Map<String, Object> body = bodyMap(login);
    assertThat(body).as("web login body").doesNotContainKey("token");
    assertThat(body.get("personId")).isEqualTo(created.json("$.personId"));
    assertThat(Instant.parse((String) body.get("expiresAt")))
        .isEqualTo(clock.instant().plus(Duration.ofDays(30)));

    SetCookie session =
        setCookie(login, SESSION_COOKIE).orElseThrow(() -> new AssertionError("no pfh_session"));
    assertThat(session.value()).hasSizeGreaterThanOrEqualTo(32);
    assertThat(session.has("HttpOnly")).as("pfh_session HttpOnly").isTrue();
    assertThat(session.has("Secure")).as("pfh_session Secure").isTrue();
    assertThat(session.attr("SameSite")).as("pfh_session SameSite").isEqualToIgnoringCase("Lax");
    assertThat(session.attr("Path")).as("pfh_session Path").isEqualTo("/api");
    assertThat(session.attr("Max-Age")).as("pfh_session Max-Age").isEqualTo("2592000");

    SetCookie csrf =
        setCookie(login, CSRF_COOKIE).orElseThrow(() -> new AssertionError("no pfh_csrf"));
    assertThat(csrf.value()).isNotBlank().isNotEqualTo(session.value());
    assertThat(csrf.has("HttpOnly")).as("pfh_csrf readable by the page").isFalse();
    assertThat(csrf.has("Secure")).as("pfh_csrf Secure").isTrue();
    assertThat(csrf.attr("SameSite")).as("pfh_csrf SameSite").isEqualToIgnoringCase("Lax");
    assertThat(csrf.attr("Path")).as("pfh_csrf Path").isEqualTo("/");
    assertThat(csrf.attr("Max-Age")).as("pfh_csrf Max-Age").isEqualTo("2592000");
  }

  @Test
  void theCookieAloneOpensMeAndOnlyTheOwnFamilies() throws Exception {
    WebSession luca = demoWebLogin("luca");

    Response me = send("GET", "/api/me", null, null, luca.cookies());
    assertThat(me.status()).as(me.body()).isEqualTo(200);
    assertThat((String) me.json("$.email")).isEqualTo("luca@example.com");

    Response families = send("GET", "/api/families", null, null, luca.cookies());
    assertThat(families.status()).as(families.body()).isEqualTo(200);
    assertThat((List<?>) families.json("$")).hasSize(1);
    assertThat((String) families.json("$[0].name")).isEqualTo(MAMMA);
  }

  @Test
  void logoutByCookieNeedsTheRightCsrfHeaderAndClearsBothCookies() throws Exception {
    assertThat(
            register("logout.web.giro004@example.com", GOOD_PASSWORD, "Famiglia Uscita", null)
                .status())
        .isEqualTo(201);
    WebSession web = webLogin("logout.web.giro004@example.com", GOOD_PASSWORD);

    Response noHeader = send("POST", "/api/auth/logout", null, null, web.cookies());
    assertThat(noHeader.status()).as("logout without X-CSRF-Token").isEqualTo(403);
    assertThat(noHeader.error()).isEqualTo("csrf_invalid");
    assertThat(meStatus(web)).as("session after a refused logout").isEqualTo(200);

    Response wrong =
        send("POST", "/api/auth/logout", null, null, web.withCsrf("valore-sbagliato-giro004"));
    assertThat(wrong.status()).as("logout with a wrong X-CSRF-Token").isEqualTo(403);
    assertThat(wrong.error()).isEqualTo("csrf_invalid");
    assertThat(meStatus(web)).as("session after a refused logout").isEqualTo(200);

    Response logout = send("POST", "/api/auth/logout", null, null, web.withCsrf());
    assertThat(logout.status()).as(logout.body()).isEqualTo(204);

    SetCookie clearedSession =
        setCookie(logout, SESSION_COOKIE)
            .orElseThrow(() -> new AssertionError("logout does not clear pfh_session"));
    assertThat(clearedSession.attr("Max-Age")).isEqualTo("0");
    assertThat(clearedSession.attr("Path")).as("same Path as when set").isEqualTo("/api");
    SetCookie clearedCsrf =
        setCookie(logout, CSRF_COOKIE)
            .orElseThrow(() -> new AssertionError("logout does not clear pfh_csrf"));
    assertThat(clearedCsrf.attr("Max-Age")).isEqualTo("0");
    assertThat(clearedCsrf.attr("Path")).as("same Path as when set").isEqualTo("/");

    assertThat(meStatus(web)).as("the same cookie after logout").isEqualTo(401);
  }

  @Test
  void passwordChangeByCookieWithoutCsrfIsRefusedAndChangesNothing() throws Exception {
    assertThat(
            register("password.csrf.giro004@example.com", GOOD_PASSWORD, "Famiglia Chiave", null)
                .status())
        .isEqualTo(201);
    WebSession web = webLogin("password.csrf.giro004@example.com", GOOD_PASSWORD);

    Response refused =
        send(
            "PUT",
            "/api/me/password",
            null,
            json("currentPassword", GOOD_PASSWORD, "newPassword", OTHER_PASSWORD),
            web.cookies());
    assertThat(refused.status()).as(refused.body()).isEqualTo(403);
    assertThat(refused.error()).isEqualTo("csrf_invalid");

    clock.advance(Duration.ofMinutes(16));
    assertThat(login("password.csrf.giro004@example.com", OTHER_PASSWORD).status())
        .as("the new password does not work")
        .isEqualTo(401);
    assertThat(login("password.csrf.giro004@example.com", GOOD_PASSWORD).status())
        .as("the old password still works")
        .isEqualTo(200);
  }

  @Test
  void theCsrfValueOfOneSessionDoesNotOpenAnother() throws Exception {
    assertThat(
            register("due.sessioni.giro004@example.com", GOOD_PASSWORD, "Famiglia Doppia", null)
                .status())
        .isEqualTo(201);
    WebSession first = webLogin("due.sessioni.giro004@example.com", GOOD_PASSWORD);
    WebSession second = webLogin("due.sessioni.giro004@example.com", GOOD_PASSWORD);
    assertThat(second.csrf()).isNotEqualTo(first.csrf());

    Response crossed = send("POST", "/api/auth/logout", null, null, first.withCsrf(second.csrf()));
    assertThat(crossed.status()).as(crossed.body()).isEqualTo(403);
    assertThat(crossed.error()).isEqualTo("csrf_invalid");
    assertThat(meStatus(first)).isEqualTo(200);
    assertThat(meStatus(second)).isEqualTo(200);
  }

  @Test
  void aLoginWithoutTheWebClientIsAsInRound003() throws Exception {
    assertThat(
            register("senza.client.giro004@example.com", GOOD_PASSWORD, "Famiglia Nativa", null)
                .status())
        .isEqualTo(201);

    Response plain = login("senza.client.giro004@example.com", GOOD_PASSWORD);
    assertThat(plain.status()).as(plain.body()).isEqualTo(200);
    assertThat((String) plain.json("$.token")).hasSizeGreaterThanOrEqualTo(32);
    assertThat(setCookies(plain)).as("no Set-Cookie without client web").isEmpty();

    Response other =
        send(
            "POST",
            "/api/auth/login",
            null,
            json(
                "email",
                "senza.client.giro004@example.com",
                "password",
                GOOD_PASSWORD,
                "client",
                "android"));
    assertThat(other.status()).as(other.body()).isEqualTo(200);
    assertThat((String) other.json("$.token")).hasSizeGreaterThanOrEqualTo(32);
    assertThat(setCookies(other)).as("no Set-Cookie with another client").isEmpty();

    // Positive control: the web client of the same account does get the cookies.
    assertThat(
            setCookie(
                webLoginResponse("senza.client.giro004@example.com", GOOD_PASSWORD, Map.of()),
                SESSION_COOKIE))
        .isPresent();
  }

  @Test
  void withAnAuthorizationHeaderTheCookieIsIgnored() throws Exception {
    assertThat(
            register("bearer.vince.giro004@example.com", GOOD_PASSWORD, "Famiglia Header", null)
                .status())
        .isEqualTo(201);
    WebSession web = webLogin("bearer.vince.giro004@example.com", GOOD_PASSWORD);
    assertThat(meStatus(web)).as("positive control: the cookie works alone").isEqualTo(200);

    Response invented =
        send(
            "POST",
            "/api/auth/logout",
            "token-inventato-giro004-000000000000000000000",
            null,
            web.cookies());
    assertThat(invented.status())
        .as("an invented Bearer with a valid cookie, without CSRF")
        .isEqualTo(401);
    assertThat(meStatus(web)).as("the cookie session is untouched").isEqualTo(200);

    Response inventedGet =
        send(
            "GET", "/api/me", "token-inventato-giro004-000000000000000000000", null, web.cookies());
    assertThat(inventedGet.status())
        .as("GET with an invented Bearer and a valid cookie")
        .isEqualTo(401);

    // A valid Bearer of another person wins over the cookie and needs no CSRF.
    String rosa = demoToken("rosa");
    Response me = send("GET", "/api/me", rosa, null, web.cookies());
    assertThat(me.status()).isEqualTo(200);
    assertThat((String) me.json("$.email")).isEqualTo("rosa@example.com");
    Response logout = send("POST", "/api/auth/logout", rosa, null, web.cookies());
    assertThat(logout.status()).as("Bearer logout with a cookie, no CSRF").isEqualTo(204);
    assertThat(meStatus(rosa)).as("the Bearer session is the one closed").isEqualTo(401);
    assertThat(meStatus(web)).as("the cookie session stays open").isEqualTo(200);
  }

  @Test
  void thePublicEndpointsDoNotCheckCsrfEvenWithASessionCookie() throws Exception {
    assertThat(
            register("pubblici.giro004@example.com", GOOD_PASSWORD, "Famiglia Pubblica", null)
                .status())
        .isEqualTo(201);
    WebSession web = webLogin("pubblici.giro004@example.com", GOOD_PASSWORD);

    Response again = webLoginResponse("pubblici.giro004@example.com", GOOD_PASSWORD, web.cookies());
    assertThat(again.status())
        .as("web login with a cookie and no CSRF: " + again.body())
        .isEqualTo(200);
    assertThat(setCookie(again, SESSION_COOKIE)).as("a new session cookie").isPresent();

    Response registered =
        register(
            "pubblici.due.giro004@example.com",
            GOOD_PASSWORD,
            "Persona di prova",
            "Famiglia Pubblica Due",
            null,
            web.cookies());
    assertThat(registered.status())
        .as("register with a cookie and no CSRF: " + registered.body())
        .isEqualTo(201);

    assertThat(send("GET", "/api/health", null, null, web.cookies()).status()).isEqualTo(200);
  }
}
