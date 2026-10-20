package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Round 006, T4: what the acceptance tests of families, people and roles share. No configuration of
 * its own, so the application context (and the demo data of Appendix A) is the one of round 003.
 * The demo families are only read; every test registers its own people, each registration from an
 * IP of its own (the limit is 10 registrations per IP per hour).
 */
abstract class Giro006AcceptanceSupport extends Giro003AcceptanceSupport {

  static final String FAGGIO = "Famiglia Faggio";
  static final String OLMO = "Famiglia Olmo";
  static final String TIGLIO = "Famiglia Tiglio";

  private static final AtomicInteger IPS = new AtomicInteger();

  /** A fresh client IP in 198.18.0.0/15 (benchmarking range, never a real client). */
  static String freshIp() {
    int n = IPS.incrementAndGet();
    return "198.18." + (n / 250) % 250 + "." + (n % 250 + 1);
  }

  static Map<String, String> fromIp(String ip) {
    return Map.of("X-Forwarded-For", ip);
  }

  /** A registered and logged-in person; {@code familyId} is the family of the registration. */
  record User(String name, String email, String personId, String token, String familyId) {}

  static String email(String name) {
    return "g006-" + name.toLowerCase() + "-" + UUID.randomUUID() + "@example.com";
  }

  /** Registers a person with a new family (she is its manager) and logs her in. */
  User newManager(String name, String familyName) throws Exception {
    String email = email(name);
    Response created = register(email, GOOD_PASSWORD, name, familyName, null, fromIp(freshIp()));
    assertThat(created.status())
        .as("registration of " + name + ": " + created.body())
        .isEqualTo(201);
    return new User(
        name,
        email,
        created.json("$.personId"),
        token(email, GOOD_PASSWORD),
        created.json("$.families[0].id"));
  }

  /** Registers a person with an invite code (one family only) and logs him in. */
  User newMemberWithCode(String name, String code) throws Exception {
    String email = email(name);
    Response created = register(email, GOOD_PASSWORD, name, null, code, fromIp(freshIp()));
    assertThat(created.status())
        .as("registration of " + name + ": " + created.body())
        .isEqualTo(201);
    return new User(
        name,
        email,
        created.json("$.personId"),
        token(email, GOOD_PASSWORD),
        created.json("$.families[0].id"));
  }

  // ---------------------------------------------------------------- the endpoints of the round

  Response createFamily(String token, String id, String name, String timeZone) throws Exception {
    Map<String, Object> body = new LinkedHashMap<>();
    if (id != null) {
      body.put("id", id);
    }
    if (name != null) {
      body.put("name", name);
    }
    if (timeZone != null) {
      body.put("timeZone", timeZone);
    }
    return send("POST", "/api/families", token, json(flat(body)));
  }

  Response join(String token, String code) throws Exception {
    return join(token, code, freshIp());
  }

  Response join(String token, String code, String ip) throws Exception {
    return send("POST", "/api/families/join", token, json("code", code), fromIp(ip));
  }

  /** Joins with a code and fails with an assertion if the server refuses. */
  void joinOk(User user, String code) throws Exception {
    Response joined = join(user.token(), code);
    assertThat(joined.status()).as(user.name() + " joins: " + joined.body()).isEqualTo(200);
  }

  Response addResource(
      String token, String familyId, String id, String displayName, String referentPersonId)
      throws Exception {
    Map<String, Object> body = new LinkedHashMap<>();
    if (id != null) {
      body.put("id", id);
    }
    body.put("displayName", displayName);
    body.put("referentPersonId", referentPersonId);
    return send("POST", "/api/families/" + familyId + "/resources", token, json(flat(body)));
  }

  /** Adds a resource with a client id and returns that id. */
  String resourceOk(String token, String familyId, String displayName, String referentPersonId)
      throws Exception {
    String id = UUID.randomUUID().toString();
    Response added = addResource(token, familyId, id, displayName, referentPersonId);
    assertThat(added.status()).as("resource " + displayName + ": " + added.body()).isEqualTo(201);
    return id;
  }

  Response setRole(String token, String familyId, String personId, String role) throws Exception {
    return send(
        "PUT",
        "/api/families/" + familyId + "/members/" + personId + "/role",
        token,
        role == null ? "{}" : json("role", role));
  }

  void setRoleOk(String token, String familyId, String personId, String role) throws Exception {
    Response changed = setRole(token, familyId, personId, role);
    assertThat(changed.status()).as("role " + role + ": " + changed.body()).isEqualTo(200);
  }

