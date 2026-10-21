package com.planforhome.shopping;

import com.planforhome.account.AuthUser;
import com.planforhome.shopping.ShoppingService.Added;
import com.planforhome.shopping.ShoppingService.Item;
import com.planforhome.task.TaskController.MutationBody;
import java.util.List;
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
public class ShoppingController {

  public record AddBody(String mutationId, String id, String text) {}

  public record CheckBody(String mutationId, Boolean checked) {}

  public record OrderBody(String mutationId, List<String> itemIds) {}

  private static final String BASE = "/api/families/{familyId}/tasks/{taskId}/items";

  private final ShoppingService service;

  public ShoppingController(ShoppingService service) {
    this.service = service;
  }

  @GetMapping(BASE)
  public List<Item> list(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId) {
    return service.list(user.personId(), familyId, taskId);
  }

  @PostMapping(BASE)
  public ResponseEntity<Item> add(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId,
      @RequestBody AddBody body) {
    Added added =
        service.add(user.personId(), familyId, taskId, body.mutationId(), body.id(), body.text());
    return ResponseEntity.status(added.created() ? HttpStatus.CREATED : HttpStatus.OK)
        .body(added.item());
  }

  @PutMapping(BASE + "/{itemId}/checked")
  public Item check(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId,
      @PathVariable UUID itemId,
      @RequestBody CheckBody body) {
    return service.check(
        user.personId(), familyId, taskId, itemId, body.mutationId(), body.checked());
  }

  @PostMapping(BASE + "/{itemId}/remove")
  public Item remove(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId,
      @PathVariable UUID itemId,
      @RequestBody MutationBody body) {
    return service.remove(user.personId(), familyId, taskId, itemId, body.mutationId());
  }

  @PostMapping(BASE + "/{itemId}/restore")
  public Item restore(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId,
      @PathVariable UUID itemId,
      @RequestBody MutationBody body) {
    return service.restore(user.personId(), familyId, taskId, itemId, body.mutationId());
  }

  @PutMapping(BASE + "/order")
  public List<Item> order(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId,
      @RequestBody OrderBody body) {
    return service.order(user.personId(), familyId, taskId, body.mutationId(), body.itemIds());
  }

  @PostMapping(BASE + "/clear-checked")
  public List<Item> clearChecked(
      @AuthenticationPrincipal AuthUser user,
      @PathVariable UUID familyId,
      @PathVariable UUID taskId,
      @RequestBody MutationBody body) {
    return service.clearChecked(user.personId(), familyId, taskId, body.mutationId());
  }
}
