import { createMemoryStore } from '../memoryStore';
import type { LocalRow } from '../types';

const row = (id: string): LocalRow => ({
  entity: 'task',
  id,
  familyId: 'f1',
  taskId: null,
  data: { title: id },
});

describe('memory store', () => {
  it('keeps nothing of a transaction whose function throws', async () => {
    const store = createMemoryStore();
    await store.putRow(row('a'));
    await expect(
      store.transaction(async (tx) => {
        await tx.putRow(row('b'));
        await tx.setCursor('f1', 9);
        throw new Error('page lost');
      }),
    ).rejects.toThrow('page lost');
    expect(await store.dump()).toEqual({ rows: [row('a')], queue: [], cursors: {} });
  });

  it('keeps a transaction that completes', async () => {
    const store = createMemoryStore();
    await store.transaction(async (tx) => {
      await tx.putRow(row('b'));
      await tx.setCursor('f1', 3);
    });
    expect(await store.dump()).toEqual({ rows: [row('b')], queue: [], cursors: { f1: 3 } });
  });

  it('deletes the rows of a task, and wipes a family', async () => {
    const store = createMemoryStore();
    await store.putRow(row('t'));
    await store.putRow({ ...row('i'), entity: 'shopping_item', taskId: 't' });
    await store.deleteRowsOfTask('t');
    expect((await store.dump()).rows.map((r) => r.id)).toEqual(['t']);
    await store.setCursor('f1', 1);
    await store.wipeFamily('f1');
    expect(await store.dump()).toEqual({ rows: [], queue: [], cursors: {} });
  });
});
