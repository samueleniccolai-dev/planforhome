import { router } from 'expo-router';
import { AppState } from 'react-native';

import { setTransport } from '@/api/client';
import { createTokenSession } from '@/api/tokenSession';
import { secureVault } from '@/api/vault.native';
import { createPush } from '@/push/push';

import { createSyncEngine } from './engine';
import type { Runtime } from './runtime';
import { createSyncSession } from './session';
import { openSqliteStore } from './sqliteStore';
import type { SyncResult } from './types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://app.planforhome.com';
const TIMEOUT_MS = 15_000;

let runtime: Promise<Runtime> | undefined;

/** Android: local database, token session and sync session, built once. */
export function getRuntime(): Promise<Runtime> {
  runtime ??= (async () => {
    const timers = { setTimeout, clearTimeout, setInterval, clearInterval };
    const auth = createTokenSession({
      vault: secureVault,
      fetch: (input, init) => fetch(input, init),
      baseUrl: BASE_URL,
      timers,
      timeoutMs: TIMEOUT_MS,
    });
    setTransport(auth.http);
    const engine = createSyncEngine({ store: await openSqliteStore(), http: auth.http });
    const listeners = new Set<(result: SyncResult) => void>();
    const session = createSyncSession({
      engine,
      auth,
      timers,
      appState: AppState,
      push: createPush(auth),
      onUnauthorized: () => router.replace('/login'),
      onCycle: (result) => listeners.forEach((listener) => listener(result)),
    });
    const subscribe = (listener: (result: SyncResult) => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    };
    return { engine, session, auth, subscribe };
  })();
  return runtime;
}
