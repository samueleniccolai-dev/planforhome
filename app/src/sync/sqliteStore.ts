import { openDatabaseAsync } from 'expo-sqlite';

import { createSqlStore } from './sqlStore';
import type { LocalStore } from './types';

/** Android only: the local database of SPEC §4 and §7 (the web stays online). */
export async function openSqliteStore(name = 'planforhome-sync.db'): Promise<LocalStore> {
  return createSqlStore(await openDatabaseAsync(name));
}
