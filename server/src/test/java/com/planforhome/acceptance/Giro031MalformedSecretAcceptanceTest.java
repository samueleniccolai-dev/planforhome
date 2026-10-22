package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Round 031, T10 part 1: a service account that is there but cannot be used (its {@code
 * private_key} is not a key). The server starts anyway, logs once the fixed warning {@code FCM
 * disabled: the service account is not usable} with no detail of the secret and no message of the
 * original exception, and every nudge is {@code push_disabled}, as with an empty secret.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "DEMO_PASSWORD=" + Giro003AcceptanceSupport.DEMO_PASSWORD,
      "planforhome.acceptance.context=giro031-malformed-secret",
      "planforhome.fcm.timeout=PT1S"
    })
@Import(AcceptanceClock.Config.class)
@ExtendWith(OutputCaptureExtension.class)
class Giro031MalformedSecretAcceptanceTest extends Giro031AcceptanceSupport {

  /** Inside the broken private_key: it must never reach the logs. */
  static final String MARKER = "R0-not-a-key-giro031-marker";

  static final String WARNING = "FCM disabled: the service account is not usable";

  static String broken() {
    return Giro031FakeFcm.base64(FCM.serviceAccountJson("MIIBroken" + MARKER + "=="));
  }

  @DynamicPropertySource
  static void fcm(DynamicPropertyRegistry registry) {
    registry.add(
        "planforhome.fcm.service-account-base64", Giro031MalformedSecretAcceptanceTest::broken);
    registry.add("planforhome.fcm.base-url", FCM::baseUrl);
  }

  @Test
  void case1ABrokenKeyGivesPushDisabledAndAFixedWarning(CapturedOutput output) throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.giulia(), "tok-giulia-1");
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.giulia().personId());

    Response nudged = nudgeOk(w.marco().token(), w.principale(), pane);

    assertThat(lastNudgedAt(nudged)).isEqualTo(clock.instant());
    List<Map<String, Object>> rows = reminders(pane);
    assertThat(results(rows)).containsExactly("push_disabled");
    assertThat(FCM.messagesTo(tok)).isEmpty();
    assertThat(FCM.tokenCalls()).isEmpty();

    String logs = output.getAll();
    assertThat(logs).contains(WARNING);
    assertThat(logs).doesNotContain(MARKER);
    assertThat(logs).doesNotContain(broken());
    assertThat(logs).doesNotContain(tok);
  }
}
