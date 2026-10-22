package com.planforhome.sync;

import com.planforhome.common.ApiException;
import com.planforhome.family.FamilyRepository;
import com.planforhome.family.FamilyRepository.MemberView;
import com.planforhome.shopping.ShoppingRepository;
import com.planforhome.sync.SyncRepository.Raw;
import com.planforhome.task.TaskRepository;
import com.planforhome.task.TaskRepository.Row;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * T9 (SPEC section 7), server side: the snapshot of a family and its change log read by seq. A row
 * of the log says an entity changed; what goes out is the current state, and only if the entity is
 * still in the family asked for. Anything that moved away goes out as a deletion, without data.
 */
@Service
public class SyncService {

  public record Snapshot(
      UUID familyId,
      long seq,
      List<Map<String, Object>> tasks,
      List<Map<String, Object>> shoppingItems,
      List<Map<String, Object>> members) {}

  public record Change(
      long seq,
      String entity,
      UUID entityId,
      String op,
      Map<String, Object> data,
      String deletedAt) {}

  public record Changes(List<Change> changes, long lastSeq, boolean hasMore) {}

  private final SyncRepository sync;
  private final TaskRepository tasks;
  private final ShoppingRepository shopping;
  private final FamilyRepository families;
  private final TransactionTemplate tx;

  public SyncService(
      SyncRepository sync,
      TaskRepository tasks,
      ShoppingRepository shopping,
      FamilyRepository families,
      PlatformTransactionManager manager) {
    this.sync = sync;
    this.tasks = tasks;
    this.shopping = shopping;
    this.families = families;
    this.tx = new TransactionTemplate(manager);
    this.tx.setReadOnly(true);
    this.tx.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
  }

  /** The seq is read first and the data after: at worst a change shows twice, never a gap. */
  public Snapshot snapshot(UUID caller, UUID familyId) {
    return tx.execute(
        s -> {
          families.roleIn(familyId, caller).orElseThrow(ApiException::notFound);
          long seq = sync.maxSeq(familyId);
          return new Snapshot(
              familyId,
              seq,
              tasks.ofFamily(familyId).stream().map(SyncService::task).toList(),
              sync.liveItems(familyId).stream().map(SyncService::item).toList(),
              families.members(familyId).stream().map(SyncService::member).toList());
        });
  }

  public Changes changes(UUID caller, UUID familyId, long after, int limit) {
    return tx.execute(
        s -> {
          families.roleIn(familyId, caller).orElseThrow(ApiException::notFound);
          if (after < 0 || limit < 1 || limit > 500) {
            throw ApiException.badRequest("invalid_request");
          }
          List<Raw> page = sync.page(familyId, after, limit);
          long lastSeq = page.isEmpty() ? after : page.get(page.size() - 1).seq();
          Map<UUID, Raw> latest = new LinkedHashMap<>();
          for (Raw raw : page) {
            latest.put(raw.entityId(), raw);
          }
          List<Change> out =
              latest.values().stream()
                  .sorted(java.util.Comparator.comparingLong(Raw::seq))
                  .map(raw -> change(familyId, raw))
                  .toList();
          return new Changes(out, lastSeq, !page.isEmpty() && sync.hasAfter(familyId, lastSeq));
        });
  }

  private Change change(UUID familyId, Raw raw) {
    Map<String, Object> data = null;
    if (!raw.op().equals("DELETE")) {
      if (raw.entity().equals("task")) {
        Row row = tasks.find(raw.entityId()).orElse(null);
        data = row != null && row.familyId().equals(familyId) ? task(row) : null;
      } else if (sync.familyOfLiveItem(raw.entityId()).filter(familyId::equals).isPresent()) {
        data = item(shopping.find(raw.entityId()).orElseThrow());
      }
    }
    if (data != null) {
      return new Change(raw.seq(), raw.entity(), raw.entityId(), "UPSERT", data, null);
    }
    return new Change(raw.seq(), raw.entity(), raw.entityId(), "DELETE", null, raw.at().toString());
  }

  static Map<String, Object> task(Row t) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", t.id());
    m.put("familyId", t.familyId());
    m.put("title", t.title());
    m.put("notes", t.notes());
    m.put("dueKind", t.dueKind());
    m.put("dueAt", t.dueAt() == null ? null : t.dueAt().toString());
    m.put("criticality", t.criticality());
    m.put("status", t.status());
    m.put("assigneePersonId", t.assigneePersonId());
    m.put("createdBy", t.createdBy());
    m.put("completedBy", t.completedBy());
    m.put("version", t.version());
    m.put("updatedAt", t.updatedAt().toString());
    m.put("template", t.template());
    m.put("lastNudgedAt", t.lastNudgedAt() == null ? null : t.lastNudgedAt().toString());
    return m;
  }

  static Map<String, Object> item(ShoppingRepository.Row i) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", i.id());
    m.put("taskId", i.taskId());
    m.put("text", i.text());
    m.put("checked", i.checked());
    m.put("position", i.position());
    m.put("version", i.version());
    m.put("removedBy", i.removedBy());
    m.put("updatedAt", i.updatedAt().toString());
    return m;
  }

  static Map<String, Object> member(MemberView p) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("personId", p.personId());
    m.put("displayName", p.displayName());
    m.put("role", p.role());
    return m;
  }
}
