import { createTokenSession, type Credentials, type TokenVault } from '@/api/tokenSession';

import { createSyncEngine } from '../engine';
import { createMemoryStore } from '../memoryStore';
import { createSyncSession } from '../session';
import type { MutationInput } from '../types';

const flush = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r));
};

const mutation = (id: string): MutationInput => ({
  familyId: 'f1',
  entity: 'task',
  entityId: id,
  taskId: null,
  method: 'PUT',
  path: `/api/families/f1/tasks/${id}`,
  body: { title: id },
  patch: { title: id },
});

describe('signIn while another cycle is in flight', () => {
  it('never sends a queued change of the first user with the token of the second', async () => {
    let stored: Credentials | null = { token: 'anna-token', personId: 'anna' };
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const sent: { mutationId?: string; token: string }[] = [];

    const vault: TokenVault = {
      // A slow read: the session is read again after the first one has been taken.
      async get() {
        await flush(3);
        return stored;
      },
      async set(credentials) {
        stored = credentials;
        if (credentials.personId === 'luca') release();
      },
      async clear() {
        stored = null;
      },
    };
    const fetch = async (
      input: string,
      init?: { headers: Record<string, string>; body?: string },
    ) => {
      const body = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      const token = (init?.headers.Authorization ?? '').replace('Bearer ', '');
      if (input.endsWith('/api/auth/login')) {
        return new Response(JSON.stringify({ token: 'luca-token', personId: 'luca' }), {
          status: 200,
        });
      }
      if (typeof body.mutationId === 'string') {
        sent.push({ mutationId: body.mutationId, token });
        if (body.mutationId === 'm1') await held;
      }
      return new Response(input === '/api/families' ? '[]' : '{}', { status: 200 });
    };
    const quiet = {
      setTimeout: () => 0,
      clearTimeout: () => {},
      setInterval: () => 0,
      clearInterval: () => {},
    };
    const auth = createTokenSession({ vault, fetch, baseUrl: '', timers: quiet, timeoutMs: 1 });

    const waits: (() => void)[] = [];
    const timers = {
      setTimeout: (fn: () => void) => waits.push(fn),
      clearTimeout: () => {},
      setInterval: () => 0,
      clearInterval: () => {},
    };
    const ids = ['m1', 'm2'];
    const store = createMemoryStore();
    const engine = createSyncEngine({ store, http: auth.http, newId: () => ids.shift() as string });
    await engine.enqueue(mutation('a'));
    await engine.enqueue(mutation('b'));
    const session = createSyncSession({
      engine,
      auth,
      timers,
      appState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
      onUnauthorized: () => {},
    });

    await session.start();
    await flush();
    expect(sent.map((s) => s.mutationId)).toEqual(['m1']);

    const signIn = session.signIn('luca@example.test', 'pw');
    await flush();
    waits.forEach((fn) => fn()); // the 5 s limit of the wait expires: m1 is still held
    await signIn;
    await flush();

    expect(sent.filter((s) => s.token === 'luca-token')).toEqual([]);
    expect(sent.some((s) => s.mutationId === 'm2')).toBe(false);
  });
});

describe('signIn while a long cycle outlives the wait', () => {
  it('never sends a third change with the token of the second user', async () => {
    let stored: Credentials | null = { token: 'anna-token', personId: 'anna' };
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => (releaseGate = resolve));
    let releaseLuca!: () => void;
    const lucaIn = new Promise<void>((resolve) => (releaseLuca = resolve));
    const sent: { mutationId?: string; token: string }[] = [];

    const vault: TokenVault = {
      async get() {
        return stored;
      },
      async set(credentials) {
        stored = credentials;
        if (credentials.personId === 'luca') releaseLuca();
      },
      async clear() {
        stored = null;
      },
    };
    const fetch = async (
      input: string,
      init?: { headers: Record<string, string>; body?: string },
    ) => {
      const body = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      const token = (init?.headers.Authorization ?? '').replace('Bearer ', '');
      if (input.endsWith('/api/auth/login')) {
        return new Response(JSON.stringify({ token: 'luca-token', personId: 'luca' }), {
          status: 200,
        });
      }
      if (typeof body.mutationId === 'string') {
        sent.push({ mutationId: body.mutationId, token });
        if (body.mutationId === 'm2') await lucaIn;
      }
      return new Response(input === '/api/families' ? '[]' : '{}', { status: 200 });
    };
    const quiet = {
      setTimeout: () => 0,
      clearTimeout: () => {},
      setInterval: () => 0,
      clearInterval: () => {},
    };
    const auth = createTokenSession({ vault, fetch, baseUrl: '', timers: quiet, timeoutMs: 1 });

    const waits: (() => void)[] = [];
    const timers = {
      setTimeout: (fn: () => void) => waits.push(fn),
      clearTimeout: () => {},
      setInterval: () => 0,
      clearInterval: () => {},
    };
    const ids = ['m1', 'm2', 'm3'];
    const base = createMemoryStore();
    let first = false;
    let session!: ReturnType<typeof createSyncSession>;
    const store = {
      ...base,
      // A slow wipe: the answer of m2 is handled before the old user's data is cleared.
      clearAll: async () => {
        await flush(20);
        return base.clearAll();
      },
      transaction: async <T>(fn: Parameters<typeof base.transaction<T>>[0]) => {
        if (first) {
          first = false;
          void session.signIn('luca@example.test', 'pw');
          await gate;
        }
        return base.transaction(fn);
      },
    };
    const engine = createSyncEngine({ store, http: auth.http, newId: () => ids.shift() as string });
    for (const id of ['a', 'b', 'c']) await engine.enqueue(mutation(id));
    first = true; // the first transaction from now on is the one of m1
    session = createSyncSession({
      engine,
      auth,
      timers,
      appState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
      onUnauthorized: () => {},
    });

    await session.start();
    await flush();
    releaseGate(); // m2 leaves with the token of the first user and is held
    await flush(30);
    waits.forEach((fn) => fn()); // the 5 s limit expires while m2 is still held
    await flush(30);

    expect(sent.filter((s) => s.token === 'luca-token')).toEqual([]);
  });
});
