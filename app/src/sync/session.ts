import type { LoginOutcome, Timers, TokenSession } from '@/api/tokenSession';

import type { SyncResult } from './types';

const INTERVAL_MS = 60_000;
const SIGN_OUT_WAIT_MS = 5_000;

type Engine = { sync(): Promise<SyncResult>; clear(): Promise<void> };

type AppStateLike = {
  currentState?: string | null;
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void };
};

type Options = {
  engine: Engine;
  auth: TokenSession;
  timers: Timers;
  appState: AppStateLike;
  onUnauthorized: () => void;
  /** Told the result of every cycle (the screens read the notices from it). */
  onCycle?: (result: SyncResult) => void;
};

/** Life cycle of the sync engine: start, after each write, every 60 s in the foreground. */
export function createSyncSession({
  engine,
  auth,
  timers,
  appState,
  onUnauthorized,
  onCycle,
}: Options) {
  let active = false;
  let interval: unknown;
  let listener: { remove(): void } | undefined;
  let running: Promise<void> | undefined;
  let dirty = false;
  // Bumped by `stop()`: a `start()` that was waiting for the vault finds it changed and gives up.
  let epoch = 0;

  const stopTimers = () => {
    if (interval !== undefined) timers.clearInterval(interval);
    interval = undefined;
  };

  function stop() {
    active = false;
    epoch++;
    stopTimers();
    listener?.remove();
    listener = undefined;
  }

  /** Waits for the cycle in flight, at most `SIGN_OUT_WAIT_MS`. */
  async function settle() {
    if (!running) return;
    let timer: unknown;
    const limit = new Promise<void>((resolve) => {
      timer = timers.setTimeout(resolve, SIGN_OUT_WAIT_MS);
    });
    await Promise.race([running, limit]);
    timers.clearTimeout(timer);
  }

  async function loop() {
    do {
      dirty = false;
      auth.beginCycle();
      const result = await engine.sync().catch(() => undefined);
      auth.endCycle();
      if (result && active) onCycle?.(result);
      if (result?.status === 'unauthorized' && active) {
        stop();
        onUnauthorized();
      }
    } while (dirty && active);
  }

  /** A request during a cycle marks it dirty: one more cycle follows, at once. */
  function cycle(markDirty: boolean) {
    if (!active) return;
    if (running) {
      if (markDirty) dirty = true;
      return;
    }
    running = loop().finally(() => {
      running = undefined;
    });
  }

  function startInterval() {
    stopTimers();
    interval = timers.setInterval(() => cycle(false), INTERVAL_MS);
  }

  async function start() {
    if (active) return;
    active = true;
    const mine = epoch;
    const credentials = await auth.current();
    if (mine !== epoch) return;
    if (!credentials) {
      active = false;
      return;
    }
    listener = appState.addEventListener('change', (state) => {
      if (state === 'active') {
        cycle(true);
        startInterval();
      } else stopTimers();
    });
    if ((appState.currentState ?? 'active') === 'active') startInterval();
    cycle(true);
  }

  return {
    start,
    stop,
    afterWrite: () => cycle(true),

    async signIn(email: string, password: string): Promise<LoginOutcome> {
      const before = await auth.current();
      // The cycle of the old user must not read the new token: stop it before the vault changes.
      auth.invalidate();
      stop();
      await settle();
      const outcome = await auth.login(email, password);
      if (outcome !== 'ok') {
        if (before) await start();
        return outcome;
      }
      const now = await auth.current();
      if (!before || before.personId !== now?.personId) await engine.clear();
      await start();
      return outcome;
    },

    async signOut() {
      stop();
      await auth.logout();
      await settle();
      await engine.clear();
    },
  };
}
