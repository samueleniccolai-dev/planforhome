package com.planforhome.reminder;

import static com.planforhome.common.Time.db;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ReminderRepository {

  public record TaskInfo(
      UUID familyId,
      String timeZone,
      String status,
      String dueKind,
      Instant dueAt,
      UUID assignee,
      int offsetMinutes) {}

  public record Due(UUID id, UUID taskId, UUID recipient, Instant dueAt) {}

  private final JdbcClient jdbc;

  public ReminderRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public Optional<TaskInfo> info(UUID taskId) {
    return jdbc.sql(
            "select t.family_id, f.time_zone, t.status, t.due_kind, t.due_at,"
                + " t.assignee_person_id, t.reminder_offset_minutes"
                + " from task t join family f on f.id = t.family_id where t.id = ?")
        .params(taskId)
        .query(
            (rs, i) -> {
              OffsetDateTime due = rs.getObject("due_at", OffsetDateTime.class);
              return new TaskInfo(
                  rs.getObject("family_id", UUID.class),
                  rs.getString("time_zone"),
                  rs.getString("status"),
                  rs.getString("due_kind"),
                  due == null ? null : due.toInstant(),
                  rs.getObject("assignee_person_id", UUID.class),
                  rs.getInt("reminder_offset_minutes"));
            })
        .optional();
  }

  /** The title of the task and the locale of the recipient; the name of the assignee, if any. */
  public record Words(String title, String locale, String assigneeName) {}

  public Words words(UUID taskId, UUID recipient) {
    return jdbc.sql(
            "select t.title, r.locale, a.display_name from task t, person r"
                + " left join person a on a.id = (select assignee_person_id from task where id = ?)"
                + " where t.id = ? and r.id = ?")
        .params(taskId, taskId, recipient)
        .query((rs, i) -> new Words(rs.getString(1), rs.getString(2), rs.getString(3)))
        .single();
  }

  /** Who gets the reminders of the assignee: she, or her referent if she has no account. */
  public Optional<UUID> recipient(UUID familyId, UUID assignee) {
    return jdbc.sql(
            "select case when exists (select 1 from user_account a where a.person_id = m.person_id)"
                + " then m.person_id else m.referent_person_id end"
                + " from membership m where m.family_id = ? and m.person_id = ?")
        .params(familyId, assignee)
        .query(UUID.class)
        .optional();
  }

  public List<UUID> managers(UUID familyId) {
    return jdbc.sql("select person_id from membership where family_id = ? and role = 'MANAGER'")
        .params(familyId)
        .query(UUID.class)
        .list();
  }

  /** The open tasks of a resource in a family, locked in id order. */
  public List<UUID> openTasksOf(UUID familyId, UUID personId) {
    return jdbc.sql(
            "select id from task where family_id = ? and assignee_person_id = ?"
                + " and status = 'OPEN' order by id for update")
        .params(familyId, personId)
        .query(UUID.class)
        .list();
  }

  /**
   * The future pending rows only: a row already due waits for the job, which checks it again before
   * sending it (hunt 040).
   */
  public void deletePending(UUID taskId, Instant now) {
    jdbc.sql(
            "delete from reminder where task_id = ? and result = 'pending' and kind = 'AUTO'"
                + " and due_at > ?")
        .params(taskId, db(now))
        .update();
  }

  public void insertPending(UUID id, UUID taskId, UUID recipient, Instant dueAt) {
    jdbc.sql(
            "insert into reminder (id, task_id, recipient_person_id, kind, due_at, sent_at, result)"
                + " values (?, ?, ?, 'AUTO', ?, null, 'pending')")
        .params(id, taskId, recipient, db(dueAt))
        .update();
  }

  /** At most {@code limit} pending rows already due, without locks. */
  public List<Due> due(Instant now, int limit) {
    return jdbc.sql(
            "select id, task_id, recipient_person_id, due_at from reminder"
                + " where result = 'pending' and kind = 'AUTO' and due_at <= ?"
                + " order by due_at, id limit ?")
        .params(db(now), limit)
        .query(
            (rs, i) ->
                new Due(
                    rs.getObject("id", UUID.class),
                    rs.getObject("task_id", UUID.class),
                    rs.getObject("recipient_person_id", UUID.class),
                    rs.getObject("due_at", OffsetDateTime.class).toInstant()))
        .list();
  }

  public boolean lockTask(UUID taskId) {
    return jdbc.sql("select id from task where id = ? for update")
        .params(taskId)
        .query(UUID.class)
        .optional()
        .isPresent();
  }

  /** The row, only if it is still pending and nobody else holds it. */
  public boolean lockPending(UUID id) {
    return jdbc.sql(
            "select id from reminder where id = ? and result = 'pending'"
                + " for update skip locked")
        .params(id)
        .query(UUID.class)
        .optional()
        .isPresent();
  }

  public void setResult(UUID id, String result) {
    jdbc.sql("update reminder set result = ? where id = ?").params(result, id).update();
  }

  /** A reminder as the managers read it: no recipient, no text. */
  public record Row(UUID id, String kind, Instant dueAt, Instant sentAt, String result) {}

  /** The reminders of a task in a family; empty if the task is not there. One statement. */
  public Optional<List<Row>> ofTask(UUID familyId, UUID taskId) {
    List<Row> rows =
        jdbc.sql(
                "select r.id, r.kind, r.due_at, r.sent_at, r.result from task t"
                    + " left join reminder r on r.task_id = t.id"
                    + " where t.id = ? and t.family_id = ?"
                    + " order by r.due_at, r.sent_at nulls last, r.id")
            .params(taskId, familyId)
            .query(
                (rs, i) -> {
                  UUID id = rs.getObject("id", UUID.class);
                  if (id == null) {
                    return null;
                  }
                  OffsetDateTime sent = rs.getObject("sent_at", OffsetDateTime.class);
                  return new Row(
                      id,
                      rs.getString("kind"),
                      rs.getObject("due_at", OffsetDateTime.class).toInstant(),
                      sent == null ? null : sent.toInstant(),
                      rs.getString("result"));
                })
            .list();
    if (rows.isEmpty()) {
      return Optional.empty();
    }
    return Optional.of(rows.stream().filter(java.util.Objects::nonNull).toList());
  }
}
