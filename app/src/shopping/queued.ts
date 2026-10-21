import type { MutationInput } from '@/sync/types';

const itemsPath = (familyId: string, taskId: string) =>
  `/api/families/${encodeURIComponent(familyId)}/tasks/${encodeURIComponent(taskId)}/items`;

/** Check or uncheck one item, to be queued while offline. */
export function checkItemMutation(input: {
  familyId: string;
  taskId: string;
  itemId: string;
  checked: boolean;
}): MutationInput {
  return {
    familyId: input.familyId,
    entity: 'shopping_item',
    entityId: input.itemId,
    taskId: input.taskId,
    method: 'PUT',
    path: `${itemsPath(input.familyId, input.taskId)}/${input.itemId}/checked`,
    body: { checked: input.checked },
    patch: { checked: input.checked },
  };
}

/** Add one item, with an id made by the client. */
export function addItemMutation(input: {
  familyId: string;
  taskId: string;
  itemId: string;
  text: string;
}): MutationInput {
  return {
    familyId: input.familyId,
    entity: 'shopping_item',
    entityId: input.itemId,
    taskId: input.taskId,
    method: 'POST',
    path: itemsPath(input.familyId, input.taskId),
    body: { id: input.itemId, text: input.text },
    patch: { taskId: input.taskId, text: input.text, checked: false },
  };
}
