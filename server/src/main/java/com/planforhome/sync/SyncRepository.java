package com.planforhome.sync;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class SyncRepository {

  public record Raw(long seq, String entity, UUID entityId, String op, Instant at) {}

  private final JdbcClient jdbc;

  public SyncRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  public long maxSeq(UUID familyId) {
    return jdbc.sql("select coalesce(max(seq), 0) from change_log where family_id = ?")
        .params(familyId)
        .query(Long.class)
        .single();
  }

  public List<Raw> page(UUID familyId, long after, int limit) {
    return jdbc.sql(
            "select seq, entity, entity_id, op, at from change_log"
                + " where family_id = ? and seq > ? order by seq limit ?")
        .params(familyId, after, limit)
        .query(
            (rs, i) ->
                new Raw(
                    rs.getLong("seq"),
                    rs.getString("entity"),
                    rs.getObject("entity_id", UUID.class),
                    rs.getString("op"),
                    rs.getObject("at", OffsetDateTime.class).toInstant()))
        .list();
  }

  public boolean hasAfter(UUID familyId, long seq) {
    return jdbc.sql(
                "select count(*) from (select 1 from change_log where family_id = ? and seq > ?"
                    + " limit 1) x")
            .params(familyId, seq)
            .query(Long.class)
            .single()
        > 0;
  }

  /** The family an item belongs to now (the one of its task), if the item is alive. */
  public java.util.Optional<UUID> familyOfLiveItem(UUID itemId) {
    return jdbc.sql(
            "select t.family_id from shopping_item i join task t on t.id = i.task_id"
                + " where i.id = ? and i.deleted_at is null")
        .params(itemId)
        .query(UUID.class)
        .optional();
  }

  /** The live items (struck ones included) of the tasks of a family. */
  public List<com.planforhome.shopping.ShoppingRepository.Row> liveItems(UUID familyId) {
    return jdbc.sql(
            "select i.id, i.task_id, i.text, i.checked, i.position, i.version, i.updated_at,"
                + " i.deleted_at, i.created_by, i.removed_by from shopping_item i"
                + " join task t on t.id = i.task_id where t.family_id = ? and i.deleted_at is null"
                + " order by t.created_at, t.id, i.position, i.id")
        .params(familyId)
        .query(
            (rs, i) ->
                new com.planforhome.shopping.ShoppingRepository.Row(
                    rs.getObject("id", UUID.class),
                    rs.getObject("task_id", UUID.class),
                    rs.getString("text"),
                    rs.getBoolean("checked"),
                    rs.getInt("position"),
                    rs.getLong("version"),
                    rs.getObject("updated_at", OffsetDateTime.class).toInstant(),
                    null,
                    rs.getObject("created_by", UUID.class),
                    rs.getObject("removed_by", UUID.class)))
        .list();
  }
}
