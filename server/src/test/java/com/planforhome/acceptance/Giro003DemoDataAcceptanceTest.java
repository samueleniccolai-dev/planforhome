package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Round 003, T3: with DEMO_PASSWORD set the server seeds the families and people of SPEC Appendix A
 * (display names are the first names). Black box over HTTP.
 */
class Giro003DemoDataAcceptanceTest extends Giro003AcceptanceSupport {

  private Map<String, String> rolesByFamily(String token) throws Exception {
    Response families = get("/api/families", token);
    assertThat(families.status()).as(families.body()).isEqualTo(200);
    List<Map<String, Object>> list = JsonPath.read(families.body(), "$");
    for (Map<String, Object> family : list) {
      assertThat(family.get("timeZone")).isEqualTo("Europe/Rome");
    }
    return list.stream()
        .collect(
            java.util.stream.Collectors.toMap(
                f -> (String) f.get("name"), f -> (String) f.get("role")));
  }

  private List<Map<String, Object>> members(String token, String familyName) throws Exception {
    Response members = get("/api/families/" + familyId(token, familyName) + "/members", token);
    assertThat(members.status()).as(members.body()).isEqualTo(200);
    return JsonPath.read(members.body(), "$");
  }

  private static Map<String, Object> byName(List<Map<String, Object>> members, String name) {
    List<Map<String, Object>> found =
        members.stream().filter(m -> name.equals(m.get("displayName"))).toList();
    assertThat(found).as(name + " in " + members).hasSize(1);
    return found.get(0);
  }

  @Test
  void theNineDemoUsersLogIn() throws Exception {
    for (String user : DEMO_USERS) {
      Response login = login(user + "@example.com", DEMO_PASSWORD);
      assertThat(login.status()).as("login of " + user + ": " + login.body()).isEqualTo(200);
    }
  }

  @Test
  void giuliaMarcoAndLucaHaveTheirFamiliesAndRoles() throws Exception {
    assertThat(rolesByFamily(demoToken("giulia")))
        .containsExactlyInAnyOrderEntriesOf(Map.of(PRINCIPALE, "MANAGER", MAMMA, "MEMBER"));
    assertThat(rolesByFamily(demoToken("marco")))
        .containsExactlyInAnyOrderEntriesOf(Map.of(PRINCIPALE, "MANAGER", BABBO, "MEMBER"));
    assertThat(rolesByFamily(demoToken("luca")))
        .containsExactlyInAnyOrderEntriesOf(Map.of(MAMMA, "MEMBER"));
    assertThat(rolesByFamily(demoToken("rosa")))
        .containsExactlyInAnyOrderEntriesOf(Map.of(BABBO, "MANAGER"));
  }

  @Test
  void familyPrincipaleHasLeoAndSofiaWithoutAccountAndWithTheirReferents() throws Exception {
    List<Map<String, Object>> principale = members(demoToken("giulia"), PRINCIPALE);
    assertThat(principale).hasSize(4);

    Map<String, Object> marco = byName(principale, "Marco");
    Map<String, Object> giulia = byName(principale, "Giulia");
    Map<String, Object> leo = byName(principale, "Leo");
    Map<String, Object> sofia = byName(principale, "Sofia");

    assertThat(marco.get("role")).isEqualTo("MANAGER");
    assertThat(giulia.get("role")).isEqualTo("MANAGER");
    assertThat(marco.get("hasAccount")).isEqualTo(true);
    assertThat(giulia.get("hasAccount")).isEqualTo(true);

    assertThat(leo.get("role")).isEqualTo("MEMBER");
    assertThat(leo.get("hasAccount")).isEqualTo(false);
    assertThat(leo.get("referentPersonId")).isEqualTo(giulia.get("personId"));

    assertThat(sofia.get("role")).isEqualTo("MEMBER");
    assertThat(sofia.get("hasAccount")).isEqualTo(false);
    assertThat(sofia.get("referentPersonId")).isEqualTo(marco.get("personId"));
  }

  @Test
  void familiesMammaAndBabboHaveTheirMembers() throws Exception {
    List<Map<String, Object>> mamma = members(demoToken("anna"), MAMMA);
    assertThat(mamma).hasSize(6);
    for (String name : List.of("Anna", "Pietro")) {
      assertThat(byName(mamma, name).get("role")).as(name).isEqualTo("MANAGER");
    }
    for (String name : List.of("Giulia", "Luca", "Paolo", "Davide")) {
      assertThat(byName(mamma, name).get("role")).as(name).isEqualTo("MEMBER");
    }

    List<Map<String, Object>> babbo = members(demoToken("rosa"), BABBO);
    assertThat(babbo).hasSize(3);
    assertThat(byName(babbo, "Rosa").get("role")).isEqualTo("MANAGER");
    assertThat(byName(babbo, "Franco").get("role")).isEqualTo("MANAGER");
    assertThat(byName(babbo, "Marco").get("role")).isEqualTo("MEMBER");
  }

  @Test
  void giuliaIsTheSamePersonInBothFamilies() throws Exception {
    String token = demoToken("giulia");
    String me = get("/api/me", token).json("$.personId");
    assertThat(byName(members(token, PRINCIPALE), "Giulia").get("personId")).isEqualTo(me);
    assertThat(byName(members(token, MAMMA), "Giulia").get("personId")).isEqualTo(me);
  }
}
