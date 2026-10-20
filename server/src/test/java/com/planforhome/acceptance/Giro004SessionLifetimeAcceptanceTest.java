package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.Test;

/**
 * Round 004, T3: the session renews only with an explicit {@code POST /api/auth/refresh}, on the
 * server clock; a revoked or expired session is never reopened; a successful password change
 * revokes every other session of the person, also a login that checked the old password while the
 * change was running.
 */
class Giro004SessionLifetimeAcceptanceTest extends Giro004AcceptanceSupport {

  @Test
  void aRefreshAfterTwentyDaysMovesTheExpiryThirtyDaysFromTheServerClock() throws Exception {
    assertThat(
            register("rinnovo.giro004@example.com", GOOD_PASSWORD, "Famiglia Rinnovo", null)
                .status())
        .isEqualTo(201);
    String token = token("rinnovo.giro004@example.com", GOOD_PASSWORD);

    clock.advance(Duration.ofDays(20));
    Response refresh = send("POST", "/api/auth/refresh", token, null);
    assertThat(refresh.status()).as(refresh.body()).isEqualTo(200);
    assertThat(Instant.parse(refresh.json("$.expiresAt")))
        .as("30 days after the server clock, not after the database clock")
        .isEqualTo(clock.instant().plus(Duration.ofDays(30)));
    assertThat(setCookies(refresh)).as("no cookies for a Bearer refresh").isEmpty();

    clock.advance(Duration.ofDays(29));
    assertThat(meStatus(token)).as("49 days after login").isEqualTo(200);

    clock.advance(Duration.ofDays(1).plusMinutes(1));
    assertThat(meStatus(token)).as("50 days and 1 minute after login").isEqualTo(401);
  }

  @Test
  void aCookieRefreshNeedsCsrfAndSendsBackTheSameCookiesForThirtyDays() throws Exception {
    assertThat(
            register("rinnovo.web.giro004@example.com", GOOD_PASSWORD, "Famiglia Rinnovo Web", null)
                .status())
        .isEqualTo(201);
    WebSession web = webLogin("rinnovo.web.giro004@example.com", GOOD_PASSWORD);
    clock.advance(Duration.ofDays(1));

    Response withoutCsrf = send("POST", "/api/auth/refresh", null, null, web.cookies());
    assertThat(withoutCsrf.status()).as("refresh by cookie without CSRF").isEqualTo(403);
    assertThat(withoutCsrf.error()).isEqualTo("csrf_invalid");

    Response refresh = send("POST", "/api/auth/refresh", null, null, web.withCsrf());
    assertThat(refresh.status()).as(refresh.body()).isEqualTo(200);
    assertThat(Instant.parse(refresh.json("$.expiresAt")))
        .isEqualTo(clock.instant().plus(Duration.ofDays(30)));

    SetCookie session =
        setCookie(refresh, SESSION_COOKIE).orElseThrow(() -> new AssertionError("no pfh_session"));
    assertThat(session.value()).as("the token does not change").isEqualTo(web.session());
    assertThat(session.attr("Max-Age")).isEqualTo("2592000");
    assertThat(session.attr("Path")).isEqualTo("/api");
    assertThat(session.has("HttpOnly")).isTrue();
    SetCookie csrf =
        setCookie(refresh, CSRF_COOKIE).orElseThrow(() -> new AssertionError("no pfh_csrf"));
    assertThat(csrf.value()).isEqualTo(web.csrf());
    assertThat(csrf.attr("Max-Age")).isEqualTo("2592000");
    assertThat(csrf.attr("Path")).isEqualTo("/");

    clock.advance(Duration.ofDays(29).plusHours(23));
    assertThat(meStatus(web))
        .as("30 days after login, 1 hour before the new expiry")
        .isEqualTo(200);
  }

  @Test
  void aRevokedOrExpiredSessionIsNotReopenedByARefresh() throws Exception {
    assertThat(
            register("rinnovo.chiuso.giro004@example.com", GOOD_PASSWORD, "Famiglia Chiusa", null)
                .status())
        .isEqualTo(201);
    String revoked = token("rinnovo.chiuso.giro004@example.com", GOOD_PASSWORD);
    String expiring = token("rinnovo.chiuso.giro004@example.com", GOOD_PASSWORD);
    String alive = token("rinnovo.chiuso.giro004@example.com", GOOD_PASSWORD);

    assertThat(send("POST", "/api/auth/logout", revoked, null).status()).isEqualTo(204);
    assertThat(send("POST", "/api/auth/refresh", revoked, null).status())
        .as("refresh of a revoked session")
        .isEqualTo(401);
    assertThat(meStatus(revoked)).as("still closed").isEqualTo(401);

    clock.advance(Duration.ofDays(29));
    assertThat(send("POST", "/api/auth/refresh", alive, null).status())
        .as("positive control")
        .isEqualTo(200);
    clock.advance(Duration.ofDays(1).plusMinutes(1));
    assertThat(send("POST", "/api/auth/refresh", expiring, null).status())
        .as("refresh of an expired session")
        .isEqualTo(401);
    assertThat(meStatus(expiring)).as("still expired").isEqualTo(401);
    assertThat(meStatus(alive)).as("the refreshed one lives on").isEqualTo(200);
  }

