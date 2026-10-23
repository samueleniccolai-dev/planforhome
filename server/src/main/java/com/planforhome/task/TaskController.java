package com.planforhome.task;

import com.planforhome.account.AuthUser;
import com.planforhome.task.TaskService.AlreadyTaken;
import com.planforhome.task.TaskService.Edit;
import com.planforhome.task.TaskService.NewTask;
import com.planforhome.task.TaskService.Result;
import com.planforhome.task.TaskService.VersionConflict;
import com.planforhome.task.TaskService.View;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TaskController {

  public record AssigneeBody(String mutationId, String assigneePersonId) {}

  public record ForwardBody(String mutationId, String toFamilyId) {}

  public record MutationBody(String mutationId) {}

  private final TaskService service;

  public TaskController(TaskService service) {
    this.service = service;
  }

  @GetMapping("/api/families/{familyId}/tasks")
  public List<View> ofFamily(@AuthenticationPrincipal AuthUser user, @PathVariable UUID familyId) {
    return service.ofFamily(user.personId(), familyId);
  }

  @GetMapping("/api/tasks")
  public List<View> mine(@AuthenticationPrincipal AuthUser user) {
    return service.ofPerson(user.personId());
  }

  @PostMapping("/api/families/{familyId}/tasks")
  public ResponseEntity<View> create(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @RequestBody NewTask body) {
    Result result = service.create(user.personId(), familyId, body);
    return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK)
        .body(result.task());
  }

  @PutMapping("/api/families/{familyId}/tasks/{taskId}/assignee")
  public View assign(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId,
      @RequestBody AssigneeBody body) {
    return service
        .setAssignee(user.personId(), familyId, taskId, body.mutationId(), body.assigneePersonId())
        .task();
  }

  @PostMapping("/api/families/{familyId}/tasks/{taskId}/take")
  public ResponseEntity<?> take(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId,
      @RequestBody MutationBody body) {
    try {
      return ResponseEntity.ok(
          service.take(user.personId(), familyId, taskId, body.mutationId()).task());
    } catch (AlreadyTaken e) {
      Map<String, Object> answer = new LinkedHashMap<>();
      answer.put("error", "already_taken");
      answer.put("assigneePersonId", e.assigneeId());
      answer.put("assigneeName", e.assigneeName());
      return ResponseEntity.status(HttpStatus.CONFLICT).body(answer);
    }
  }

  @PostMapping("/api/families/{familyId}/tasks/{taskId}/done")
  public View done(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId,
      @RequestBody MutationBody body) {
    return service.done(user.personId(), familyId, taskId, body.mutationId()).task();
  }

  @PostMapping("/api/families/{familyId}/tasks/{taskId}/reopen")
  public View reopen(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId,
      @RequestBody MutationBody body) {
    return service.reopen(user.personId(), familyId, taskId, body.mutationId()).task();
  }

  @PostMapping("/api/families/{familyId}/tasks/{taskId}/cancel")
  public View cancel(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId,
      @RequestBody MutationBody body) {
    return service.cancel(user.personId(), familyId, taskId, body.mutationId()).task();
  }

  @PostMapping("/api/families/{familyId}/tasks/{taskId}/nudge")
  public View nudge(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId,
      @RequestBody MutationBody body) {
    return service.nudge(user.personId(), familyId, taskId, body.mutationId()).task();
  }

  @PostMapping("/api/families/{familyId}/tasks/{taskId}/forward")
  public View forward(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId,
      @RequestBody ForwardBody body) {
    return service
        .forward(user.personId(), familyId, taskId, body.mutationId(), body.toFamilyId())
        .task();
  }

  @PostMapping("/api/families/{familyId}/tasks/{taskId}/end-series")
  public View endSeries(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId,
      @RequestBody MutationBody body) {
    return service.endSeries(user.personId(), familyId, taskId, body.mutationId()).task();
  }

  @PutMapping("/api/families/{familyId}/tasks/{taskId}")
  public ResponseEntity<?> update(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId,
      @RequestBody Edit body) {
    try {
      return ResponseEntity.ok(service.update(user.personId(), familyId, taskId, body).task());
    } catch (VersionConflict e) {
      Map<String, Object> answer = new LinkedHashMap<>();
      answer.put("error", "version_conflict");
      answer.put("current", e.current());
      return ResponseEntity.status(HttpStatus.CONFLICT).body(answer);
    }
  }
}
