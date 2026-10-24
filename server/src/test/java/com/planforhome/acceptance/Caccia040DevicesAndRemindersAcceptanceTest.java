package com.planforhome.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Hunt 040, the two major defects, in the context of round 032 (fake FCM, acceptance clock, job
 * every 0.2 s).
 *
 * <ul>
 *   <li>Round 031: a device keeps the push notifications of a session that is over. After the
 *       logout the device of that session gets nothing more; after a password change the devices of
 *       the other sessions get nothing more. The devices of the sessions still live keep them.
 *   <li>Round 032: a PUT after the instant of a pending row and before the job takes it must not
 *       delete it; the job sends it. «Before the job takes it» is the row held with {@code for
 *       update}: the job skips a row it cannot lock.
 * </ul>
 */
class Caccia040DevicesAndRemindersAcceptanceTest extends Giro032AcceptanceSupport {

  static final String NEW_PASSWORD = "Lanterna-Verde-43";

  @Autowired DataSource dataSource;

  @Test
  void afterTheLogoutTheDeviceOfThatSessionGetsNothingMore() throws Exception {
    Homes w = homes();
    User otherPhone = relogin(w.marco());
    String loggedOut = deviceOk(w.marco(), "tok-marco-out");
    String stillIn = deviceOk(otherPhone, "tok-marco-in");
    String pane = taskOk(w.giulia().token(), w.principale(), PANE, w.marco().personId());

    Response logout = send("POST", "/api/auth/logout", w.marco().token(), null);
    assertThat(logout.status()).as("logout: " + logout.body()).isEqualTo(204);

    assertThat(devices(loggedOut)).as("device of the session logged out").isEmpty();
    assertThat(devices(stillIn)).as("device of the other session").hasSize(1);
    nudgeOk(w.giulia().token(), w.principale(), pane);
    assertThat(FCM.messagesTo(loggedOut)).as("nudge to the device logged out").isEmpty();
    assertThat(FCM.messagesTo(stillIn)).as("nudge to the device still in").hasSize(1);
  }

  @Test
  void aPasswordChangeForgetsTheDevicesOfTheOtherSessions() throws Exception {
    Homes w = homes();
    User otherPhone = relogin(w.marco());
    String kept = deviceOk(w.marco(), "tok-marco-kept");
    String revoked = deviceOk(otherPhone, "tok-marco-revoked");

    Response changed =
        send(
            "PUT",
            "/api/me/password",
            w.marco().token(),
            json("currentPassword", GOOD_PASSWORD, "newPassword", NEW_PASSWORD));
    assertThat(changed.status()).as("password: " + changed.body()).isEqualTo(204);

    assertThat(devices(revoked)).as("device of the revoked session").isEmpty();
    assertThat(devices(kept)).as("device of the session that changed it").hasSize(1);
  }

  @Test
  void aPutAfterTheInstantOfARowAndBeforeTheJobDoesNotLoseIt() throws Exception {
    Homes w = homes();
    String tok = deviceOk(w.marco(), "tok-marco-put");
    Instant due = rome(day, 15, 0);
    Instant before = rome(day, 14, 0);
    String gatto = datetimeTask(w.giulia(), w.principale(), GATTO_VET, due, w.marco().personId());
    assertThat(pending(gatto))
        .containsExactlyInAnyOrder(slot(w.marco(), before), slot(w.marco(), due));
    UUID row =
        jdbc.queryForObject(
            "select id from reminder where task_id = ?::uuid and due_at = ? and result = 'pending'",
            UUID.class,
            gatto,
            OffsetDateTime.ofInstant(before, ZoneOffset.UTC));

    ExecutorService pool = Executors.newSingleThreadExecutor();
    try (Connection held = dataSource.getConnection()) {
      held.setAutoCommit(false);
      try (PreparedStatement lock =
          held.prepareStatement("select id from reminder where id = ? for update")) {
        lock.setObject(1, row);
        lock.executeQuery().close();
      }
      clock.setTo(before.plusSeconds(60));
      User giulia = relogin(w.giulia());

      Future<Response> put =
          pool.submit(
              () ->
                  putDue(
                      giulia,
                      w.principale(),
                      gatto,
                      GATTO_VET + " alle 15",
                      "DATETIME",
                      due.toString()));
      boolean waited = false;
      try {
        put.get(3, TimeUnit.SECONDS);
      } catch (TimeoutException e) {
        waited = true;
      }
      held.commit();
      Response answered = put.get(10, TimeUnit.SECONDS);

      assertThat(answered.status()).as("PUT: " + answered.body()).isEqualTo(200);
      assertThat(waited).as("the PUT waited for the row already due: it was deleting it").isFalse();
    } finally {
      pool.shutdownNow();
    }
    awaitSettled(gatto, w.marco().personId(), before);
    assertThat(FCM.messagesTo(tok)).as("the reminder of 14:00 is sent").hasSize(1);
    assertThat(pending(gatto)).as("«at due» still waits").containsExactly(slot(w.marco(), due));
  }
}
