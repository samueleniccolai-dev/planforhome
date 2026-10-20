package com.planforhome.task;

import com.planforhome.common.ApiException;
import com.planforhome.common.Names;
import com.planforhome.common.UuidV7;
import com.planforhome.family.FamilyRepository;
import com.planforhome.task.TaskRepository.Applied;
import com.planforhome.task.TaskRepository.Row;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

/**
 * P1 to P6: tasks, the queue and the return to the queue. Every write locks the family, then the
 * task, and only then checks (membership 404, task 404, body 400, replay, assignee 400, permission
 * 403, state 409). A good write raises the version and adds a change_log and an applied_mutation
 * row in the same transaction.
 */
@Service
public class TaskService {

  public record View(
      UUID id,
      UUID familyId,
      String familyTimeZone,
      String title,
      String notes,
      String dueKind,
      String due,
      String criticality,
      String status,
      UUID assigneePersonId,
      UUID createdBy,
      UUID completedBy,
      long version,
      String updatedAt,
      JsonNode recurrence,
      UUID seriesId) {}

  public record Result(View task, boolean created) {}

  public static class AlreadyTaken extends RuntimeException {
    private final transient UUID assigneeId;
    private final transient String assigneeName;

    AlreadyTaken(UUID assigneeId, String assigneeName) {
      super("already_taken", null, false, false);
      this.assigneeId = assigneeId;
      this.assigneeName = assigneeName;
    }

    public UUID assigneeId() {
      return assigneeId;
    }

    public String assigneeName() {
      return assigneeName;
    }
  }

  public record NewTask(
      String mutationId,
      String id,
      String title,
      String notes,
      String dueKind,
      String due,
      String criticality,
      String assigneePersonId,
      JsonNode recurrence) {}

  public record Edit(
      String mutationId,
      String title,
      String notes,
      String dueKind,
      String due,
      String criticality) {}

  private static final Set<String> CRITICALITIES = Set.of("LOW", "NORMAL", "HIGH");

  private final TaskRepository tasks;
  private final FamilyRepository families;
  private final TransactionTemplate tx;
  private final Clock clock;

  public TaskService(
      TaskRepository tasks, FamilyRepository families, TransactionTemplate tx, Clock clock) {
    this.tasks = tasks;
    this.families = families;
    this.tx = tx;
    this.clock = clock;
  }

  // ---------------------------------------------------------------- reads

  public List<View> ofFamily(UUID caller, UUID familyId) {
    families.roleIn(familyId, caller).orElseThrow(ApiException::notFound);
    return tasks.ofFamily(familyId).stream().map(TaskService::view).toList();
  }

  public List<View> ofPerson(UUID caller) {
    return tasks.ofPerson(caller).stream().map(TaskService::view).toList();
  }

  // ---------------------------------------------------------------- writes

  public Result create(UUID caller, UUID familyId, NewTask in) {
    return write(
        () ->
            tx.execute(
                s -> {
                  String role = lockAsMember(caller, familyId);
                  UUID mutationId = uuid(in.mutationId());
                  UUID id = optionalUuid(in.id());
                  UUID assignee = optionalUuid(in.assigneePersonId());
                  String title = title(in.title());
                  String notes = notes(in.notes());
                  String criticality = criticality(in.criticality());
                  String zone = tasks.timeZone(familyId);
                  Instant dueAt = dueAt(in.dueKind(), in.due(), zone);
                  Recurrence rule = rule(in.recurrence(), in.dueKind(), dueAt, zone);
                  Applied done = tasks.applied(mutationId).orElse(null);
                  if (done != null) {
                    UUID same = id != null ? id : done.entityId();
                    return replay(done, caller, familyId, same, "task.create");
                  }
                  requireAssignee(familyId, assignee);
                  if (role.equals("MEMBER") && assignee != null && !assignee.equals(caller)) {
                    throw forbidden();
                  }
                  if (id != null && families.idInUse(id)) {
                    throw conflict("id_conflict");
                  }
                  UUID taskId = id != null ? id : UuidV7.next(clock);
                  Instant now = clock.instant();
                  tasks.insert(
                      taskId,
                      familyId,
                      title,
                      notes,
                      dueAt == null ? null : in.dueKind(),
                      dueAt,
                      criticality,
                      assignee,
                      caller,
                      now,
                      rule == null ? null : rule.toJson(),
                      rule == null ? null : taskId);
                  return applied(mutationId, caller, familyId, taskId, "task.create", true);
                }));
  }

