/**
 * What this phone remembers between visits: the voting credential, the
 * receipts of a submitted ballot and the "sent, no answer" markers, per
 * election. Never a name, a date of birth or the check-in (the console's
 * HttpOnly cookie holds that).
 *
 * IndexedDB when the browser has it; an in-memory map otherwise (private
 * windows that block storage, tests). Nothing here fails a call: a store that
 * cannot open, or a write that IndexedDB does not commit, falls back to
 * memory, and from then on that key is read from memory too. `persistent()`
 * says whether everything written so far survives a reload, so the screens
 * never claim "stored on this phone" for a value that only lives in memory.
 */

export interface KeyValueStore {
  /** A failed read answers `undefined`, as if nothing were stored. */
  get<T>(key: string): Promise<T | undefined>;
  /**
   * The same read, but a read that fails throws (`StorageReadError`)
   * instead of answering "nothing stored". For records whose absence lets
   * the phone build or send something: receipts, "sent, no answer"
   * markers, the credential (N2). Storage that is not available at all
   * (no IndexedDB, or it would not open: the in-memory fallback) is not a
   * failed read; it answers from memory, as `get` does.
   */
  getStrict<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  /**
   * True when IndexedDB is open and every write so far was committed to it.
   * False for a memory store, or once any write fell back to memory.
   */
  persistent(): Promise<boolean>;
}

/** Record keys, one place so task 5b reads what 5a wrote. */
export const keys = {
  /**
   * `account` is the scope the records are kept under: `checkin` for the
   * real client since the precinct check-in replaced voter accounts (records
   * under an old account name are ignored, never read, migrated or deleted).
   */
  credential: (account: string) => `credential:${account}`,
  /**
   * Per election and scope: a second run on the same phone starts clean.
   * Records under the old per-account keys (`receipts:<account>`,
   * `sending:<account>`) are ignored, never read, migrated or deleted.
   */
  receipts: (electionId: string, account: string) =>
    `receipts:${electionId}:${account}`,
  /**
   * Positions sent without a known outcome (`PendingSend[]`): written just
   * before each ballot request, removed once the answer is known.
   */
  sending: (electionId: string, account: string) =>
    `sending:${electionId}:${account}`,
  /** Per election, not per account: the failed check is about this phone. */
  failedCheck: (electionId: string) => `check-failed:${electionId}`,
} as const;

/**
 * One position whose ballot request went out and whose outcome this phone
 * never learned. Every field is public once the ballot is on the ledger:
 * `ballot` is the cast bytes exactly as sent (the opening was dropped at the
 * cast), kept only so the same bytes can be sent again. No credential, no
 * opening, no choice.
 */
export interface PendingSend {
  positionId: string;
  trackingCode: string;
  fingerprint: string;
  ballot: string;
  /**
   * A resend of these bytes was answered "this position is taken" and the
   * board did not show this ballot (D11, m5). Only changes what the screen
   * says; the position stays unconfirmed.
   */
  takenUnconfirmed?: boolean;
}

/**
 * "A Benaloh check failed on this phone for this election." The whole stored
 * value: no ballot, opening, candidate or fingerprint, so it is not secret.
 */
export interface FailedCheckFlag {
  electionId: string;
  checkFailed: true;
}

export async function recordFailedCheck(
  store: KeyValueStore,
  electionId: string,
): Promise<void> {
  const flag: FailedCheckFlag = { electionId, checkFailed: true };
  await store.set(keys.failedCheck(electionId), flag);
}

export async function failedCheckRecorded(
  store: KeyValueStore,
  electionId: string,
): Promise<boolean> {
  const v = await store.get<FailedCheckFlag>(keys.failedCheck(electionId));
  return v?.checkFailed === true && v.electionId === electionId;
}

/** An IndexedDB read failed on a database that is open. */
export class StorageReadError extends Error {
  constructor(key: string, cause: unknown) {
    super(
      `This phone could not read ${key.split(":")[0]} from its storage: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = "StorageReadError";
  }
}

export function memoryStore(): KeyValueStore {
  const map = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return map.get(key) as T | undefined;
    },
    async getStrict<T>(key: string) {
      return map.get(key) as T | undefined;
    },
    async set<T>(key: string, value: T) {
      map.set(key, value);
    },
    async delete(key: string) {
      map.delete(key);
    },
    async persistent() {
      return false;
    },
  };
}

const STORE = "kv";

function openDb(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
}

/** A read: resolves with the request's result. */
function read<T>(db: IDBDatabase, run: (s: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, "readonly").objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * A write: resolves only when the transaction commits. A request can succeed
 * and its transaction still abort (quota, private mode), and then nothing was
 * stored.
 */
function write(db: IDBDatabase, run: (s: IDBObjectStore) => IDBRequest) {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    run(tx.objectStore(STORE));
  });
}

/**
 * IndexedDB-backed store. `factory` defaults to the global `indexedDB`; when
 * there is none, or opening it fails, every call goes to an in-memory map.
 */
export function indexedDbStore(
  name = "balotachain-vote",
  factory: IDBFactory | undefined = globalThis.indexedDB,
): KeyValueStore {
  const memory = new Map<string, unknown>();
  /** Keys whose current value lives in `memory`, not IndexedDB. */
  const inMemory = new Set<string>();
  let degraded = false;
  let db: Promise<IDBDatabase | null> | null = null;

  function connect(): Promise<IDBDatabase | null> {
    if (!db) {
      db = factory
        ? openDb(factory, name).catch(() => null)
        : Promise.resolve(null);
    }
    return db;
  }

  function toMemory(key: string, value: unknown, present: boolean) {
    degraded = true;
    inMemory.add(key);
    if (present) memory.set(key, value);
    else memory.delete(key);
  }

  return {
    async get<T>(key: string) {
      const conn = await connect();
      if (!conn || inMemory.has(key)) return memory.get(key) as T | undefined;
      try {
        return (await read(conn, (s) => s.get(key))) as T | undefined;
      } catch {
        return undefined;
      }
    },
    async getStrict<T>(key: string) {
      const conn = await connect();
      // Not available at all, or this key already lives in memory: the
      // in-memory fallback answers, as for `get`. Not a failed read.
      if (!conn || inMemory.has(key)) return memory.get(key) as T | undefined;
      try {
        return (await read(conn, (s) => s.get(key))) as T | undefined;
      } catch (e) {
        throw new StorageReadError(key, e);
      }
    },
    async set<T>(key: string, value: T) {
      const conn = await connect();
      if (!conn) return toMemory(key, value, true);
      try {
        await write(conn, (s) => s.put(value, key));
        // Committed: IndexedDB holds the current value again.
        inMemory.delete(key);
        memory.delete(key);
      } catch {
        toMemory(key, value, true);
      }
    },
    async delete(key: string) {
      const conn = await connect();
      if (!conn) return toMemory(key, undefined, false);
      try {
        await write(conn, (s) => s.delete(key));
        inMemory.delete(key);
        memory.delete(key);
      } catch {
        toMemory(key, undefined, false);
      }
    },
    async persistent() {
      return (await connect()) !== null && !degraded;
    },
  };
}
