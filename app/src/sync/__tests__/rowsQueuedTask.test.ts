import { createSyncEngine } from '../engine';
import { createMemoryStore } from '../memoryStore';
import type { Http, MutationInput } from '../types';

const post = (entityId: string, patch: Record<string, unknown>): MutationInput => ({
  familyId: 'f1',
  entity: 'task',
  entityId,
  taskId: null,
  method: 'POST',
  path: '/api/families/f1/tasks',
  body: patch,
  patch,
});

describe('rows with queued creations of unknown tasks', () => {
  it('shows a queued new task only when its patch carries a title', async () => {
    const http: Http = async () => ({ status: 200, body: [] });
    const engine = createSyncEngine({ store: createMemoryStore(), http });
    await engine.enqueue(post('with-title', { title: 'Buy milk' }));
    await engine.enqueue(post('no-title', { status: 'DONE' }));
    const ids = (await engine.rows('f1')).map((r) => r.id);
    expect(ids).toEqual(['with-title']);
  });
});
