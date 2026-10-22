import { createSyncSession } from '../session';

const flush = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r));
};

describe('start() and stop() while the vault is being read', () => {
  it('start, stop, start leaves a single AppState listener', async () => {
    let live = 0;
    const appState = {
      currentState: 'active',
      addEventListener: () => {
        live++;
        return { remove: () => void live-- };
      },
    };
    const auth = {
      beginCycle: () => {},
      endCycle: () => {},
      current: async () => {
        await flush(3);
        return { token: 't', personId: 'p' };
      },
    };
    const timers = {
      setTimeout: () => 0,
      clearTimeout: () => {},
      setInterval: () => 0,
      clearInterval: () => {},
    };
    const engine = {
      sync: async () => ({ status: 'ok' as const, notices: [] }),
      clear: async () => {},
    };
    const session = createSyncSession({
      engine,
      auth: auth as never,
      timers,
      appState,
      onUnauthorized: () => {},
    });
    const first = session.start();
    session.stop();
    const second = session.start();
    await Promise.all([first, second]);
    await flush();
    expect(live).toBe(1);
    session.stop();
    expect(live).toBe(0);
  });

  it('start then stop leaves no listener', async () => {
    let live = 0;
    const appState = {
      addEventListener: () => {
        live++;
        return { remove: () => void live-- };
      },
    };
    const auth = {
      current: async () => ({ token: 't', personId: 'p' }),
      beginCycle: () => {},
      endCycle: () => {},
    };
    const timers = {
      setTimeout: () => 0,
      clearTimeout: () => {},
      setInterval: () => 0,
      clearInterval: () => {},
    };
    const engine = {
      sync: async () => ({ status: 'ok' as const, notices: [] }),
      clear: async () => {},
    };
    const session = createSyncSession({
      engine,
      auth: auth as never,
      timers,
      appState,
      onUnauthorized: () => {},
    });
    const started = session.start();
    session.stop();
    await started;
    expect(live).toBe(0);
  });
});
