export type EntityKind = 'task' | 'shopping_item';

/** What the store keeps: the rows of the list plus the local directory (families, members). */
export type StoredEntity = EntityKind | 'family' | 'member';

/** `data` has the shape of the snapshot / changes payload (round 023). */
export type LocalRow = {
  entity: EntityKind;
  id: string;
  familyId: string;
  taskId: string | null;
  data: Record<string, unknown>;
};

export type StoredRow = Omit<LocalRow, 'entity'> & { entity: StoredEntity };

export type FamilyEntry = {
  id: string;
  name: string;
  timeZone: string;
  role: 'MANAGER' | 'MEMBER';
};
export type Member = { personId: string; displayName: string; role: 'MANAGER' | 'MEMBER' };
export type Directory = { family?: FamilyEntry; members: Member[] };

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
  /** Path of the change that was refused. */
  path: string;
  /** Body of the answer, kept on a 409. */
  detail?: Record<string, unknown>;
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
  getRows(familyId: string): Promise<StoredRow[]>;
  putRow(row: StoredRow): Promise<void>;
  deleteRow(familyId: string, entity: StoredEntity, id: string): Promise<void>;
  deleteRowsOfTask(familyId: string, taskId: string): Promise<void>;
  getCursor(familyId: string): Promise<number | undefined>;
  setCursor(familyId: string, seq: number): Promise<void>;
  cursorFamilies(): Promise<string[]>;
  getQueue(): Promise<QueuedMutation[]>;
  addToQueue(mutation: QueuedMutation): Promise<void>;
  removeFromQueue(mutationId: string): Promise<void>;
  /** Same position in the queue, new content (matched by `mutationId`). */
  replaceInQueue(mutation: QueuedMutation): Promise<void>;
  /** Rows, queue and cursor of one family. */
  wipeFamily(familyId: string): Promise<void>;
  clearAll(): Promise<void>;
};

export type LocalStore = StoreOps & {
  /** All or nothing: if `fn` throws, nothing it wrote is kept. */
  transaction<T>(fn: (tx: StoreOps) => Promise<T>): Promise<T>;
};
