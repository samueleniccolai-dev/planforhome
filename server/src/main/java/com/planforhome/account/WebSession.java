package com.planforhome.account;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Base64;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;

/** Cookies of the web client and the CSRF value tied to a session token. */
public final class WebSession {

  public static final String SESSION_COOKIE = "pfh_session";
  public static final String CSRF_COOKIE = "pfh_csrf";
  public static final String CSRF_HEADER = "X-CSRF-Token";

  /** Request attribute: the session token when the request was authenticated by the cookie. */
  public static final String TOKEN_ATTRIBUTE = "pfh.cookieSessionToken";

  private WebSession() {}

  /** Base64url of SHA-256 of {@code "csrf:" + token}: bound to the session, no column needed. */
  public static String csrf(String token) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256")
              .digest(("csrf:" + token).getBytes(StandardCharsets.UTF_8));
      return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  public static boolean csrfMatches(String token, String header) {
    return header != null
        && MessageDigest.isEqual(
            csrf(token).getBytes(StandardCharsets.UTF_8), header.getBytes(StandardCharsets.UTF_8));
  }

  /** The two {@code Set-Cookie} headers of a live session. */
  public static HttpHeaders cookies(String token, Duration maxAge) {
    HttpHeaders headers = new HttpHeaders();
    headers.add(
        HttpHeaders.SET_COOKIE,
        ResponseCookie.from(SESSION_COOKIE, token)
            .httpOnly(true)
            .secure(true)
            .sameSite("Lax")
            .path("/api")
            .maxAge(maxAge)
            .build()
            .toString());
    headers.add(
        HttpHeaders.SET_COOKIE,
        ResponseCookie.from(CSRF_COOKIE, csrf(token))
            .secure(true)
            .sameSite("Lax")
            .path("/")
            .maxAge(maxAge)
            .build()
            .toString());
    return headers;
  }

  /** The two {@code Set-Cookie} headers that remove the cookies, with the paths they had. */
  public static HttpHeaders cleared() {
    HttpHeaders headers = new HttpHeaders();
    headers.add(
        HttpHeaders.SET_COOKIE,
        ResponseCookie.from(SESSION_COOKIE, "")
            .httpOnly(true)
            .secure(true)
            .sameSite("Lax")
            .path("/api")
            .maxAge(0)
            .build()
            .toString());
    headers.add(
        HttpHeaders.SET_COOKIE,
        ResponseCookie.from(CSRF_COOKIE, "")
            .secure(true)
            .sameSite("Lax")
            .path("/")
            .maxAge(0)
            .build()
            .toString());
    return headers;
  }
}
