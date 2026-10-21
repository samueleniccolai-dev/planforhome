import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { serializeStore } from './serialize';
import type { LocalRow, LocalStore, QueuedMutation, StoreOps } from './types';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sync_rows (
  entity TEXT NOT NULL, id TEXT NOT NULL, family_id TEXT NOT NULL, task_id TEXT, data TEXT NOT NULL,
  PRIMARY KEY (entity, id));
CREATE INDEX IF NOT EXISTS sync_rows_family ON sync_rows (family_id);
CREATE INDEX IF NOT EXISTS sync_rows_task ON sync_rows (task_id);
CREATE TABLE IF NOT EXISTS sync_cursors (family_id TEXT PRIMARY KEY, seq INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sync_queue (
  position INTEGER PRIMARY KEY AUTOINCREMENT, mutation_id TEXT NOT NULL UNIQUE,
  family_id TEXT NOT NULL, mutation TEXT NOT NULL);
`;

function opsOn(db: SQLiteDatabase): StoreOps {
  return {
    async getRows(familyId) {
      const rows = await db.getAllAsync<{
        entity: LocalRow['entity'];
        id: string;
        task_id: string | null;
        data: string;
      }>('SELECT entity, id, task_id, data FROM sync_rows WHERE family_id = ?', familyId);
      return rows.map((r) => ({
        entity: r.entity,
        id: r.id,
        familyId,
        taskId: r.task_id,
        data: JSON.parse(r.data),
      }));
    },
    async putRow(row) {
      await db.runAsync(
        'INSERT OR REPLACE INTO sync_rows (entity, id, family_id, task_id, data) VALUES (?, ?, ?, ?, ?)',
        row.entity,
        row.id,
        row.familyId,
        row.taskId,
        JSON.stringify(row.data),
      );
    },
    async deleteRow(entity, id) {
      await db.runAsync('DELETE FROM sync_rows WHERE entity = ? AND id = ?', entity, id);
    },
    async deleteRowsOfTask(taskId) {
      await db.runAsync('DELETE FROM sync_rows WHERE task_id = ?', taskId);
    },
    async getCursor(familyId) {
      const r = await db.getFirstAsync<{ seq: number }>(
        'SELECT seq FROM sync_cursors WHERE family_id = ?',
        familyId,
      );
      return r?.seq;
    },
    async setCursor(familyId, seq) {
      await db.runAsync(
        'INSERT OR REPLACE INTO sync_cursors (family_id, seq) VALUES (?, ?)',
        familyId,
        seq,
      );
    },
    async cursorFamilies() {
      const rows = await db.getAllAsync<{ family_id: string }>(
        'SELECT family_id FROM sync_cursors',
      );
      return rows.map((r) => r.family_id);
    },
    async getQueue() {
      const rows = await db.getAllAsync<{ mutation: string }>(
        'SELECT mutation FROM sync_queue ORDER BY position',
      );
      return rows.map((r) => JSON.parse(r.mutation) as QueuedMutation);
    },
    async addToQueue(m) {
      await db.runAsync(
        'INSERT INTO sync_queue (mutation_id, family_id, mutation) VALUES (?, ?, ?)',
        m.mutationId,
        m.familyId,
        JSON.stringify(m),
      );
    },
    async removeFromQueue(mutationId) {
      await db.runAsync('DELETE FROM sync_queue WHERE mutation_id = ?', mutationId);
    },
    async wipeFamily(familyId) {
      await db.runAsync('DELETE FROM sync_rows WHERE family_id = ?', familyId);
      await db.runAsync('DELETE FROM sync_queue WHERE family_id = ?', familyId);
      await db.runAsync('DELETE FROM sync_cursors WHERE family_id = ?', familyId);
    },
    async clearAll() {
      await db.execAsync(
        'DELETE FROM sync_rows; DELETE FROM sync_queue; DELETE FROM sync_cursors;',
      );
    },
  };
}

/** Android only: the local database of SPEC §4 and §7 (the web stays online). */
export async function openSqliteStore(name = 'planforhome-sync.db'): Promise<LocalStore> {
  const db = await openDatabaseAsync(name);
  await db.execAsync(SCHEMA);
  const ops = opsOn(db);
  return serializeStore(ops, async <T>(fn: (tx: StoreOps) => Promise<T>) => {
    let result!: T;
    await db.withExclusiveTransactionAsync(async (txn) => {
      result = await fn(opsOn(txn));
    });
    return result;
  });
}
