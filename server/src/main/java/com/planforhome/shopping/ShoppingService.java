package com.planforhome.shopping;

import com.planforhome.common.ApiException;
import com.planforhome.common.Names;
import com.planforhome.common.UuidV7;
import com.planforhome.family.FamilyRepository;
import com.planforhome.shopping.ShoppingRepository.Row;
import com.planforhome.task.TaskRepository;
import com.planforhome.task.TaskRepository.Applied;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The items of a shopping list (T8). Any member of the family writes on any open list of it
 * (decision 018-a). Every write locks the family, then the task, then checks in the order: replay,
 * template, open, item, body. Checks touch one row, so two checks on different items never clash.
 */
@Service
public class ShoppingService {

  public record Item(
      UUID id,
      UUID taskId,
      String text,
      boolean checked,
      int position,
      long version,
      String updatedAt,
      String deletedAt) {}

  public record Added(Item item, boolean created) {}

  private static final String ADD = "item.add";
  private static final String CHECK = "item.check";
  private static final String ORDER = "item.order";
  private static final String CLEAR = "item.clear";

  private final ShoppingRepository items;
  private final TaskRepository tasks;
  private final FamilyRepository families;
  private final TransactionTemplate tx;
  private final Clock clock;

  public ShoppingService(
      ShoppingRepository items,
      TaskRepository tasks,
      FamilyRepository families,
      TransactionTemplate tx,
      Clock clock) {
    this.items = items;
    this.tasks = tasks;
    this.families = families;
    this.tx = tx;
    this.clock = clock;
  }

  public List<Item> list(UUID caller, UUID familyId, UUID taskId) {
    families.roleIn(familyId, caller).orElseThrow(ApiException::notFound);
    tasks.lock(familyId, taskId).orElseThrow(ApiException::notFound);
    return views(taskId);
  }

  public Added add(
      UUID caller, UUID familyId, UUID taskId, String rawMutation, String rawId, String rawText) {
    return write(
        familyId,
        caller,
        taskId,
        rawMutation,
        (mutationId, task) -> {
          UUID id = rawId == null ? null : uuid(rawId);
          Applied done = tasks.applied(mutationId).orElse(null);
          if (done != null) {
            UUID same = id != null ? id : done.entityId();
            return new Added(view(replayItem(done, caller, familyId, same, ADD)), false);
          }
          requireList(task);
          String text = text(rawText);
          if (id != null && families.idInUse(id)) {
            throw conflict("id_conflict");
          }
          UUID itemId = id != null ? id : UuidV7.next(clock);
          Instant now = clock.instant();
          items.insert(itemId, taskId, text, items.nextPosition(taskId), now);
          record(mutationId, caller, familyId, itemId, ADD, "UPSERT", now);
          return new Added(view(items.find(itemId).orElseThrow()), true);
        });
  }

  public Item check(
      UUID caller, UUID familyId, UUID taskId, UUID itemId, String rawMutation, Boolean checked) {
    return write(
            familyId,
            caller,
            taskId,
            rawMutation,
            (mutationId, task) -> {
              Applied done = tasks.applied(mutationId).orElse(null);
              if (done != null) {
                return new Added(view(replayItem(done, caller, familyId, itemId, CHECK)), false);
              }
              requireList(task);
              Row item = items.find(itemId).orElse(null);
              if (item == null || !item.taskId().equals(taskId) || item.deletedAt() != null) {
                throw ApiException.notFound();
              }
              if (checked == null) {
                throw ApiException.badRequest("invalid_request");
              }
              Instant now = clock.instant();
              items.setChecked(itemId, checked, now);
              record(mutationId, caller, familyId, itemId, CHECK, "UPSERT", now);
              return new Added(view(items.find(itemId).orElseThrow()), false);
            })
        .item();
  }

  /** The last order to arrive wins; the items not listed follow, in their previous order. */
  public List<Item> order(
      UUID caller, UUID familyId, UUID taskId, String rawMutation, List<String> rawIds) {
    return listWrite(
        caller,
        familyId,
        taskId,
        rawMutation,
        ORDER,
        (mutationId, now) -> {
          if (rawIds == null) {
            throw ApiException.badRequest("invalid_request");
          }
          List<Row> alive = items.alive(taskId);
          Map<UUID, Row> byId =
              alive.stream().collect(Collectors.toMap(Row::id, Function.identity()));
          Set<UUID> gone =
              items.cancelled(taskId).stream().map(Row::id).collect(Collectors.toSet());
          Set<UUID> seen = new HashSet<>();
          List<UUID> sequence = new ArrayList<>();
          for (String raw : rawIds) {
            UUID id = uuid(raw);
            if (!seen.add(id)) {
              throw ApiException.badRequest("invalid_request");
            }
            if (byId.containsKey(id)) {
              sequence.add(id);
            } else if (!gone.contains(id)) {
              throw ApiException.badRequest("invalid_request");
            }
          }
          alive.stream().map(Row::id).filter(id -> !seen.contains(id)).forEach(sequence::add);
          for (int position = 0; position < sequence.size(); position++) {
            Row item = byId.get(sequence.get(position));
            if (item.position() != position) {
              items.setPosition(item.id(), position, now);
              items.log(familyId, item.id(), "UPSERT", now);
            }
          }
        });
  }

