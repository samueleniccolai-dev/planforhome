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

  /** One row per token; the same token from another person passes to her. */
  public void saveDevice(UUID id, UUID personId, String token, String platform, Instant now) {
    jdbc.sql(
            "insert into device (id, person_id, fcm_token, platform, last_seen_at)"
                + " values (?, ?, ?, ?, ?) on conflict (fcm_token) do update set"
                + " person_id = excluded.person_id, platform = excluded.platform,"
                + " last_seen_at = excluded.last_seen_at")
        .params(id, personId, token, platform, db(now))
        .update();
  }

  public List<String> tokensOf(UUID personId) {
    return jdbc.sql("select fcm_token from device where person_id = ? order by last_seen_at, id")
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
}