  public Result setAssignee(
      UUID caller, UUID familyId, UUID taskId, String rawMutationId, String rawAssignee) {
    return write(
        () ->
            tx.execute(
                s -> {
                  String role = lockAsMember(caller, familyId);
                  Row task = lockTask(familyId, taskId);
                  UUID mutationId = uuid(rawMutationId);
                  UUID assignee = optionalUuid(rawAssignee);
                  Applied done = tasks.applied(mutationId).orElse(null);
                  if (done != null) {
                    return replay(done, caller, familyId, taskId, "task.assign");
                  }
                  requireOpen(task);
                  requireAssignee(familyId, assignee);
                  if (role.equals("MEMBER") && !memberMayAssign(caller, task, assignee)) {
                    throw forbidden();
                  }
                  tasks.assign(taskId, assignee, clock.instant());
                  return applied(mutationId, caller, familyId, taskId, "task.assign", false);
                }));
  }

  public Result take(UUID caller, UUID familyId, UUID taskId, String rawMutationId) {
    return write(
        () ->
            tx.execute(
                s -> {
                  lockAsMember(caller, familyId);
                  Row task = lockTask(familyId, taskId);
                  UUID mutationId = uuid(rawMutationId);
                  Applied done = tasks.applied(mutationId).orElse(null);
                  if (done != null) {
                    return replay(done, caller, familyId, taskId, "task.take");
                  }
                  requireOpen(task);
                  if (caller.equals(task.assigneePersonId())) {
                    return new Result(view(task), false);
                  }
                  if (task.assigneePersonId() != null) {
                    throw new AlreadyTaken(
                        task.assigneePersonId(), tasks.displayName(task.assigneePersonId()));
                  }
                  tasks.assign(taskId, caller, clock.instant());
                  return applied(mutationId, caller, familyId, taskId, "task.take", false);
                }));
  }

  public Result done(UUID caller, UUID familyId, UUID taskId, String mutationId) {
    return transition(
        caller, familyId, taskId, mutationId, "task.done", "OPEN", "not_open", "DONE", true);
  }

  public Result reopen(UUID caller, UUID familyId, UUID taskId, String mutationId) {
    return transition(
        caller, familyId, taskId, mutationId, "task.reopen", "DONE", "not_done", "OPEN", false);
  }

  public Result cancel(UUID caller, UUID familyId, UUID taskId, String mutationId) {
    return transition(
        caller,
        familyId,
        taskId,
        mutationId,
        "task.cancel",
        "OPEN",
        "not_open",
        "CANCELLED",
        false);
  }

  public Result update(UUID caller, UUID familyId, UUID taskId, Edit in) {
    return write(
        () ->
            tx.execute(
                s -> {
                  String role = lockAsMember(caller, familyId);
                  Row task = lockTask(familyId, taskId);
                  UUID mutationId = uuid(in.mutationId());
                  String title = title(in.title());
                  String notes = notes(in.notes());
                  String criticality = criticality(in.criticality());
                  Instant dueAt = dueAt(in.dueKind(), in.due(), task.timeZone());
                  if (task.recurrence() != null && dueAt == null) {
                    throw ApiException.badRequest("recurrence_needs_due");
                  }
                  Applied done = tasks.applied(mutationId).orElse(null);
                  if (done != null) {
                    return replay(done, caller, familyId, taskId, "task.update");
                  }
                  requireOwnOrManager(role, caller, task);
                  requireOpen(task);
                  String rule = null;
                  if (task.recurrence() != null) {
                    LocalTime time =
                        dueAt == null || !"DATETIME".equals(in.dueKind())
                            ? null
                            : dueAt.atZone(ZoneId.of(task.timeZone())).toLocalTime();
                    rule = Recurrence.fromStored(task.recurrence()).withTime(time).toJson();
                  }
                  tasks.replace(
                      taskId,
                      title,
                      notes,
                      dueAt == null ? null : in.dueKind(),
                      dueAt,
                      criticality,
                      rule,
                      clock.instant());
                  return applied(mutationId, caller, familyId, taskId, "task.update", false);
                }));
  }

  private Result transition(
      UUID caller,
      UUID familyId,
      UUID taskId,
      String rawMutationId,
      String op,
      String from,
      String error,
      String to,
      boolean completes) {
    return write(
        () ->
            tx.execute(
                s -> {
                  String role = lockAsMember(caller, familyId);
                  Row task = lockTask(familyId, taskId);
                  UUID mutationId = uuid(rawMutationId);
                  Applied done = tasks.applied(mutationId).orElse(null);
                  if (done != null) {
                    return replay(done, caller, familyId, taskId, op);
                  }
                  boolean manager = role.equals("MANAGER");
                  boolean allowed =
                      switch (op) {
                        case "task.done" -> manager || memberMayComplete(familyId, caller, task);
                        case "task.reopen" -> manager || caller.equals(task.completedBy());
                        default -> manager || isOwn(caller, task);
                      };
                  if (!allowed) {
                    throw forbidden();
                  }
                  if (!from.equals(task.status())) {
                    throw conflict(error);
                  }
                  tasks.setStatus(taskId, to, completes ? caller : null, clock.instant());
                  if (op.equals("task.done") || op.equals("task.cancel")) {
                    spawnNext(task);
                  }
                  return applied(mutationId, caller, familyId, taskId, op, false);
                }));
  }