  Response setReferent(String token, String familyId, String personId, String referentPersonId)
      throws Exception {
    return send(
        "PUT",
        "/api/families/" + familyId + "/members/" + personId + "/referent",
        token,
        json("referentPersonId", referentPersonId));
  }

  Response removeMember(String token, String familyId, String personId) throws Exception {
    return send("DELETE", "/api/families/" + familyId + "/members/" + personId, token, null);
  }

  // ---------------------------------------------------------------- reads

  /** The members of a family, as seen by one of its members. */
  List<Map<String, Object>> members(String token, String familyId) throws Exception {
    Response members = get("/api/families/" + familyId + "/members", token);
    assertThat(members.status()).as("members: " + members.body()).isEqualTo(200);
    return JsonPath.read(members.body(), "$");
  }

  List<String> memberIds(String token, String familyId) throws Exception {
    return members(token, familyId).stream().map(m -> (String) m.get("personId")).toList();
  }

  Map<String, Object> member(String token, String familyId, String personId) throws Exception {
    return members(token, familyId).stream()
        .filter(m -> personId.equals(m.get("personId")))
        .findFirst()
        .orElseThrow(() -> new AssertionError(personId + " is not a member of " + familyId));
  }

  List<String> familyIds(String token) throws Exception {
    Response families = get("/api/families", token);
    assertThat(families.status()).as("families: " + families.body()).isEqualTo(200);
    return JsonPath.read(families.body(), "$[*].id");
  }

  String personIdOf(String token) throws Exception {
    Response me = get("/api/me", token);
    assertThat(me.status()).as("me: " + me.body()).isEqualTo(200);
    return me.json("$.personId");
  }

  /** The session cookie of a web login, as the header a browser would send back. */
  Map<String, String> webCookies(String email) throws Exception {
    Response response =
        send(
            "POST",
            "/api/auth/login",
            null,
            json("email", email, "password", GOOD_PASSWORD, "client", "web"));
    assertThat(response.status()).as("web login: " + response.body()).isEqualTo(200);
    List<String> cookies = new ArrayList<>();
    for (String header : response.raw().headers().allValues("Set-Cookie")) {
      cookies.add(header.split(";", 2)[0].trim());
    }
    assertThat(cookies).as("cookies of the web login").anyMatch(c -> c.startsWith("pfh_session="));
    return Map.of("Cookie", String.join("; ", cookies));
  }

  // ---------------------------------------------------------------- Faggio

  /** Famiglia Faggio of the plan: Irene manager; Bruno, Carla and Ettore members. */
  record Faggio(String id, User irene, User bruno, User carla, User ettore) {}

  Faggio faggio() throws Exception {
    User irene = newManager("Irene", FAGGIO);
    User bruno = newManager("Bruno", OLMO);
    User carla = newManager("Carla", TIGLIO);
    joinOk(bruno, invite(irene.token(), irene.familyId()));
    joinOk(carla, invite(irene.token(), irene.familyId()));
    User ettore = newMemberWithCode("Ettore", invite(irene.token(), irene.familyId()));
    return new Faggio(irene.familyId(), irene, bruno, carla, ettore);
  }

  // ---------------------------------------------------------------- concurrency

  /** Runs the calls at the same instant (as far as a latch allows) and returns their answers. */
  @SafeVarargs
  final List<Response> together(Callable<Response>... calls) throws Exception {
    ExecutorService pool = Executors.newFixedThreadPool(calls.length);
    try {
      CountDownLatch ready = new CountDownLatch(calls.length);
      CountDownLatch go = new CountDownLatch(1);
      List<Future<Response>> futures = new ArrayList<>();
      for (Callable<Response> call : calls) {
        futures.add(
            pool.submit(
                () -> {
                  ready.countDown();
                  go.await();
                  return call.call();
                }));
      }
      assertThat(ready.await(30, TimeUnit.SECONDS)).isTrue();
      go.countDown();
      List<Response> responses = new ArrayList<>();
      for (Future<Response> future : futures) {
        responses.add(future.get(60, TimeUnit.SECONDS));
      }
      return responses;
    } finally {
      pool.shutdownNow();
    }
  }

  static List<Integer> statuses(List<Response> responses) {
    return responses.stream().map(Response::status).toList();
  }

  private static Object[] flat(Map<String, Object> body) {
    Object[] flat = new Object[body.size() * 2];
    int i = 0;
    for (Map.Entry<String, Object> entry : body.entrySet()) {
      flat[i++] = entry.getKey();
      flat[i++] = entry.getValue();
    }
    return flat;
  }
}
