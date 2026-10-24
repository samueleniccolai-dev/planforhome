package com.planforhome.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PushServiceReminderTest {

  @Test
  void aRowAlreadySettledIsNotOverwrittenWhenALaterTokenFails() {
    List<String> settled = new ArrayList<>();
    PushRepository repo = mock(PushRepository.class);
    when(repo.tokensOf(any())).thenReturn(List.of("t1", "t2"));
    doAnswer(
            i -> {
              settled.add(i.getArgument(2));
              return null;
            })
        .when(repo)
        .settleReminder(any(), any(), any());
    doThrow(new IllegalStateException("db down"))
        .when(repo)
        .saveAutoReminder(any(), any(), any(), any(), any(), any());
    FcmClient fcm = mock(FcmClient.class);
    when(fcm.enabled()).thenReturn(true);
    when(fcm.send(any(), any(), any(), any())).thenReturn(new FcmClient.Outcome("SENT", false));
    PushService service =
        new PushService(
            repo, fcm, Clock.fixed(Instant.parse("2026-03-29T01:00:00Z"), ZoneOffset.UTC));
    assertThatCode(
            () ->
                service.sendReminder(
                    UUID.randomUUID(),
                    UUID.randomUUID(),
                    UUID.randomUUID(),
                    Instant.parse("2026-03-29T01:00:00Z"),
                    new NotificationText.Text("t", "b")))
        .doesNotThrowAnyException();
    assertThat(settled).containsExactly("SENT");
    verify(repo, times(1)).settleReminder(any(), any(), any());
  }
}
