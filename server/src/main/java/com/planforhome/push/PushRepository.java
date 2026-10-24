package com.planforhome.push;

import static com.planforhome.common.Time.db;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class PushRepository {

  private final JdbcClient jdbc;

  public PushRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  /** One row per token; the same token from another person or session passes to her. */
  public void saveDevice(
      UUID id, UUID personId, UUID sessionId, String token, String platform, Instant now) {
    jdbc.sql(
            "insert into device (id, person_id, session_id, fcm_token, platform, last_seen_at)"
                + " values (?, ?, ?, ?, ?, ?) on conflict (fcm_token) do update set"
                + " person_id = excluded.person_id, session_id = excluded.session_id,"
                + " platform = excluded.platform, last_seen_at = excluded.last_seen_at")
        .params(id, personId, sessionId, token, platform, db(now))
        .update();
  }

  public void deleteDevicesOfSession(UUID sessionId) {
    jdbc.sql("delete from device where session_id = ?").params(sessionId).update();
  }

  /** The devices of the other sessions of a person; rows without a session stay. */
  public void deleteDevicesOfOtherSessions(UUID personId, UUID keepSessionId) {
    jdbc.sql("delete from device where person_id = ? and session_id <> ?")
        .params(personId, keepSessionId)
        .update();
  }

  /**
   * The tokens of the devices whose session is not revoked (hunt 040): a row without a session
   * (from before V8) or registered while its session was being revoked gets nothing.
   */
  public List<String> tokensOf(UUID personId) {
    return jdbc.sql(
            "select d.fcm_token from device d join auth_session s on s.id = d.session_id"
                + " where d.person_id = ? and s.revoked_at is null"
                + " order by d.last_seen_at, d.id")
        .params(personId)
        .query(String.class)
        .list();
  }

  public void deleteDevice(String token) {
    jdbc.sql("delete from device where fcm_token = ?").params(token).update();
  }

  /** Who gets the nudge: the assignee if she has an account, else her referent. */
  public Optional<UUID> recipient(UUID familyId, UUID assignee) {
    return jdbc.sql(
            "select case when exists (select 1 from user_account a where a.person_id = m.person_id)"
                + " then m.person_id else m.referent_person_id end"
                + " from membership m where m.family_id = ? and m.person_id = ?")
        .params(familyId, assignee)
        .query(UUID.class)
        .optional();
  }

  public String localeOf(UUID personId) {
    return jdbc.sql("select locale from person where id = ?")
        .params(personId)
        .query(String.class)
        .single();
  }

  public void saveReminder(
      UUID id, UUID taskId, UUID recipient, Instant dueAt, Instant sentAt, String result) {
    jdbc.sql(
            "insert into reminder (id, task_id, recipient_person_id, kind, due_at, sent_at, result)"
                + " values (?, ?, ?, 'NUDGE', ?, ?, ?)")
        .params(id, taskId, recipient, db(dueAt), db(sentAt), result)
        .update();
  }

  /** The first token of an automatic reminder settles the row that was marked sending. */
  public void settleReminder(UUID id, Instant sentAt, String result) {
    jdbc.sql("update reminder set sent_at = ?, result = ? where id = ?")
        .params(db(sentAt), result, id)
        .update();
  }

  public void saveAutoReminder(
      UUID id, UUID taskId, UUID recipient, Instant dueAt, Instant sentAt, String result) {
    jdbc.sql(
            "insert into reminder (id, task_id, recipient_person_id, kind, due_at, sent_at, result)"
                + " values (?, ?, ?, 'AUTO', ?, ?, ?)")
        .params(id, taskId, recipient, db(dueAt), db(sentAt), result)
        .update();
  }

  public String titleOf(UUID taskId) {
    return jdbc.sql("select title from task where id = ?")
        .params(taskId)
        .query(String.class)
        .single();
  }

  public String nameOf(UUID personId) {
    return jdbc.sql("select display_name from person where id = ?")
        .params(personId)
        .query(String.class)
        .single();
  }
}
