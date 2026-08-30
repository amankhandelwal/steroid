/**
 * Serialization primitives for `chrome.storage.local` read-modify-write cycles.
 */

/**
 * Per-key promise chain used to serialize read-modify-write cycles against
 * chrome.storage.local. onActivated/onRemoved fire in bursts, and without this
 * overlapping handlers clobber each other's writes.
 */
const storageQueues = new Map<string, Promise<unknown>>();

/**
 * Run `op` only after any previously queued operation for `key` has settled,
 * guaranteeing same-key read-modify-write cycles execute strictly in sequence.
 */
export function serializeStorageWrite<T>(key: string, op: () => Promise<T>): Promise<T> {
  const prev = storageQueues.get(key) ?? Promise.resolve();
  const next = prev.then(op, op);
  storageQueues.set(key, next.catch(() => {}));
  return next;
}
