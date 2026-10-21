export type EntityKind = 'task' | 'shopping_item';

/** `data` has the shape of the snapshot / changes payload (round 023). */
export type LocalRow = {
  entity: EntityKind;
  id: string;
  familyId: string;
  taskId: string | null;
  data: Record<string, unknown>;
};

export type MutationInput = {
  familyId: string;
  entity: EntityKind;
  entityId: string;
  taskId: string | null;
  method: 'POST' | 'PUT';
  path: string;
  /** Sent as `{ ...body, mutationId }`. */
  body: Record<string, unknown>;
  /** Laid over `data` while the mutation is queued. */
  patch: Record<string, unknown>;
};

export type QueuedMutation = MutationInput & { mutationId: string };

export type SyncNotice = {
  kind: 'conflict' | 'forbidden' | 'notFound' | 'invalid';
  familyId: string;
  entity: EntityKind;
  entityId: string;
  mutationId: string;
};

export type SyncResult = {
  status: 'ok' | 'offline' | 'unauthorized' | 'retry';
  notices: SyncNotice[];
};

/** Rejects when the network is down. */
export type Http = (request: {
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  body?: unknown;
}) => Promise<{ status: number; body: unknown }>;

export type StoreOps = {
  getRows(familyId: string): Promise<LocalRow[]>;
  putRow(row: LocalRow): Promise<void>;
  deleteRow(entity: EntityKind, id: string): Promise<void>;
  deleteRowsOfTask(taskId: string): Promise<void>;
  getCursor(familyId: string): Promise<number | undefined>;
  setCursor(familyId: string, seq: number): Promise<void>;
  cursorFamilies(): Promise<string[]>;
  getQueue(): Promise<QueuedMutation[]>;
  addToQueue(mutation: QueuedMutation): Promise<void>;
  removeFromQueue(mutationId: string): Promise<void>;
  /** Rows, queue and cursor of one family. */
  wipeFamily(familyId: string): Promise<void>;
  clearAll(): Promise<void>;
};

export type LocalStore = StoreOps & {
  /** All or nothing: if `fn` throws, nothing it wrote is kept. */
  transaction<T>(fn: (tx: StoreOps) => Promise<T>): Promise<T>;
};
