import type { TokenSession } from '@/api/tokenSession';

import type { createSyncEngine } from './engine';
import type { createSyncSession } from './session';
import type { SyncResult } from './types';

export type Runtime = {
  engine: ReturnType<typeof createSyncEngine>;
  session: ReturnType<typeof createSyncSession>;
  auth: TokenSession;
  /** Every cycle result, to the screens that show the local data. Returns the way to stop. */
  subscribe(listener: (result: SyncResult) => void): () => void;
};

/** Web: online only, cookie session, no engine. Android has `runtime.native.ts`. */
export async function getRuntime(): Promise<Runtime | undefined> {
  return undefined;
}
