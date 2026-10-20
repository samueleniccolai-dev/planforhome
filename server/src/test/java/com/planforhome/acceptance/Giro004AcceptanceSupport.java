package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Round 004, T3: what the acceptance tests of the web session share. Same PostgreSQL as round 003
 * (the container is static in {@link Giro003AcceptanceSupport}); its own application context,
 * because it adds {@link LoginHold}: a test-only wrapper of the server's {@link PasswordEncoder}
 * that, on a login request carrying {@value #HOLD_HEADER}, stops the request right after a
 * successful password check, until the test releases it. Contract for the builder: the login checks
 * the password with the {@code PasswordEncoder} bean.
 *
 * <p>Cookies are read from the {@code Set-Cookie} headers and sent with the {@code Cookie} header,
 * no cookie manager.
 */
@Import({AcceptanceClock.Config.class, Giro004AcceptanceSupport.LoginHold.class})
abstract class Giro004AcceptanceSupport extends Giro003AcceptanceSupport {

  static final String SESSION_COOKIE = "pfh_session";
  static final String CSRF_COOKIE = "pfh_csrf";
  static final String CSRF_HEADER = "X-CSRF-Token";
  static final String HOLD_HEADER = "X-Test-Hold-After-Password-Check";
  static final long THIRTY_DAYS_SECONDS = 2_592_000L;
  static final String OTHER_PASSWORD = "Girasole-Verde-77";

  @Autowired LoginHold hold;

  // ---------------------------------------------------------------- cookies

  /** One {@code Set-Cookie} header: name, value and attributes (keys in lower case). */
  record SetCookie(String name, String value, Map<String, String> attributes) {

    static SetCookie parse(String header) {
      String[] parts = header.split(";");
      String first = parts[0].trim();
      int eq = first.indexOf('=');
      Map<String, String> attributes = new LinkedHashMap<>();
      for (int i = 1; i < parts.length; i++) {
        String part = parts[i].trim();
        if (part.isEmpty()) {
          continue;
        }
        int at = part.indexOf('=');
        String key = (at < 0 ? part : part.substring(0, at)).trim().toLowerCase(Locale.ROOT);
        String value = at < 0 ? "" : part.substring(at + 1).trim();
        attributes.put(key, value);
      }
      return new SetCookie(
          first.substring(0, eq).trim(), first.substring(eq + 1).trim(), attributes);
    }

    boolean has(String attribute) {
      return attributes.containsKey(attribute.toLowerCase(Locale.ROOT));
    }

    String attr(String attribute) {
      return attributes.get(attribute.toLowerCase(Locale.ROOT));
    }
  }

  static List<SetCookie> setCookies(Response response) {
    return response.raw().headers().allValues("Set-Cookie").stream().map(SetCookie::parse).toList();
  }

  static Optional<SetCookie> setCookie(Response response, String name) {
    List<SetCookie> found =
        setCookies(response).stream().filter(c -> c.name().equals(name)).toList();
    assertThat(found).as("at most one Set-Cookie for " + name).hasSizeLessThanOrEqualTo(1);
    return found.stream().findFirst();
  }

  /** A browser that got the two cookies of a web login. */
  record WebSession(String session, String csrf) {

    /** Only the cookies, as a browser sends them on a same-site request. */
    Map<String, String> cookies() {
      return Map.of("Cookie", SESSION_COOKIE + "=" + session + "; " + CSRF_COOKIE + "=" + csrf);
    }

    /** The cookies and the CSRF header with the value of the {@code pfh_csrf} cookie. */
    Map<String, String> withCsrf() {
      return withCsrf(csrf);
    }

    Map<String, String> withCsrf(String headerValue) {
      Map<String, String> headers = new LinkedHashMap<>(cookies());
      headers.put(CSRF_HEADER, headerValue);
      return headers;
    }
  }

  /** The CSRF value of the plan: base64url without padding of SHA-256 of "csrf:" + token. */
  static String derivedCsrf(String sessionToken) throws Exception {
    byte[] digest =
        MessageDigest.getInstance("SHA-256")
            .digest(("csrf:" + sessionToken).getBytes(StandardCharsets.UTF_8));
    return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
  }

  // ---------------------------------------------------------------- web login

  Response webLoginResponse(String email, String password, Map<String, String> headers)
      throws Exception {
    return send(
        "POST",
        "/api/auth/login",
        null,
        json("email", email, "password", password, "client", "web"),
        headers);
  }

  /** Logs in as the web client; fails with an assertion if no session cookie comes back. */
  WebSession webLogin(String email, String password) throws Exception {
    Response response = webLoginResponse(email, password, Map.of());
    assertThat(response.status())
        .as("web login of " + email + ": " + response.body())
        .isEqualTo(200);
    String session =
        setCookie(response, SESSION_COOKIE)
            .map(SetCookie::value)
            .filter(v -> !v.isBlank())
            .orElseThrow(() -> new AssertionError("no " + SESSION_COOKIE + " cookie for " + email));
    String csrf =
        setCookie(response, CSRF_COOKIE)
            .map(SetCookie::value)
            .filter(v -> !v.isBlank())
            .orElseThrow(() -> new AssertionError("no " + CSRF_COOKIE + " cookie for " + email));
    return new WebSession(session, csrf);
  }

  WebSession demoWebLogin(String name) throws Exception {
    return webLogin(name + "@example.com", DEMO_PASSWORD);
  }

  Response withCookies(String method, String path, Map<String, String> headers) throws Exception {
    boolean withBody = method.equals("POST") || method.equals("PUT") || method.equals("PATCH");
    return send(method, path, null, withBody ? "{}" : null, headers);
  }

  int meStatus(WebSession web) throws Exception {
    return send("GET", "/api/me", null, null, web.cookies()).status();
  }

  int meStatus(String token) throws Exception {
    return get("/api/me", token).status();
  }

  @SuppressWarnings("unchecked")
  static Map<String, Object> bodyMap(Response response) {
    return JsonPath.read(response.body(), "$");
  }

  // ---------------------------------------------------------------- login hold (test hook)

  /**
   * Wraps the {@link PasswordEncoder} bean. On a request with {@value #HOLD_HEADER}, after {@code
   * matches} returns {@code true}, it counts down {@link #checked} and waits for {@link #release}.
   * Every other call goes straight to the real encoder.
   */
  @TestConfiguration(proxyBeanMethods = false)
  static class LoginHold {

    final AtomicReference<CountDownLatch> checked = new AtomicReference<>(new CountDownLatch(1));
    final AtomicReference<CountDownLatch> release = new AtomicReference<>(new CountDownLatch(1));

    void reset() {
      checked.set(new CountDownLatch(1));
      release.set(new CountDownLatch(1));
    }

    @Bean
    static BeanPostProcessor holdingPasswordEncoder(ObjectProvider<LoginHold> holder) {
      return new BeanPostProcessor() {
        @Override
        public Object postProcessAfterInitialization(Object bean, String beanName) {
          if (bean instanceof PasswordEncoder real && !(bean instanceof Holding)) {
            return new Holding(real, holder);
          }
          return bean;
        }
      };
    }

    record Holding(PasswordEncoder real, ObjectProvider<LoginHold> holder)
        implements PasswordEncoder {

      @Override
      public String encode(CharSequence rawPassword) {
        return real.encode(rawPassword);
      }

      @Override
      public boolean matches(CharSequence rawPassword, String encodedPassword) {
        boolean matches = real.matches(rawPassword, encodedPassword);
        if (matches && held()) {
          LoginHold hold = holder.getObject();
          hold.checked.get().countDown();
          try {
            hold.release.get().await(30, TimeUnit.SECONDS);
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
          }
        }
        return matches;
      }

      @Override
      public boolean upgradeEncoding(String encodedPassword) {
        return real.upgradeEncoding(encodedPassword);
      }

      private static boolean held() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes a) {
          return a.getRequest().getHeader(HOLD_HEADER) != null;
        }
        return false;
      }
    }
  }
}
