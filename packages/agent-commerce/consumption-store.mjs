/**
 * CoreGuard Agent Commerce — durable single-use consumption store (AC-CS/1).
 *
 * A Set-compatible consumption ledger adapter that persists consumed receipt
 * IDs to a JSON file so a single-use authorization cannot be replayed across
 * process restarts — or across two live processes on the same host.
 *
 * Interface: `has(id)` / `add(id)` / `tryAdd(id)` — the same shape
 * `verifyExecution`, the firewall, and `assessRisk` accept via `consumedSet`.
 * `tryAdd(id)` is the correct single-use primitive: it reloads the ledger under
 * an exclusive file lock and returns true only for the caller that actually
 * added the id, so two racing processes cannot both believe they were first.
 *
 * Durability model (honest): every read is a fresh file read; every mutation
 * takes `<file>.lock` (O_EXCL, stale-lock recovery) and rewrites the ledger with
 * an atomic temp+rename. That closes the cross-PROCESS gap on one host. It is
 * still NOT a distributed ledger and NOT an on-chain marker: two hosts with two
 * local files can each consume the same receipt. The built answer for crossing
 * hosts is the append-only signed log in `spend.mjs` (CG-SPEND/1, `mergeLogs`),
 * which makes a double-spend across exchanged logs a named `conflict`; a global
 * on-chain marker remains OWNER-GATED / NOT_BUILT.
 *
 * BOUNDARY (standing): VERIFIED ≠ SAFE; consumption anchoring here is a local
 * persistence aid, never a broadcast, never chain state.
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  openSync,
  closeSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname } from "node:path";

export const CONSUMPTION_STORE_VERSION = "AC-CS/1";
export const CONSUMPTION_STORE_BOUNDARY =
  "file-backed consumption ledger — durable across process restarts and lock-guarded across processes on this host; " +
  "NOT a distributed ledger, NOT an on-chain marker (on-chain anchoring OWNER-GATED / NOT_BUILT); " +
  "cross-host reconciliation is CG-SPEND/1 merge (spend.mjs), not this file; VERIFIED ≠ SAFE";

const SLEEP_CELL = new Int32Array(new SharedArrayBuffer(4));
const sleep = (ms) => Atomics.wait(SLEEP_CELL, 0, 0, ms);

function loadIds(filePath) {
  try {
    const raw = readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    if (!data || data.spec !== CONSUMPTION_STORE_VERSION || !Array.isArray(data.ids)) {
      throw new Error("not an AC-CS/1 store");
    }
    return new Set(data.ids.filter((x) => typeof x === "string"));
  } catch (err) {
    if (err && err.code === "ENOENT") return new Set();
    throw err;
  }
}

function persist(filePath, ids) {
  mkdirSync(dirname(filePath), { recursive: true });
  const payload =
    JSON.stringify(
      {
        spec: CONSUMPTION_STORE_VERSION,
        ids: [...ids].sort(),
        boundary: CONSUMPTION_STORE_BOUNDARY,
      },
      null,
      2,
    ) + "\n";
  const tmp = `${filePath}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  writeFileSync(tmp, payload, "utf8");
  renameSync(tmp, filePath);
}

/** Exclusive lock around a read-modify-write of one ledger file. */
function withLock(filePath, fn, { lockTimeoutMs = 2000, staleLockMs = 10000 } = {}) {
  const lockPath = `${filePath}.lock`;
  mkdirSync(dirname(lockPath), { recursive: true });
  const deadline = Date.now() + lockTimeoutMs;
  for (;;) {
    try {
      const fd = openSync(lockPath, "wx");
      writeFileSync(fd, JSON.stringify({ pid: process.pid, at: Date.now() }));
      closeSync(fd);
      break;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      try {
        const st = statSync(lockPath);
        if (Date.now() - st.mtimeMs > staleLockMs) unlinkSync(lockPath);
      } catch {
        // Released between EEXIST and stat.
      }
      if (Date.now() > deadline) throw new Error(`AC-CS/1: ledger is locked by another process (${lockPath})`);
      sleep(3 + Math.floor(Math.random() * 5));
    }
  }
  try {
    return fn();
  } finally {
    try {
      unlinkSync(lockPath);
    } catch {
      // Nothing to release.
    }
  }
}

/**
 * Create (or open) a file-backed consumption store.
 *
 * `filePath` — path to the JSON ledger file (created if absent).
 * Options: `lockTimeoutMs`, `staleLockMs` for the cross-process lock.
 */
export function createConsumptionStore(filePath, { lockTimeoutMs = 2000, staleLockMs = 10000 } = {}) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("AC-CS/1: createConsumptionStore requires a filePath string");
  }
  const lockOptions = { lockTimeoutMs, staleLockMs };

  const store = {
    spec: CONSUMPTION_STORE_VERSION,
    filePath,
    boundary: CONSUMPTION_STORE_BOUNDARY,
    /** Fresh read: another process's commit is visible immediately. */
    has(id) {
      return loadIds(filePath).has(id);
    },
    add(id) {
      store.tryAdd(id);
      return store;
    },
    /**
     * Atomic cross-process claim. Returns true only for the caller that added
     * the id; a concurrent process that already added it gets false.
     */
    tryAdd(id) {
      if (typeof id !== "string" || id.length === 0) throw new Error("AC-CS/1: id must be a non-empty string");
      return withLock(
        filePath,
        () => {
          const ids = loadIds(filePath);
          if (ids.has(id)) return false;
          ids.add(id);
          persist(filePath, ids);
          return true;
        },
        lockOptions,
      );
    },
    delete(id) {
      return withLock(
        filePath,
        () => {
          const ids = loadIds(filePath);
          const removed = ids.delete(id);
          if (removed) persist(filePath, ids);
          return removed;
        },
        lockOptions,
      );
    },
    clear() {
      withLock(
        filePath,
        () => {
          persist(filePath, new Set());
          return true;
        },
        lockOptions,
      );
    },
    get size() {
      return loadIds(filePath).size;
    },
    ids() {
      return [...loadIds(filePath)].sort();
    },
    toJSON() {
      return {
        spec: CONSUMPTION_STORE_VERSION,
        ids: [...loadIds(filePath)].sort(),
        boundary: CONSUMPTION_STORE_BOUNDARY,
      };
    },
  };

  // Iterable like a Set for consumers that spread/iterate.
  store[Symbol.iterator] = function* () {
    yield* store.ids();
  };

  return store;
}

/**
 * Open an existing store as a read-only snapshot (no writes; mutation methods
 * are absent). Useful for inspection/audit without mutating the ledger.
 * `has`/`ids`/`size` stay live reads, so an inspector sees new commits.
 */
export function openConsumptionStore(filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("AC-CS/1: openConsumptionStore requires a filePath string");
  }
  return Object.freeze({
    spec: CONSUMPTION_STORE_VERSION,
    filePath,
    boundary: CONSUMPTION_STORE_BOUNDARY,
    has(id) {
      return loadIds(filePath).has(id);
    },
    get size() {
      return loadIds(filePath).size;
    },
    ids() {
      return [...loadIds(filePath)].sort();
    },
  });
}