  @Test
  void aPasswordChangeRevokesTheOtherSessionsOfThePersonOnly() throws Exception {
    assertThat(
            register("revoca.giro004@example.com", GOOD_PASSWORD, "Famiglia Revoca", null).status())
        .isEqualTo(201);
    assertThat(
            register("revoca.altra.giro004@example.com", GOOD_PASSWORD, "Famiglia Altra", null)
                .status())
        .isEqualTo(201);
    String a = token("revoca.giro004@example.com", GOOD_PASSWORD);
    String b = token("revoca.giro004@example.com", GOOD_PASSWORD);
    WebSession c = webLogin("revoca.giro004@example.com", GOOD_PASSWORD);
    String otherPerson = token("revoca.altra.giro004@example.com", GOOD_PASSWORD);

    Response changed =
        send(
            "PUT",
            "/api/me/password",
            a,
            json("currentPassword", GOOD_PASSWORD, "newPassword", OTHER_PASSWORD));
    assertThat(changed.status()).as(changed.body()).isEqualTo(204);

    assertThat(meStatus(a)).as("A, the session that changed the password").isEqualTo(200);
    assertThat(meStatus(b)).as("B, another Bearer session").isEqualTo(401);
    assertThat(meStatus(c)).as("C, a cookie session").isEqualTo(401);
    assertThat(meStatus(otherPerson)).as("a session of another person").isEqualTo(200);
  }

  @Test
  void aPasswordChangeByCookieKeepsTheCookieSessionAndRevokesTheBearerOnes() throws Exception {
    assertThat(
            register("revoca.web.giro004@example.com", GOOD_PASSWORD, "Famiglia Revoca Web", null)
                .status())
        .isEqualTo(201);
    String bearer = token("revoca.web.giro004@example.com", GOOD_PASSWORD);
    WebSession web = webLogin("revoca.web.giro004@example.com", GOOD_PASSWORD);

    Response changed =
        send(
            "PUT",
            "/api/me/password",
            null,
            json("currentPassword", GOOD_PASSWORD, "newPassword", OTHER_PASSWORD),
            web.withCsrf());
    assertThat(changed.status()).as(changed.body()).isEqualTo(204);
    assertThat(meStatus(web)).as("the cookie session that changed the password").isEqualTo(200);
    assertThat(meStatus(bearer)).as("the Bearer session").isEqualTo(401);
  }

  /**
   * A login checks the old password, then stops (test hook) before creating its session; the
   * password change runs to the end; then the login goes on. Whatever the login answers, no session
   * born from the old password survives.
   */
  @Test
  void aLoginWithTheOldPasswordDuringTheChangeLeavesNoLiveSession() throws Exception {
    assertThat(
            register("revoca.corsa.giro004@example.com", GOOD_PASSWORD, "Famiglia Corsa", null)
                .status())
        .isEqualTo(201);
    String a = token("revoca.corsa.giro004@example.com", GOOD_PASSWORD);
    hold.reset();

    CompletableFuture<Response> racingLogin =
        CompletableFuture.supplyAsync(
            () -> {
              try {
                return send(
                    "POST",
                    "/api/auth/login",
                    null,
                    json("email", "revoca.corsa.giro004@example.com", "password", GOOD_PASSWORD),
                    Map.of(HOLD_HEADER, "1"));
              } catch (Exception e) {
                throw new IllegalStateException(e);
              }
            });
    try {
      assertThat(hold.checked.get().await(30, TimeUnit.SECONDS))
          .as("the login reached the point after the password check")
          .isTrue();

      CompletableFuture<Response> change =
          CompletableFuture.supplyAsync(
              () -> {
                try {
                  return send(
                      "PUT",
                      "/api/me/password",
                      a,
                      json("currentPassword", GOOD_PASSWORD, "newPassword", OTHER_PASSWORD));
                } catch (Exception e) {
                  throw new IllegalStateException(e);
                }
              });
      try {
        // If the change waits for a lock held by the held login, let the login go after 5 s.
        change.get(5, TimeUnit.SECONDS);
      } catch (TimeoutException waitingForTheLogin) {
        // fine: released below, then the change finishes
      }
      hold.release.get().countDown();

      Response changed = change.get(30, TimeUnit.SECONDS);
      assertThat(changed.status()).as(changed.body()).isEqualTo(204);
    } finally {
      hold.release.get().countDown();
    }

    Response login = racingLogin.get(30, TimeUnit.SECONDS);
    assertThat(login.status()).as(login.body()).isIn(200, 401);
    if (login.status() == 200) {
      String born = login.json("$.token");
      assertThat(meStatus(born))
          .as("a session created from the old password after the change")
          .isEqualTo(401);
    }
    assertThat(meStatus(a)).as("the session that changed the password").isEqualTo(200);

    clock.advance(Duration.ofMinutes(16));
    assertThat(login("revoca.corsa.giro004@example.com", GOOD_PASSWORD).status())
        .as("old password")
        .isEqualTo(401);
  }
}
