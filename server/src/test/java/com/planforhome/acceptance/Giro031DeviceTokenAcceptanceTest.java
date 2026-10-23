package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Round 031, T10 part 1: {@code POST /api/me/devices {token, platform}} → 204. Table {@code device}
 * of SPEC 6 ({@code id, person_id, fcm_token, platform, last_seen_at}), {@code fcm_token} unique:
 * the same token again is the same row ({@code last_seen_at} moves); the same token from another
 * person passes to her (a phone that changes user). Only {@code ANDROID} in R0. Empty token, more
 * than 4096 characters, or another platform → 400 {@code invalid_request}; no session → 401.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "DEMO_PASSWORD=" + Giro003AcceptanceSupport.DEMO_PASSWORD,
      "planforhome.acceptance.context=giro031-devices",
      "planforhome.fcm.timeout=PT1S"
    })
@Import(AcceptanceClock.Config.class)
class Giro031DeviceTokenAcceptanceTest extends Giro031AcceptanceSupport {

  @DynamicPropertySource
  static void fcm(DynamicPropertyRegistry registry) {
    registry.add("planforhome.fcm.service-account-base64", FCM::serviceAccountBase64);
    registry.add("planforhome.fcm.base-url", FCM::baseUrl);
  }

  @Test
  void case1RegisteringTwiceKeepsOneRowAndMovesLastSeen() throws Exception {
    Homes w = homes();
    String tok = deviceToken("tok-giulia-1");
    Instant first = clock.instant();

    Response registered = registerDevice(w.giulia().token(), tok, "ANDROID");
    assertThat(registered.status()).as(registered.body()).isEqualTo(204);
    List<Map<String, Object>> rows = devices(tok);
    assertThat(rows).hasSize(1);
    assertThat(rows.get(0))
        .containsEntry("person_id", w.giulia().personId())
        .containsEntry("platform", "ANDROID");
    assertThat(instant(rows.get(0).get("last_seen_at"))).isEqualTo(first);

    clock.advance(Duration.ofMinutes(1));
    Response again = registerDevice(w.giulia().token(), tok, "ANDROID");
    assertThat(again.status()).as(again.body()).isEqualTo(204);
    rows = devices(tok);
    assertThat(rows).hasSize(1);
    assertThat(instant(rows.get(0).get("last_seen_at"))).isEqualTo(clock.instant());
  }

  @Test
  void case2TheSameTokenFromPaoloPassesToPaolo() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.giulia(), "tok-giulia-1");

    Response taken = registerDevice(w.paolo().token(), tok, "ANDROID");
    assertThat(taken.status()).as(taken.body()).isEqualTo(204);
    List<Map<String, Object>> rows = devices(tok);
    assertThat(rows).hasSize(1);
    assertThat(rows.get(0)).containsEntry("person_id", w.paolo().personId());

    // Giulia has no device any more: a nudge for her sends nothing to Paolo's phone.
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());
    nudgeOk(w.marco().token(), w.principale(), pane);
    assertThat(FCM.messagesTo(tok)).isEmpty();
    assertThat(results(reminders(pane))).containsExactly("no_device");
  }

  @Test
  void case3InvalidTokensAndPlatformsAre400() throws Exception {
    Homes w = homes();
    String token = w.giulia().token();

    assertError(registerDevice(token, "", "ANDROID"), 400, "invalid_request");
    assertError(registerDevice(token, "   ", "ANDROID"), 400, "invalid_request");
    assertError(registerDevice(token, "x".repeat(4097), "ANDROID"), 400, "invalid_request");
    assertError(registerDevice(token, deviceToken("tok-giulia-1"), "IOS"), 400, "invalid_request");
    assertError(
        send("POST", "/api/me/devices", token, json("platform", "ANDROID")),
        400,
        "invalid_request");

    String prefix = deviceToken("tok-giulia-1") + "-";
    String longest = prefix + "y".repeat(4096 - prefix.length());
    assertThat(longest).hasSize(4096);
    Response ok = registerDevice(token, longest, "ANDROID");
    assertThat(ok.status()).as("4096 characters are allowed: " + ok.body()).isEqualTo(204);
    assertThat(devices(longest)).hasSize(1);
  }

  @Test
  void case4WithoutASessionIs401() throws Exception {
    String tok = deviceToken("tok-giulia-1");
    Response anonymous = registerDevice(null, tok, "ANDROID");
    assertThat(anonymous.status()).as(anonymous.body()).isEqualTo(401);
    assertThat(devices(tok)).isEmpty();
  }
}
