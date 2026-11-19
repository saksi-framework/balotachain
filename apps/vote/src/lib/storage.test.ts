import { describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  failedCheckRecorded,
  indexedDbStore,
  keys,
  memoryStore,
  recordFailedCheck,
  StorageReadError,
} from "./storage";

/** A fake IndexedDB whose readonly transactions throw while `ctl.failing`. */
function failingReadFactory() {
  const real = new IDBFactory();
  const ctl = { failing: false };
  const factory = {
    open(name: string, version?: number) {
      const req = real.open(name, version);
      req.addEventListener("success", () => {
        const db = req.result;
        const transaction = db.transaction.bind(db);
        db.transaction = ((
          stores: string | string[],
          mode?: IDBTransactionMode,
        ) => {
          if (mode !== "readwrite" && ctl.failing) {
            throw new DOMException("read failed", "UnknownError");
          }
          return transaction(stores, mode);
        }) as IDBDatabase["transaction"];
      });
      return req;
    },
  } as unknown as IDBFactory;
  return { factory, ctl };
}

/**
 * A fake IndexedDB whose next readwrite transaction aborts right after its
 * request succeeds, the way a quota error or Safari private mode does.
 */
function abortingFactory() {
  const real = new IDBFactory();
  const ctl = { armed: false };
  const factory = {
    open(name: string, version?: number) {
      const req = real.open(name, version);
      req.addEventListener("success", () => {
        const db = req.result;
        const transaction = db.transaction.bind(db);
        db.transaction = ((
          stores: string | string[],
          mode?: IDBTransactionMode,
        ) => {
          const tx = transaction(stores, mode);
          if (mode === "readwrite" && ctl.armed) {
            ctl.armed = false;
            const objectStore = tx.objectStore.bind(tx);
            tx.objectStore = (n: string) => {
              const s = objectStore(n);
              const put = s.put.bind(s);
              s.put = (...args: Parameters<IDBObjectStore["put"]>) => {
                const r = put(...args);
                r.addEventListener("success", () => tx.abort());
                return r;
              };
              return s;
            };
          }
          return tx;
        }) as IDBDatabase["transaction"];
      });
      return req;
    },
  } as unknown as IDBFactory;
  return { factory, real, ctl };
}

describe("storage", () => {
  it("N2: a failed read throws from getStrict and answers undefined from get", async () => {
    const { factory, ctl } = failingReadFactory();
    const s = indexedDbStore("strict", factory);
    await s.set(keys.receipts("e1", "voter1"), [1]);
    expect(await s.getStrict(keys.receipts("e1", "voter1"))).toEqual([1]);
    ctl.failing = true;
    expect(await s.get(keys.receipts("e1", "voter1"))).toBeUndefined();
    await expect(
      s.getStrict(keys.receipts("e1", "voter1")),
    ).rejects.toBeInstanceOf(StorageReadError);
    ctl.failing = false;
    expect(await s.getStrict(keys.receipts("e1", "voter1"))).toEqual([1]);
  });

  it("N2: with no IndexedDB at all, getStrict answers from memory (storage not available is not a failed read)", async () => {
    const s = indexedDbStore("none", undefined);
    expect(await s.getStrict(keys.receipts("e1", "voter1"))).toBeUndefined();
    await s.set(keys.receipts("e1", "voter1"), [2]);
    expect(await s.getStrict(keys.receipts("e1", "voter1"))).toEqual([2]);
    const m = memoryStore();
    await m.set("k", 3);
    expect(await m.getStrict("k")).toBe(3);
  });

  it("memory store round-trips and deletes, and is never persistent", async () => {
    const s = memoryStore();
    await s.set("a", { n: 1 });
    expect(await s.get("a")).toEqual({ n: 1 });
    await s.delete("a");
    expect(await s.get("a")).toBeUndefined();
    expect(await s.persistent()).toBe(false);
  });

  it("IndexedDB store persists across store instances on the same database", async () => {
    const factory = new IDBFactory();
    const first = indexedDbStore("t", factory);
    await first.set(keys.credential("voter1"), { kind: "mock" });
    expect(await first.persistent()).toBe(true);
    const second = indexedDbStore("t", factory);
    expect(await second.get(keys.credential("voter1"))).toEqual({
      kind: "mock",
    });
    await second.delete(keys.credential("voter1"));
    expect(await first.get(keys.credential("voter1"))).toBeUndefined();
  });

  it("falls back to memory when there is no IndexedDB, and says so", async () => {
    const s = indexedDbStore("t", undefined);
    await s.set(keys.receipts("e1", "voter2"), [1, 2]);
    expect(await s.get(keys.receipts("e1", "voter2"))).toEqual([1, 2]);
    expect(await s.persistent()).toBe(false);
  });

  it("falls back to memory when IndexedDB fails to open", async () => {
    const broken = {
      open() {
        const req = {} as IDBOpenDBRequest & { error: Error };
        setTimeout(() => {
          Object.assign(req, { error: new Error("denied") });
          req.onerror?.(new Event("error"));
        });
        return req;
      },
    } as unknown as IDBFactory;
    const s = indexedDbStore("t", broken);
    await s.set("k", "v");
    expect(await s.get("k")).toBe("v");
    expect(await s.persistent()).toBe(false);
  });

  it("treats a write whose transaction aborts after the request succeeded as not stored", async () => {
    const { factory, real, ctl } = abortingFactory();
    const s = indexedDbStore("t", factory);
    await s.set("other", 1);
    expect(await s.persistent()).toBe(true);

    ctl.armed = true;
    await s.set(keys.credential("voter1"), { kind: "mock" });
    // The value is still readable this session, from memory...
    expect(await s.get(keys.credential("voter1"))).toEqual({ kind: "mock" });
    // ...but nothing reached IndexedDB, and the store says it is not durable.
    expect(await s.persistent()).toBe(false);
    const reopened = indexedDbStore("t", real);
    expect(await reopened.get(keys.credential("voter1"))).toBeUndefined();
    expect(await reopened.get("other")).toBe(1);
  });

  it("reads a key from memory once its write failed, even when IndexedDB answers empty", async () => {
    const factory = new IDBFactory();
    const s = indexedDbStore("t", factory);
    // A function cannot be structured-cloned, so the put throws.
    const fn = () => 1;
    await s.set("k", fn);
    expect(await s.get("k")).toBe(fn);
    expect(await s.persistent()).toBe(false);
    // A later committed write moves the key back to IndexedDB.
    await s.set("k", "v");
    expect(await indexedDbStore("t", factory).get("k")).toBe("v");
  });
});

describe("the failed-check flag", () => {
  it("stores only the flag and the election id, per election, and survives a reopen", async () => {
    const factory = new IDBFactory();
    const s = indexedDbStore("t", factory);
    await recordFailedCheck(s, "e1");
    expect(await s.get(keys.failedCheck("e1"))).toEqual({
      electionId: "e1",
      checkFailed: true,
    });
    const reopened = indexedDbStore("t", factory);
    expect(await failedCheckRecorded(reopened, "e1")).toBe(true);
    expect(await failedCheckRecorded(reopened, "e2")).toBe(false);
  });

  it("falls back to memory for the session when IndexedDB is missing", async () => {
    const s = indexedDbStore("t", undefined);
    await recordFailedCheck(s, "e1");
    expect(await failedCheckRecorded(s, "e1")).toBe(true);
  });

  it("ignores a value that is not the flag", async () => {
    const s = memoryStore();
    await s.set(keys.failedCheck("e1"), {
      electionId: "e2",
      checkFailed: true,
    });
    expect(await failedCheckRecorded(s, "e1")).toBe(false);
  });
});