  /** End the series (P10): the creator of the series or a manager; no next occurrence. */
  public Result endSeries(UUID caller, UUID familyId, UUID taskId, String rawMutationId) {
    return write(
        () ->
            tx.execute(
                s -> {
                  String role = lockAsMember(caller, familyId);
                  Row task = lockTask(familyId, taskId);
                  UUID mutationId = uuid(rawMutationId);
                  Applied done = tasks.applied(mutationId).orElse(null);
                  if (done != null) {
                    return replay(done, caller, familyId, taskId, "task.endSeries");
                  }
                  if (!role.equals("MANAGER") && !caller.equals(task.createdBy())) {
                    throw forbidden();
                  }
                  if (task.recurrence() == null) {
                    throw conflict("not_recurring");
                  }
                  requireOpen(task);
                  Instant now = clock.instant();
                  tasks.setStatus(taskId, "CANCELLED", null, now);
                  tasks.logChange(familyId, taskId, now);
                  for (UUID other : tasks.cancelOpenOfSeries(familyId, task.seriesId(), now)) {
                    tasks.logChange(familyId, other, now);
                  }
                  tasks.recordMutation(mutationId, caller, familyId, taskId, "task.endSeries", now);
                  return new Result(view(tasks.find(taskId).orElseThrow()), false);
                }));
  }

  /**
   * The next occurrence of a recurring task just closed: only one per series, so a task done,
   * reopened and done again does not make a second one. Runs under the lock of the family.
   */
  private void spawnNext(Row task) {
    if (task.recurrence() == null || task.dueAt() == null) {
      return;
    }
    if (tasks.hasLater(task.familyId(), task.seriesId(), task.dueAt())) {
      return;
    }
    ZoneId zone = ZoneId.of(task.timeZone());
    boolean dateOnly = "DATE".equals(task.dueKind());
    Recurrence rule = Recurrence.fromStored(task.recurrence());
    if (!dateOnly && rule.time() == null) {
      rule = rule.withTime(task.dueAt().atZone(zone).toLocalTime());
    }
    Instant now = clock.instant();
    Instant next = rule.next(task.dueAt(), dateOnly, zone, now);
    UUID nextId = UuidV7.next(clock);
    tasks.insertNext(nextId, task.id(), next, now);
    tasks.logChange(task.familyId(), nextId, now);
  }

  /** The checked rule of a new task, with the local time of the first due for a DATETIME. */
  private static Recurrence rule(JsonNode raw, String dueKind, Instant dueAt, String zone) {
    if (raw == null || raw.isNull()) {
      return null;
    }
    Recurrence rule;
    try {
      rule = Recurrence.fromRequest(raw);
    } catch (Recurrence.Invalid e) {
      throw ApiException.badRequest("recurrence_invalid");
    }
    if (dueAt == null) {
      throw ApiException.badRequest("recurrence_needs_due");
    }
    if ("DATETIME".equals(dueKind)) {
      LocalTime time = dueAt.atZone(ZoneId.of(zone)).toLocalTime();
      rule = rule.withTime(time);
    }
    return rule;
  }

  private boolean memberMayComplete(UUID familyId, UUID caller, Row task) {
    UUID assignee = task.assigneePersonId();
    return assignee != null
        && (assignee.equals(caller) || tasks.isReferentOf(familyId, assignee, caller));
  }

  private static boolean isOwn(UUID caller, Row task) {
    return caller.equals(task.createdBy()) || caller.equals(task.assigneePersonId());
  }

  private static void requireOwnOrManager(String role, UUID caller, Row task) {
    if (!role.equals("MANAGER") && !isOwn(caller, task)) {
      throw forbidden();
    }
  }

  private static void requireOpen(Row task) {
    if (!"OPEN".equals(task.status())) {
      throw conflict("not_open");
    }
  }

  /**
   * Called by MembershipService, inside its transaction and under its locks, before the membership
   * is deleted: the tasks of the person in that family lose the assignee.
   */
  public void requeue(UUID familyId, UUID personId) {
    Instant now = clock.instant();
    for (UUID taskId : tasks.requeue(familyId, personId, now)) {
      tasks.logChange(familyId, taskId, now);
    }
  }

  // ---------------------------------------------------------------- helpers

