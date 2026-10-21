package com.planforhome.shopping;

import static com.planforhome.common.Time.db;

import com.planforhome.common.UuidV7;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ShoppingRepository {

  public record Row(
      UUID id,
      UUID taskId,
      String text,
      boolean checked,
      int position,
      long version,
      Instant updatedAt,
      Instant deletedAt) {}

  private static final String SELECT =
      "select id, task_id, text, checked, position, version, updated_at, deleted_at"
          + " from shopping_item ";

  private final JdbcClient jdbc;
  private final Clock clock;

  public ShoppingRepository(JdbcClient jdbc, Clock clock) {
    this.jdbc = jdbc;
    this.clock = clock;
  }

  private static Row row(java.sql.ResultSet rs, int i) throws java.sql.SQLException {
    OffsetDateTime deleted = rs.getObject("deleted_at", OffsetDateTime.class);
    return new Row(
        rs.getObject("id", UUID.class),
        rs.getObject("task_id", UUID.class),
        rs.getString("text"),
        rs.getBoolean("checked"),
        rs.getInt("position"),
        rs.getLong("version"),
        rs.getObject("updated_at", OffsetDateTime.class).toInstant(),
        deleted == null ? null : deleted.toInstant());
  }

  /** The items of a task not cancelled, in order of position. */
  public List<Row> alive(UUID taskId) {
    return jdbc.sql(SELECT + "where task_id = ? and deleted_at is null order by position, id")
        .params(taskId)
        .query(ShoppingRepository::row)
        .list();
  }

  public List<Row> cancelled(UUID taskId) {
    return jdbc.sql(SELECT + "where task_id = ? and deleted_at is not null")
        .params(taskId)
        .query(ShoppingRepository::row)
        .list();
  }

  public Optional<Row> find(UUID itemId) {
    return jdbc.sql(SELECT + "where id = ?")
        .params(itemId)
        .query(ShoppingRepository::row)
        .optional();
  }

  public int nextPosition(UUID taskId) {
    return jdbc.sql(
            "select coalesce(max(position), -1) + 1 from shopping_item"
                + " where task_id = ? and deleted_at is null")
        .params(taskId)
        .query(Integer.class)
        .single();
  }

  public void insert(UUID id, UUID taskId, String text, int position, Instant now) {
    jdbc.sql(
            "insert into shopping_item (id, task_id, text, checked, position, version, created_at,"
                + " updated_at) values (?, ?, ?, false, ?, 1, ?, ?)")
        .params(id, taskId, text, position, db(now), db(now))
        .update();
  }

  public void setChecked(UUID id, boolean checked, Instant now) {
    jdbc.sql(
            "update shopping_item set checked = ?, version = version + 1, updated_at = ?"
                + " where id = ?")
        .params(checked, db(now), id)
        .update();
  }

  public void setPosition(UUID id, int position, Instant now) {
    jdbc.sql(
            "update shopping_item set position = ?, version = version + 1, updated_at = ?"
                + " where id = ?")
        .params(position, db(now), id)
        .update();
  }

  /** Cancels the checked items of a task; returns their ids. */
  public List<UUID> clearChecked(UUID taskId, Instant now) {
    return jdbc.sql(
            "update shopping_item set deleted_at = ?, version = version + 1, updated_at = ?"
                + " where task_id = ? and checked and deleted_at is null returning id")
        .params(db(now), db(now), taskId)
        .query(UUID.class)
        .list();
  }

  public void log(UUID familyId, UUID itemId, String op, Instant now) {
    jdbc.sql(
            "insert into change_log (family_id, entity, entity_id, op, at)"
                + " values (?, 'shopping_item', ?, ?, ?)")
        .params(familyId, itemId, op, db(now))
        .update();
  }

  /** The next occurrence of a list gets the items not checked and not cancelled, in order. */
  public void copyOpenItems(UUID familyId, UUID from, UUID to, Instant now) {
    addItems(
        familyId, to, alive(from).stream().filter(r -> !r.checked()).map(Row::text).toList(), now);
  }

  public void addItems(UUID familyId, UUID taskId, List<String> texts, Instant now) {
    int position = 0;
    for (String text : texts) {
      UUID id = UuidV7.next(clock);
      insert(id, taskId, text, position++, now);
      log(familyId, id, "UPSERT", now);
    }
  }
}
