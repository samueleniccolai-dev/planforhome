package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * Round 004, T3: the isolation of round 003, again with the session cookie instead of the Bearer.
 * Walks every endpoint the server registers: an invented or closed cookie gets 401, never 403, with
 * or without the CSRF header; with the cookie of Luca and the right CSRF header every endpoint with
 * {@code {familyId}} of Famiglia Babbo answers 404, with the same body as a family that does not
 * exist, while Rosa with her cookie is let in (positive control).
 */
class Giro004CookieIsolationAcceptanceTest extends Giro004AcceptanceSupport {

  record Endpoint(String method, String pattern) {

    boolean hasFamilyId() {
      return pattern.contains("{familyId}");
    }

    boolean onlyFamilyId() {
      return hasFamilyId() && pattern.replace("{familyId}", "").indexOf('{') < 0;
    }

    String path(String familyId) {
      String path = pattern.replace("{familyId}", familyId);
      Matcher other = Pattern.compile("\\{[^}]+}").matcher(path);
      return other.replaceAll(UUID.randomUUID().toString());
    }

    @Override
    public String toString() {
      return method + " " + pattern;
    }
  }

  static final Set<String> PUBLIC =
      Set.of("GET /api/health", "POST /api/auth/register", "POST /api/auth/login");

  @Autowired
  @Qualifier("requestMappingHandlerMapping")
  RequestMappingHandlerMapping mapping;

  private List<Endpoint> protectedEndpoints() {
    List<Endpoint> endpoints = new ArrayList<>();
    for (RequestMappingInfo info : mapping.getHandlerMethods().keySet()) {
      Set<RequestMethod> methods = info.getMethodsCondition().getMethods();
      List<String> names =
          methods.isEmpty() ? List.of("GET") : methods.stream().map(Enum::name).toList();
      for (String pattern : info.getPatternValues()) {
        if (!pattern.startsWith("/api/")) {
          continue;
        }
        for (String method : names) {
          Endpoint endpoint = new Endpoint(method, pattern);
          if (!PUBLIC.contains(endpoint.toString())) {
            endpoints.add(endpoint);
          }
        }
      }
    }
    return endpoints;
  }

  @Test
  void theServerRegistersTheRefreshEndpoint() {
    assertThat(protectedEndpoints().stream().map(Endpoint::toString))
        .contains("POST /api/auth/refresh", "POST /api/auth/logout", "PUT /api/me/password");
  }

  @Test
  void everyNonPublicEndpointRefusesAnInventedOrClosedCookieWith401NeverWith403() throws Exception {
    String familyId = familyId(demoToken("rosa"), BABBO);
    String inventedToken = "cookie-inventato-giro004-0000000000000000000";
    WebSession invented = new WebSession(inventedToken, derivedCsrf(inventedToken));
    WebSession closed = demoWebLogin("franco");
    assertThat(send("POST", "/api/auth/logout", null, null, closed.withCsrf()).status())
        .as("logout of Franco's cookie session")
        .isEqualTo(204);

    List<Endpoint> endpoints = protectedEndpoints();
    assertThat(endpoints).isNotEmpty();
    for (Endpoint endpoint : endpoints) {
      String path = endpoint.path(familyId);
      for (Map.Entry<String, WebSession> cookie :
          Map.of("an invented cookie", invented, "a closed cookie", closed).entrySet()) {
        assertThat(withCookies(endpoint.method(), path, cookie.getValue().cookies()).status())
            .as(endpoint + " with " + cookie.getKey() + ", no CSRF")
            .isEqualTo(401);
        assertThat(withCookies(endpoint.method(), path, cookie.getValue().withCsrf()).status())
            .as(endpoint + " with " + cookie.getKey() + " and its CSRF")
            .isEqualTo(401);
      }
    }
  }

  @Test
  void everyFamilyEndpointHidesOtherFamiliesAlsoByCookie() throws Exception {
    WebSession luca = demoWebLogin("luca");
    WebSession rosa = demoWebLogin("rosa");
    String babbo = familyId(demoToken("rosa"), BABBO);
    String nobody = UUID.randomUUID().toString();

    List<Endpoint> familyEndpoints =
        protectedEndpoints().stream().filter(Endpoint::hasFamilyId).toList();
    assertThat(familyEndpoints.stream().map(Endpoint::toString))
        .contains("GET /api/families/{familyId}/members", "POST /api/families/{familyId}/invites");

    for (Endpoint endpoint : familyEndpoints) {
      Response lucaOnBabbo = withCookies(endpoint.method(), endpoint.path(babbo), luca.withCsrf());
      Response lucaOnNobody =
          withCookies(endpoint.method(), endpoint.path(nobody), luca.withCsrf());
      assertThat(lucaOnBabbo.status())
          .as(endpoint + ": Luca's cookie on Famiglia Babbo: " + lucaOnBabbo.body())
          .isEqualTo(404);
      assertThat(lucaOnNobody.status())
          .as(endpoint + ": Luca's cookie on a family that does not exist")
          .isEqualTo(404);
      assertThat(lucaOnBabbo.body())
          .as(endpoint + ": the same answer as for a family that does not exist")
          .isEqualTo(lucaOnNobody.body());

      if (endpoint.onlyFamilyId()) {
        Response rosaOnBabbo =
            withCookies(endpoint.method(), endpoint.path(babbo), rosa.withCsrf());
        assertThat(rosaOnBabbo.status())
            .as(
                endpoint
                    + ": Rosa's cookie on her own family (positive control): "
                    + rosaOnBabbo.body())
            .isNotIn(401, 403, 404)
            .isLessThan(500);
      }
    }
  }
}
