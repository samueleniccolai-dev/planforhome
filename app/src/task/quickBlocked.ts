/** A task with mutations still in the offline queue: a direct write would overtake them. */
export function quickBlocked(taskId: string, queue: { taskId: string | null }[]): boolean {
  return queue.some((m) => m.taskId === taskId);
}
