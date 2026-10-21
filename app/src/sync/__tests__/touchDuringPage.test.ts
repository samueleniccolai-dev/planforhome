import { createSyncEngine } from '../engine';
import { createMemoryStore } from '../memoryStore';
import type { Http, MutationInput } from '../types';

const touch: MutationInput = {
  familyId: 'f1',
  entity: 'task',
  entityId: 't1',
  taskId: null,
  method: 'PUT',
  path: '/api/families/f1/tasks/t1',
  body: { title: 'x' },
  patch: { title: 'x' },
};

describe('touch while a page is being applied', () => {
  it('keeps the queued change when the page fails', async () => {
    const memory = createMemoryStore();
    await memory.setCursor('f1', 5);
    let pending: Promise<unknown> | undefined;
    let engine!: ReturnType<typeof createSyncEngine>;
    const store = {
      ...memory,
      transaction: <T>(fn: Parameters<typeof memory.transaction<T>>[0]) =>
        memory.transaction(async (tx) => {
          pending = engine.enqueue(touch);
          return fn(tx);
        }),
    };
    const http: Http = async ({ path }) =>
      path === '/api/families'
        ? { status: 200, body: [{ id: 'f1' }] }
        : { status: 200, body: { changes: null, lastSeq: 99 } };
    engine = createSyncEngine({ store, http });
    await expect(engine.sync()).rejects.toThrow();
    await pending;
    expect(await memory.getQueue()).toHaveLength(1);
  });
});
