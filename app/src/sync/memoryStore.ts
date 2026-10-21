import { serializeStore } from './serialize';
import type { LocalRow, LocalStore, QueuedMutation, StoreOps } from './types';

type State = { rows: Map<string, LocalRow>; queue: QueuedMutation[]; cursors: Map<string, number> };
export type LocalDump = {
  rows: LocalRow[];
  queue: QueuedMutation[];
  cursors: Record<string, number>;
};

const copy = <T>(value: T): T => structuredClone(value);
const key = (entity: string, id: string) => `${entity}:${id}`;

/** In-memory `LocalStore` for tests (and as the reference of the contract). */
export function createMemoryStore(): LocalStore & { dump(): Promise<LocalDump> } {
  let state: State = { rows: new Map(), queue: [], cursors: new Map() };

  const ops: StoreOps = {
    async getRows(familyId) {
      return [...state.rows.values()].filter((r) => r.familyId === familyId).map(copy);
    },
    async putRow(row) {
      state.rows.set(key(row.entity, row.id), copy(row));
    },
    async deleteRow(familyId, entity, id) {
      const k = key(entity, id);
      if (state.rows.get(k)?.familyId === familyId) state.rows.delete(k);
    },
    async deleteRowsOfTask(familyId, taskId) {
      for (const [k, r] of state.rows) {
        if (r.familyId === familyId && r.taskId === taskId) state.rows.delete(k);
      }
    },
    async getCursor(familyId) {
      return state.cursors.get(familyId);
    },
    async setCursor(familyId, seq) {
      state.cursors.set(familyId, seq);
    },
    async cursorFamilies() {
      return [...state.cursors.keys()];
    },
    async getQueue() {
      return state.queue.map(copy);
    },
    async addToQueue(mutation) {
      state.queue.push(copy(mutation));
    },
    async removeFromQueue(mutationId) {
      state.queue = state.queue.filter((m) => m.mutationId !== mutationId);
    },
    async replaceInQueue(mutation) {
      state.queue = state.queue.map((m) =>
        m.mutationId === mutation.mutationId ? copy(mutation) : m,
      );
    },
    async wipeFamily(familyId) {
      for (const [k, r] of state.rows) if (r.familyId === familyId) state.rows.delete(k);
      state.queue = state.queue.filter((m) => m.familyId !== familyId);
      state.cursors.delete(familyId);
    },
    async clearAll() {
      state = { rows: new Map(), queue: [], cursors: new Map() };
    },
  };

  const serialized = serializeStore(ops, async (fn) => {
    const backup: State = {
      rows: new Map([...state.rows].map(([k, v]) => [k, copy(v)])),
      queue: state.queue.map(copy),
      cursors: new Map(state.cursors),
    };
    try {
      return await fn(ops);
    } catch (error) {
      state = backup;
      throw error;
    }
  });

  return {
    ...serialized,
    async dump() {
      return {
        rows: [...state.rows.values()].map(copy),
        queue: state.queue.map(copy),
        cursors: Object.fromEntries(state.cursors),
      };
    },
  };
}
