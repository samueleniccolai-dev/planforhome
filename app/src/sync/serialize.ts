import type { LocalStore, StoreOps } from './types';

/**
 * Serializes every store operation: a call made while a transaction runs waits for it,
 * so a rollback can never undo (or swallow) a write made outside the transaction.
 */
export function serializeStore(ops: StoreOps, transaction: LocalStore['transaction']): LocalStore {
  let tail: Promise<unknown> = Promise.resolve();
  const run = <T>(job: () => Promise<T>): Promise<T> => {
    const result = tail.then(job);
    tail = result.catch(() => undefined);
    return result;
  };
  const locked = Object.fromEntries(
    Object.entries(ops).map(([name, op]) => [
      name,
      (...args: unknown[]) => run(() => (op as (...a: unknown[]) => Promise<unknown>)(...args)),
    ]),
  ) as StoreOps;
  return { ...locked, transaction: (fn) => run(() => transaction(fn)) };
}