  public List<Item> clearChecked(UUID caller, UUID familyId, UUID taskId, String rawMutation) {
    return listWrite(
        caller,
        familyId,
        taskId,
        rawMutation,
        CLEAR,
        (mutationId, now) -> {
          for (UUID id : items.clearChecked(taskId, now)) {
            items.log(familyId, id, "DELETE", now);
          }
        });
  }

  // ---------------------------------------------------------------- helpers

  private interface Change {
    void apply(UUID mutationId, Instant now);
  }

  private List<Item> listWrite(
      UUID caller, UUID familyId, UUID taskId, String rawMutation, String op, Change change) {
    return write(
        familyId,
        caller,
        taskId,
        rawMutation,
        (mutationId, task) -> {
          Applied done = tasks.applied(mutationId).orElse(null);
          if (done != null) {
            checkReplay(done, caller, familyId, taskId, op);
            return views(taskId);
          }
          requireList(task);
          Instant now = clock.instant();
          change.apply(mutationId, now);
          tasks.recordMutation(mutationId, caller, familyId, taskId, op, now);
          return views(taskId);
        });
  }

  private interface Body<T> {
    T run(UUID mutationId, TaskRepository.Row task);
  }

  private <T> T write(UUID familyId, UUID caller, UUID taskId, String rawMutation, Body<T> body) {
    try {
      return tx.execute(
          s -> {
            UUID mutationId = uuid(rawMutation);
            if (!families.lockFamily(familyId)) {
              throw ApiException.notFound();
            }
            families.roleIn(familyId, caller).orElseThrow(ApiException::notFound);
            TaskRepository.Row task =
                tasks.lock(familyId, taskId).orElseThrow(ApiException::notFound);
            return body.run(mutationId, task);
          });
    } catch (DuplicateKeyException e) {
      String message = String.valueOf(e.getMessage());
      throw conflict(message.contains("applied_mutation") ? "mutation_conflict" : "id_conflict");
    }
  }

  private void record(
      UUID mutationId,
      UUID caller,
      UUID familyId,
      UUID itemId,
      String op,
      String logOp,
      Instant now) {
    items.log(familyId, itemId, logOp, now);
    tasks.recordMutation(mutationId, caller, familyId, itemId, op, now);
  }

  private Row replayItem(Applied done, UUID caller, UUID familyId, UUID itemId, String op) {
    checkReplay(done, caller, familyId, itemId, op);
    return items.find(itemId).orElseThrow(ApiException::notFound);
  }

  private static void checkReplay(
      Applied done, UUID caller, UUID familyId, UUID entityId, String op) {
    if (!done.personId().equals(caller)
        || !done.familyId().equals(familyId)
        || !done.entityId().equals(entityId)
        || !done.op().equals(op)) {
      throw conflict("mutation_conflict");
    }
  }

  private static void requireList(TaskRepository.Row task) {
    if (!"SHOPPING_LIST".equals(task.template())) {
      throw conflict("not_shopping_list");
    }
    if (!"OPEN".equals(task.status())) {
      throw conflict("not_open");
    }
  }

  private List<Item> views(UUID taskId) {
    return items.alive(taskId).stream().map(ShoppingService::view).toList();
  }

  private static Item view(Row r) {
    return new Item(
        r.id(),
        r.taskId(),
        r.text(),
        r.checked(),
        r.position(),
        r.version(),
        r.updatedAt().toString(),
        r.deletedAt() == null ? null : r.deletedAt().toString());
  }

  private static String text(String raw) {
    String text = raw == null ? "" : raw.trim();
    if (text.isEmpty() || text.length() > 200 || text.indexOf('\0') >= 0) {
      throw ApiException.badRequest("text_invalid");
    }
    return text;
  }

  private static UUID uuid(String raw) {
    UUID id = Names.uuidOrNull(raw);
    if (id == null) {
      throw ApiException.badRequest("invalid_request");
    }
    return id;
  }

  private static ApiException conflict(String code) {
    return new ApiException(HttpStatus.CONFLICT, code);
  }
}
