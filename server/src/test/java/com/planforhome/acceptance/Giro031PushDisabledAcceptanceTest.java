package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Round 031, T10 part 1: push off. With {@code planforhome.fcm.service-account-base64} empty the
 * server starts, the nudge is a nudge (200, {@code NUDGED}, {@code lastNudgedAt}) and the reminder
 * row says {@code push_disabled}, with {@code sent_at} null: nothing goes to the fake FCM, not even
 * to its {@code token_uri}.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "DEMO_PASSWORD=" + Giro003AcceptanceSupport.DEMO_PASSWORD,
      "planforhome.acceptance.context=giro031-push-disabled",
      "planforhome.fcm.service-account-base64=",
      "planforhome.fcm.timeout=PT1S"
    })
@Import(AcceptanceClock.Config.class)
class Giro031PushDisabledAcceptanceTest extends Giro031AcceptanceSupport {

  @DynamicPropertySource
  static void fcm(DynamicPropertyRegistry registry) {
    registry.add("planforhome.fcm.base-url", FCM::baseUrl);
  }

  @Test
  void case1AnEmptyServiceAccountGivesPushDisabled() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.giulia(), "tok-giulia-1");
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());

    Response nudged = nudgeOk(w.marco().token(), w.principale(), pane);

    assertThat(lastNudgedAt(nudged)).isEqualTo(clock.instant());
    assertThat(nudgedEvents(pane)).isEqualTo(1);
    List<Map<String, Object>> rows = reminders(pane);
    assertThat(results(rows)).containsExactly("push_disabled");
    assertThat(rows.get(0)).containsEntry("kind", "NUDGE");
    assertThat(rows.get(0).get("sent_at")).isNull();
    assertThat(FCM.messagesTo(tok)).isEmpty();
    assertThat(FCM.tokenCalls()).isEmpty();
    assertThat(devices(tok)).as("the token stays").hasSize(1);
  }
}
