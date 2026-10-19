package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
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
 * Round 003, T3: parametric isolation between families. Walks every endpoint the server registers
 * (not a hand-written list, so endpoints of later rounds are covered too): without a valid token
 * every non-public one answers 401; every one with {@code {familyId}} answers 404 to a person
 * outside the family, with the same body as for a family that does not exist, while the same
 * request by a person of the family is not a 404 (positive control). Demo data of Appendix A: Luca
 * is only in Famiglia Mamma, Rosa only in Famiglia Babbo.
 */
class Giro003IsolationAcceptanceTest extends Giro003AcceptanceSupport {

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

  static final List<String> CONTRACT =
      List.of(
          "POST /api/auth/register",
          "POST /api/auth/login",
          "POST /api/auth/logout",
          "GET /api/me",
          "PUT /api/me/password",
          "GET /api/families",
          "GET /api/families/{familyId}/members",
          "POST /api/families/{familyId}/invites");

  @Autowired
  @Qualifier("requestMappingHandlerMapping")
  RequestMappingHandlerMapping mapping;

  private List<Endpoint> endpoints() {
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
          endpoints.add(new Endpoint(method, pattern));
        }
      }
    }
    return endpoints;
  }

  private List<Endpoint> protectedEndpoints() {
    return endpoints().stream().filter(e -> !PUBLIC.contains(e.toString())).toList();
  }

  private Response call(Endpoint endpoint, String path, String token) throws Exception {
    boolean withBody =
        endpoint.method().equals("POST")
            || endpoint.method().equals("PUT")
            || endpoint.method().equals("PATCH");
    return send(endpoint.method(), path, token, withBody ? "{}" : null);
  }

  @Test
  void theServerRegistersAtLeastTheEndpointsOfTheContract() {
    List<String> registered = endpoints().stream().map(Endpoint::toString).toList();
    assertThat(registered).containsAll(CONTRACT);
  }

  @Test
  void everyNonPublicEndpointRefusesAMissingInventedOrLoggedOutToken() throws Exception {
    String familyId = familyId(demoToken("rosa"), BABBO);
    String loggedOut = demoToken("franco");
    assertThat(send("POST", "/api/auth/logout", loggedOut, null).status()).isEqualTo(204);

    List<Endpoint> endpoints = protectedEndpoints();
    assertThat(endpoints).as("protected endpoints").isNotEmpty();
    for (Endpoint endpoint : endpoints) {
      String path = endpoint.path(familyId);
      assertThat(call(endpoint, path, null).status())
          .as(endpoint + " without token")
          .isEqualTo(401);
      assertThat(call(endpoint, path, "token-inventato-00000000000000000000000000").status())
          .as(endpoint + " with an invented token")
          .isEqualTo(401);
      assertThat(call(endpoint, path, loggedOut).status())
          .as(endpoint + " with a logged-out token")
          .isEqualTo(401);
    }
  }

  @Test
  void everyFamilyEndpointHidesOtherFamiliesAndOpensToItsOwnPeople() throws Exception {
    String luca = demoToken("luca");
    String rosa = demoToken("rosa");
    String mamma = familyId(luca, MAMMA);
    String babbo = familyId(rosa, BABBO);
    String nobody = UUID.randomUUID().toString();

    List<Endpoint> familyEndpoints =
        protectedEndpoints().stream().filter(Endpoint::hasFamilyId).toList();
    assertThat(familyEndpoints.stream().map(Endpoint::toString))
        .as("family endpoints")
        .contains("GET /api/families/{familyId}/members", "POST /api/families/{familyId}/invites");

    for (Endpoint endpoint : familyEndpoints) {
      Response lucaOnBabbo = call(endpoint, endpoint.path(babbo), luca);
      Response rosaOnMamma = call(endpoint, endpoint.path(mamma), rosa);
      Response rosaOnNobody = call(endpoint, endpoint.path(nobody), rosa);
      assertThat(lucaOnBabbo.status()).as(endpoint + ": Luca on Famiglia Babbo").isEqualTo(404);
      assertThat(rosaOnMamma.status()).as(endpoint + ": Rosa on Famiglia Mamma").isEqualTo(404);
      assertThat(rosaOnNobody.status())
          .as(endpoint + ": a family that does not exist")
          .isEqualTo(404);
      assertThat(lucaOnBabbo.body())
          .as(endpoint + ": the same answer as for a family that does not exist")
          .isEqualTo(rosaOnNobody.body());

      if (endpoint.onlyFamilyId()) {
        Response rosaOnBabbo = call(endpoint, endpoint.path(babbo), rosa);
        Response lucaOnMamma = call(endpoint, endpoint.path(mamma), luca);
        assertThat(rosaOnBabbo.status())
            .as(endpoint + ": Rosa on her own family (positive control)")
            .isNotEqualTo(404)
            .isLessThan(500);
        assertThat(lucaOnMamma.status())
            .as(endpoint + ": Luca on his own family (positive control)")
            .isNotEqualTo(404)
            .isLessThan(500);
      }
    }
  }

  @Test
  void familiesListsOnlyTheFamiliesOfTheCaller() throws Exception {
    Response families = get("/api/families", demoToken("luca"));
    assertThat(families.status()).isEqualTo(200);
    assertThat((List<?>) families.json("$")).hasSize(1);
    assertThat((String) families.json("$[0].name")).isEqualTo(MAMMA);
  }

  @Test
  void aMemberCannotCreateAnInviteAndAManagerCan() throws Exception {
    String luca = demoToken("luca");
    String mamma = familyId(luca, MAMMA);

    Response byMember = send("POST", "/api/families/" + mamma + "/invites", luca, null);
    assertThat(byMember.status()).as(byMember.body()).isEqualTo(403);

    Response byManager =
        send("POST", "/api/families/" + mamma + "/invites", demoToken("anna"), null);
    assertThat(byManager.status()).as(byManager.body()).isEqualTo(201);
  }
}
