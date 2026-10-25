import type { Rule } from '@/task/recurrence';
import type { MutationInput } from '@/sync/types';

const tasksPath = (familyId: string) => `/api/families/${encodeURIComponent(familyId)}/tasks`;
const taskPath = (familyId: string, taskId: string) =>
  `${tasksPath(familyId)}/${encodeURIComponent(taskId)}`;

type Base = { familyId: string; taskId: string };

/** Every change of a task carries the task as `entityId` and as `taskId` (`isBlocked`). */
function change(
  input: Base,
  method: MutationInput['method'],
  path: string,
  body: Record<string, unknown>,
  patch: Record<string, unknown>,
): MutationInput {
  return {
    familyId: input.familyId,
    entity: 'task',
    entityId: input.taskId,
    taskId: input.taskId,
    method,
    path,
    body,
    patch,
  };
}

export function createTaskMutation(
  input: Base & {
    me: string;
    title: string;
    dueKind?: 'DATE' | 'DATETIME';
    due?: string;
    criticality?: 'LOW' | 'NORMAL' | 'HIGH';
    recurrence?: Rule;
    template?: 'SHOPPING_LIST';
  },
): MutationInput {
  const { familyId, taskId, title, dueKind, due, recurrence, template } = input;
  const criticality = input.criticality ?? 'NORMAL';
  const body: Record<string, unknown> = { id: taskId, title };
  if (dueKind && due) Object.assign(body, { dueKind, due });
  if (criticality !== 'NORMAL') body.criticality = criticality;
  if (recurrence) body.recurrence = recurrence;
  if (template) body.template = template;
  const patch = {
    id: taskId,
    familyId,
    title,
    dueKind: dueKind ?? null,
    due: due ?? null,
    criticality,
    status: 'OPEN',
    assigneePersonId: null,
    createdBy: input.me,
    template: template ?? 'NONE',
    version: 0,
  };
  return change(input, 'POST', tasksPath(familyId), body, patch);
}

export function assignTaskMutation(input: Base & { assigneePersonId: string | null }) {
  const { assigneePersonId } = input;
  const path = `${taskPath(input.familyId, input.taskId)}/assignee`;
  return change(input, 'PUT', path, { assigneePersonId }, { assigneePersonId });
}

export function takeTaskMutation(input: Base & { me: string }) {
  const path = `${taskPath(input.familyId, input.taskId)}/take`;
  return change(input, 'POST', path, {}, { assigneePersonId: input.me });
}

export function completeTaskMutation(input: Base & { me: string }) {
  const path = `${taskPath(input.familyId, input.taskId)}/done`;
  return change(input, 'POST', path, {}, { status: 'DONE', completedBy: input.me });
}

/** The task leaves the family at once; it shows up in the other one after the sync (P11). */
export function forwardTaskMutation(input: Base & { toFamilyId: string }) {
  const path = `${taskPath(input.familyId, input.taskId)}/forward`;
  return change(
    input,
    'POST',
    path,
    { toFamilyId: input.toFamilyId },
    { forwardedTo: input.toFamilyId },
  );
}
