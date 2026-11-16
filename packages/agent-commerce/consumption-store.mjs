/**
 * CoreGuard Agent Commerce — durable single-use consumption store (AC-CS/1).
 *
 * A Set-compatible consumption ledger adapter that persists consumed receipt
 * IDs to a JSON file so a single-use authorization cannot be replayed across
 * process restarts on the same host (the "shared-ledger/store adapter via
 * existing consumedSet injection" named by the spec's next step).
 *
 * Interface: `has(id)` / `add(id)` — the same shape `verifyExecution`, the
 * firewall, and `assessRisk` already accept via `consumedSet`, so this is a
 * drop-in replacement for the process-local `Set` with no change to the
 * verification semantics.
 *
 * Durability model (honest): file-backed, atomic rename-on-write within the
 * host process's visibility. It is NOT a distributed ledger, NOT an on-chain
 * single-use marker, and NOT a guarantee against concurrent writers racing on
 * the same file without external locking. An on-chain consumption marker is
 * OWNER-GATED / NOT_BUILT — this adapter closes the cross-process gap the spec
 * named, not the on-chain anchoring gap.
 *
 * BOUNDARY (standing): VERIFIED ≠ SAFE; consumption anchoring here is a local
 * persistence aid, never a broadcast, never chain state.
 */

import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname } from "node:path";

export const CONSUMPTION_STORE_VERSION = "AC-CS/1";
export const CONSUMPTION_STORE_BOUNDARY =
  "file-backed consumption ledger — durable across process restarts on this host; " +
  "NOT a distributed ledger, NOT an on-chain marker (on-chain anchoring OWNER-GATED / NOT_BUILT); " +
  "VERIFIED ≠ SAFE";

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
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, payload, "utf8");
  renameSync(tmp, filePath);
}

/**
 * Create (or open) a file-backed consumption store.
 *
 * `filePath` — path to the JSON ledger file (created if absent).
 * The returned object is Set-compatible for `has`/`add` and also exposes
 * `size`, `ids()` (sorted snapshot), `spec`, `filePath`, and `boundary`.
 */
export function createConsumptionStore(filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("AC-CS/1: createConsumptionStore requires a filePath string");
  }
  const ids = loadIds(filePath);

  const store = {
    spec: CONSUMPTION_STORE_VERSION,
    filePath,
    boundary: CONSUMPTION_STORE_BOUNDARY,
    has(id) {
      return ids.has(id);
    },
    add(id) {
      if (!ids.has(id)) {
        ids.add(id);
        persist(filePath, ids);
      }
      return store;
    },
    delete(id) {
      const removed = ids.delete(id);
      if (removed) persist(filePath, ids);
      return removed;
    },
    clear() {
      ids.clear();
      persist(filePath, ids);
    },
    get size() {
      return ids.size;
    },
    ids() {
      return [...ids].sort();
    },
    toJSON() {
      return {
        spec: CONSUMPTION_STORE_VERSION,
        ids: [...ids].sort(),
        boundary: CONSUMPTION_STORE_BOUNDARY,
      };
    },
  };

  // Iterable like a Set for consumers that spread/iterate.
  store[Symbol.iterator] = function* () {
    yield* [...ids].sort();
  };

  return store;
}

/**
 * Open an existing store as a read-only snapshot (no writes; mutation methods
 * are absent). Useful for inspection/audit without mutating the ledger.
 */
export function openConsumptionStore(filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("AC-CS/1: openConsumptionStore requires a filePath string");
  }
  const ids = loadIds(filePath);
  return Object.freeze({
    spec: CONSUMPTION_STORE_VERSION,
    filePath,
    boundary: CONSUMPTION_STORE_BOUNDARY,
    has(id) {
      return ids.has(id);
    },
    get size() {
      return ids.size;
    },
    ids() {
      return [...ids].sort();
    },
  });
}
