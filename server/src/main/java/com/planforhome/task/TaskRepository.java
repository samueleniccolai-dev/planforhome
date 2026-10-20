package com.planforhome.task;

import static com.planforhome.common.Time.db;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class TaskRepository {

  public record Row(
      UUID id,
      UUID familyId,
      String timeZone,
      String title,
      String notes,
      String dueKind,
      Instant dueAt,
      String criticality,
      String status,
      UUID assigneePersonId,
      UUID createdBy,
      UUID completedBy,
      long version,
      Instant updatedAt,
      String recurrence,
      UUID seriesId) {}

  public record Applied(UUID personId, UUID familyId, UUID entityId, String op) {}

  private static final String SELECT =
      "select t.id, t.family_id, f.time_zone, t.title, t.notes, t.due_kind, t.due_at,"
          + " t.criticality, t.status, t.assignee_person_id, t.created_by, t.completed_by, t.version, t.updated_at,"
          + " t.recurrence::text as recurrence, t.series_id"
          + " from task t join family f on f.id = t.family_id ";

  private final JdbcClient jdbc;

  public TaskRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  private static Row row(java.sql.ResultSet rs, int i) throws java.sql.SQLException {
    OffsetDateTime due = rs.getObject("due_at", OffsetDateTime.class);
    return new Row(
        rs.getObject("id", UUID.class),
        rs.getObject("family_id", UUID.class),
        rs.getString("time_zone"),
        rs.getString("title"),
        rs.getString("notes"),
        rs.getString("due_kind"),
        due == null ? null : due.toInstant(),
        rs.getString("criticality"),
        rs.getString("status"),
        rs.getObject("assignee_person_id", UUID.class),
        rs.getObject("created_by", UUID.class),
        rs.getObject("completed_by", UUID.class),
        rs.getLong("version"),
        rs.getObject("updated_at", OffsetDateTime.class).toInstant(),
        rs.getString("recurrence"),
        rs.getObject("series_id", UUID.class));
  }

  public List<Row> ofFamily(UUID familyId) {
    return jdbc.sql(SELECT + "where t.family_id = ? order by t.created_at, t.id")
        .params(familyId)
        .query(TaskRepository::row)
        .list();
  }

  public List<Row> ofPerson(UUID personId) {
    return jdbc.sql(
            SELECT
                + "where t.family_id in (select family_id from membership where person_id = ?)"
                + " order by t.created_at, t.id")
        .params(personId)
        .query(TaskRepository::row)
        .list();
  }

  /** The task of that family, locked for the rest of the transaction. */
  public Optional<Row> lock(UUID familyId, UUID taskId) {
    Optional<UUID> locked =
        jdbc.sql("select id from task where id = ? and family_id = ? for update")
            .params(taskId, familyId)
            .query(UUID.class)
            .optional();
    return locked.flatMap(id -> find(id));
  }

  public Optional<Row> find(UUID taskId) {
    return jdbc.sql(SELECT + "where t.id = ?").params(taskId).query(TaskRepository::row).optional();
  }

  public String timeZone(UUID familyId) {
    return jdbc.sql("select time_zone from family where id = ?")
        .params(familyId)
        .query(String.class)
        .single();
  }

  public String displayName(UUID personId) {
    return jdbc.sql("select display_name from person where id = ?")
        .params(personId)
        .query(String.class)
        .single();
  }

  public void insert(
      UUID id,
      UUID familyId,
      String title,
      String notes,
      String dueKind,
      Instant dueAt,
      String criticality,
      UUID assignee,
      UUID createdBy,
      Instant now,
      String recurrence,
      UUID seriesId) {
    jdbc.sql(
            "insert into task (id, family_id, title, notes, due_kind, due_at, criticality,"
                + " assignee_person_id, created_by, version, created_at, updated_at, recurrence,"
                + " series_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, cast(? as jsonb), ?)")
        .params(
            id,
            familyId,
            title,
            notes,
            dueKind,
            db(dueAt),
            criticality,
            assignee,
            createdBy,
            db(now),
            db(now),
            recurrence,
            seriesId)
        .update();
  }

  /** The next occurrence of a series: a copy of {@code previous} with a new id and due. */
  public void insertNext(UUID id, UUID previous, Instant dueAt, Instant now) {
    jdbc.sql(
            "insert into task (id, family_id, title, notes, due_at, due_kind,"
                + " reminder_offset_minutes, criticality, assignee_person_id, recurrence, template,"
                + " series_id, created_by, version, created_at, updated_at)"
                + " select ?, family_id, title, notes, ?, due_kind, reminder_offset_minutes,"
                + " criticality, assignee_person_id, recurrence, template, series_id, created_by, 1,"
                + " ?, ? from task where id = ?")
        .params(id, db(dueAt), db(now), db(now), previous)
        .update();
  }

  /** True if the series already has an occurrence due after {@code dueAt}. */
  public boolean hasLater(UUID familyId, UUID seriesId, Instant dueAt) {
    return jdbc.sql(
                "select count(*) from task where family_id = ? and series_id = ? and due_at > ?")
            .params(familyId, seriesId, db(dueAt))
            .query(Long.class)
            .single()
        > 0;
  }

  public void assign(UUID taskId, UUID assignee, Instant now) {
    jdbc.sql(
            "update task set assignee_person_id = ?, version = version + 1, updated_at = ?"
                + " where id = ?")
        .params(assignee, db(now), taskId)
        .update();
  }

  public void setStatus(UUID taskId, String status, UUID completedBy, Instant now) {
    jdbc.sql(
            "update task set status = ?, completed_by = ?, version = version + 1, updated_at = ?"
                + " where id = ?")
        .params(status, completedBy, db(now), taskId)
        .update();
  }

  public void replace(
      UUID taskId,
      String title,
      String notes,
      String dueKind,
      Instant dueAt,
      String criticality,
      Instant now) {
    jdbc.sql(
            "update task set title = ?, notes = ?, due_kind = ?, due_at = ?, criticality = ?,"
                + " version = version + 1, updated_at = ? where id = ?")
        .params(title, notes, dueKind, db(dueAt), criticality, db(now), taskId)
        .update();
  }

  public boolean isReferentOf(UUID familyId, UUID resourceId, UUID personId) {
    return jdbc.sql(
                "select count(*) from membership where family_id = ? and person_id = ?"
                    + " and referent_person_id = ?")
            .params(familyId, resourceId, personId)
            .query(Long.class)
            .single()
        > 0;
  }

  /** Sends the tasks of a person in a family back to the queue; returns their ids. */
  public List<UUID> requeue(UUID familyId, UUID personId, Instant now) {
    return jdbc.sql(
            "update task set assignee_person_id = null, version = version + 1, updated_at = ?"
                + " where family_id = ? and assignee_person_id = ? returning id")
        .params(db(now), familyId, personId)
        .query(UUID.class)
        .list();
  }

  public void logChange(UUID familyId, UUID taskId, Instant now) {
    jdbc.sql(
            "insert into change_log (family_id, entity, entity_id, op, at)"
                + " values (?, 'task', ?, 'UPSERT', ?)")
        .params(familyId, taskId, db(now))
        .update();
  }

  public Optional<Applied> applied(UUID mutationId) {
    return jdbc.sql(
            "select person_id, family_id, entity_id, op from applied_mutation"
                + " where mutation_id = ?")
        .params(mutationId)
        .query(
            (rs, i) ->
                new Applied(
                    rs.getObject("person_id", UUID.class),
                    rs.getObject("family_id", UUID.class),
                    rs.getObject("entity_id", UUID.class),
                    rs.getString("op")))
        .optional();
  }

  public void recordMutation(
      UUID mutationId, UUID personId, UUID familyId, UUID taskId, String op, Instant now) {
    jdbc.sql(
            "insert into applied_mutation (mutation_id, person_id, family_id, entity_id, op,"
                + " applied_at) values (?, ?, ?, ?, ?, ?)")
        .params(mutationId, personId, familyId, taskId, op, db(now))
        .update();
  }
}
