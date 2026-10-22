import { createTokenSession, type Credentials, type TokenVault } from '@/api/tokenSession';

import { createSyncEngine } from '../engine';
import { createMemoryStore } from '../memoryStore';
import { createSyncSession } from '../session';

const flush = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r));
};

describe('an answer already produced by the server, delivered after signOut', () => {
  it('leaves the store and the cursors empty', async () => {
    let stored: Credentials | null = { token: 'anna-token', personId: 'anna' };
    const vault: TokenVault = {
      get: async () => stored,
      set: async (c) => void (stored = c),
      clear: async () => void (stored = null),
    };
    // The server built this answer before the sign-out; the network delivers it afterwards.
    const produced = JSON.stringify({
      seq: 7,
      tasks: [{ id: 't1', title: 'Spesa sabato' }],
      shoppingItems: [],
    });
    let deliver!: () => void;
    const late = new Promise<void>((resolve) => (deliver = resolve));
    const fetch = async (input: string) => {
      if (input === '/api/families') return new Response('[{"id":"f1"}]', { status: 200 });
      if (input.includes('/snapshot')) {
        await late;
        return new Response(produced, { status: 200 });
      }
      return new Response('{}', { status: 200 });
    };
    const quiet = {
      setTimeout: () => 0,
      clearTimeout: () => {},
      setInterval: () => 0,
      clearInterval: () => {},
    };
    const waits: (() => void)[] = [];
    const timers = { ...quiet, setTimeout: (fn: () => void) => waits.push(fn) };
    const auth = createTokenSession({ vault, fetch, baseUrl: '', timers: quiet, timeoutMs: 1 });
    const store = createMemoryStore();
    const engine = createSyncEngine({ store, http: auth.http });
    const session = createSyncSession({
      engine,
      auth,
      timers,
      appState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
      onUnauthorized: () => {},
    });

    await session.start();
    await flush();
    const out = session.signOut();
    await flush();
    waits.forEach((fn) => fn());
    await out;
    deliver();
    await flush();

    expect(await store.dump()).toEqual({ rows: [], queue: [], cursors: {} });
  });
});
