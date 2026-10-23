package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.PathNotFoundException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Round 033, T10 part 3: the FCM message names the Android channel that the app creates. Every
 * message sent to a device carries {@code android.notification.channel_id = "reminders"} (the
 * channel of the app, SPEC 8), next to what round 031 already sends: {@code android.priority =
 * "high"}, {@code data.taskId} and the {@code notification} block (its text: SPEC 8, round 035).
 * Famiglia Mamma of {@link Giro031AcceptanceSupport}: Anna manager nudges a task of Luca, who has a
 * phone.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
      "DEMO_PASSWORD=" + Giro003AcceptanceSupport.DEMO_PASSWORD,
      "planforhome.acceptance.context=giro033-channel",
      "planforhome.fcm.timeout=PT1S"
    })
@Import(AcceptanceClock.Config.class)
class Giro033ChannelAcceptanceTest extends Giro031AcceptanceSupport {

  @DynamicPropertySource
  static void fcm(DynamicPropertyRegistry registry) {
    registry.add("planforhome.fcm.service-account-base64", FCM::serviceAccountBase64);
    registry.add("planforhome.fcm.base-url", FCM::baseUrl);
  }

  /** A field of the JSON body sent to FCM; null when the path is missing. */
  private static Object field(String body, String path) {
    try {
      return JsonPath.read(body, path);
    } catch (PathNotFoundException e) {
      return null;
    }
  }

  @Test
  void c1TheNudgeToLucaNamesTheRemindersChannel() throws Exception {
    Homes w = homes();
    String phone = deviceOk(w.luca(), "fake-fcm-token-luca-033");
    String spesa = taskOk(w.anna().token(), w.mamma(), SPESA_ANNA, w.luca().personId());

    nudgeOk(w.anna().token(), w.mamma(), spesa);

    List<Giro031FakeFcm.Message> sent = FCM.messagesTo(phone);
    assertThat(sent).as("one message to Luca's phone").hasSize(1);
    String body = sent.get(0).body();
    assertThat(field(body, "$.message.android.notification.channel_id"))
        .as("android.notification.channel_id in " + body)
        .isEqualTo("reminders");
    assertThat(field(body, "$.message.android.priority")).as(body).isEqualTo("high");
    assertThat(field(body, "$.message.data.taskId")).as(body).isEqualTo(spesa);
    assertThat(field(body, "$.message.notification.title")).as(body).isEqualTo("Anna ti sollecita");
    assertNoTokenProblems();
  }
}