  private Result write(java.util.function.Supplier<Result> action) {
    try {
      return action.get();
    } catch (DuplicateKeyException e) {
      String message = String.valueOf(e.getMessage());
      throw conflict(message.contains("applied_mutation") ? "mutation_conflict" : "id_conflict");
    }
  }

  private String lockAsMember(UUID caller, UUID familyId) {
    if (!families.lockFamily(familyId)) {
      throw ApiException.notFound();
    }
    return families.roleIn(familyId, caller).orElseThrow(ApiException::notFound);
  }

  private Row lockTask(UUID familyId, UUID taskId) {
    return tasks.lock(familyId, taskId).orElseThrow(ApiException::notFound);
  }

  private void requireAssignee(UUID familyId, UUID assignee) {
    if (assignee != null && families.roleIn(familyId, assignee).isEmpty()) {
      throw ApiException.badRequest("assignee_invalid");
    }
  }

  /** A member puts herself on her own queued task, or on one that is hers; or empties her own. */
  private static boolean memberMayAssign(UUID caller, Row task, UUID destination) {
    boolean mine = caller.equals(task.assigneePersonId());
    if (destination == null) {
      return mine;
    }
    if (!destination.equals(caller)) {
      return false;
    }
    return mine || (task.assigneePersonId() == null && caller.equals(task.createdBy()));
  }

  private Result applied(
      UUID mutationId, UUID caller, UUID familyId, UUID taskId, String op, boolean created) {
    Instant now = clock.instant();
    tasks.logChange(familyId, taskId, now);
    tasks.recordMutation(mutationId, caller, familyId, taskId, op, now);
    return new Result(view(tasks.find(taskId).orElseThrow()), created);
  }

  /** The same person repeating the same operation on the same entity gets the current state. */
  private Result replay(Applied done, UUID caller, UUID familyId, UUID taskId, String op) {
    if (!done.personId().equals(caller)
        || !done.familyId().equals(familyId)
        || !done.entityId().equals(taskId)
        || !done.op().equals(op)) {
      throw conflict("mutation_conflict");
    }
    return new Result(view(tasks.find(taskId).orElseThrow(ApiException::notFound)), false);
  }

  private static ApiException forbidden() {
    return new ApiException(HttpStatus.FORBIDDEN, "forbidden");
  }

  private static ApiException conflict(String code) {
    return new ApiException(HttpStatus.CONFLICT, code);
  }

  private static UUID uuid(String raw) {
    UUID id = Names.uuidOrNull(raw);
    if (id == null) {
      throw ApiException.badRequest("invalid_request");
    }
    return id;
  }

  private static UUID optionalUuid(String raw) {
    return raw == null ? null : uuid(raw);
  }

  private static String title(String raw) {
    String title = raw == null ? "" : raw.trim();
    if (title.isEmpty() || title.length() > 200 || title.indexOf('\0') >= 0) {
      throw ApiException.badRequest("title_invalid");
    }
    return title;
  }

  private static String notes(String raw) {
    if (raw != null && (raw.length() > 2000 || raw.indexOf('\0') >= 0)) {
      throw ApiException.badRequest("notes_invalid");
    }
    return raw;
  }

  private static String criticality(String raw) {
    if (raw == null) {
      return "NORMAL";
    }
    if (!CRITICALITIES.contains(raw)) {
      throw ApiException.badRequest("criticality_invalid");
    }
    return raw;
  }

  /** A DATE is midnight of that day in the zone of the family; a DATETIME is an ISO instant. */
  private static Instant dueAt(String kind, String due, String zone) {
    if (kind == null && due == null) {
      return null;
    }
    try {
      if ("DATE".equals(kind) && due != null) {
        return LocalDate.parse(due).atStartOfDay(ZoneId.of(zone)).toInstant();
      }
      if ("DATETIME".equals(kind) && due != null && due.endsWith("Z")) {
        return Instant.parse(due);
      }
    } catch (DateTimeParseException e) {
      // falls through to the refusal below
    }
    throw ApiException.badRequest("due_invalid");
  }

  private static View view(Row t) {
    String due = null;
    if (t.dueAt() != null) {
      due =
          t.dueKind().equals("DATE")
              ? t.dueAt().atZone(ZoneId.of(t.timeZone())).toLocalDate().toString()
              : t.dueAt().toString();
    }
    return new View(
        t.id(),
        t.familyId(),
        t.timeZone(),
        t.title(),
        t.notes(),
        t.dueKind(),
        due,
        t.criticality(),
        t.status(),
        t.assigneePersonId(),
        t.createdBy(),
        t.completedBy(),
        t.version(),
        t.updatedAt().toString(),
        Recurrence.toNode(t.recurrence()),
        t.seriesId());
  }
}
