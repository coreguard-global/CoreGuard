/**
 * Observability adapter (CG-OBS/1)
 *
 * Real OTLP/HTTP JSON export, SRE-style multi-window multi-burn-rate SLO
 * evaluation, webhook alert routing with dedup, and deterministic on-call
 * schedule resolution. Export failures are recorded, never silently treated
 * as successful delivery.
 */

import { readFileSync } from "node:fs";
import { requestJson, verdict, nowIso, requireProvisioned, isPlaceholder } from "./common.mjs";

export const OBS_VERSION = "CG-OBS/1";

/* ------------------------------------------------------------------ OTLP */

export function createOtlpExporter(config = {}) {
  const allowLocal = !!config.allowLocal;
  const endpoint = (() => {
    requireProvisioned(config, ["endpoint"], { allowLocal });
    const e = String(config.endpoint).replace(/\/+$/, "");
    if (!allowLocal && !e.startsWith("https://")) throw Object.assign(new Error("CG-OBS/1: OTLP endpoint must be HTTPS"), { code: "INSECURE_ENDPOINT" });
    return e;
  })();
  requireProvisioned(config, ["serviceName"], { allowLocal });
  const headers = {
    "Content-Type": "application/json",
    ...(config.headers || {}),
    ...(config.tokenFile ? { Authorization: `Bearer ${readFileSync(config.tokenFile, "utf8").trim()}` } : {}),
  };
  const resource = {
    attributes: [
      { key: "service.name", value: { stringValue: String(config.serviceName) } },
      { key: "coreguard.spec", value: { stringValue: OBS_VERSION } },
    ],
  };
  const pending = { traces: [], metrics: [] };
  const lastResult = { traces: null, metrics: null };

  async function post(path, payload, kind, expectStatus = [200, 202]) {
    try {
      const res = await requestJson(`${endpoint}${path}`, {
        method: "POST", headers, body: payload, expectStatus,
        timeoutMs: config.timeoutMs ?? 8000, retries: config.retries ?? 1,
        label: `otlp-${kind}`,
      });
      const result = { delivered: true, status: res.status, digest: res.digest, at: nowIso(), attempted: res.attempted };
      lastResult[kind] = result;
      return result;
    } catch (err) {
      const result = { delivered: false, status: err.detail?.status ?? null, error: err.detail?.message ?? err.message, at: nowIso() };
      lastResult[kind] = result;
      return result;
    }
  }

  function recordMetric({ name, value = 1, unit = "1", attributes = {}, kind = "counter" }) {
    if (typeof name !== "string" || !name) throw new TypeError("metric name required");
    if (!["counter", "gauge", "histogram"].includes(kind)) throw new TypeError("unsupported metric kind");
    pending.metrics.push({ name, value, unit, attributes, kind, at: Date.now() });
    if (pending.metrics.length > (config.maxBatch ?? 500)) pending.metrics.shift();
  }

  function recordSpan({ name, traceId, spanId, durationMs = 0, status = "OK", attributes = {} }) {
    if (!/^[0-9a-f]{32}$/i.test(String(traceId || ""))) throw new TypeError("traceId must be 32 hex chars");
    if (!/^[0-9a-f]{16}$/i.test(String(spanId || ""))) throw new TypeError("spanId must be 16 hex chars");
    pending.traces.push({ name, traceId, spanId, durationMs, status, attributes, at: Date.now() });
    if (pending.traces.length > (config.maxBatch ?? 500)) pending.traces.shift();
  }

  function buildTracePayload() {
    return { resourceSpans: [{ resource, scopeSpans: [{ scope: { name: "coreguard" }, spans: pending.traces.map(s => ({
      traceId: s.traceId, spanId: s.spanId, name: s.name,
      startTimeUnixNano: String(s.at * 1_000_000), endTimeUnixNano: String((s.at + s.durationMs) * 1_000_000),
      status: { code: s.status === "OK" ? 1 : 2 },
      attributes: Object.entries(s.attributes).map(([k, v]) => ({ key: k, value: { stringValue: String(v) } })),
    })) }] }] };
  }

  function buildMetricPayload() {
    const byName = new Map();
    for (const m of pending.metrics) {
      if (!byName.has(m.name)) byName.set(m.name, { name: m.name, unit: m.unit, kind: m.kind, points: [] });
      byName.get(m.name).points.push(m);
    }
    return { resourceMetrics: [{ resource, scopeMetrics: [{ scope: { name: "coreguard" }, metrics: [...byName.values()].map(m => {
      if (m.kind === "histogram") {
        return { name: m.name, unit: m.unit, histogram: { dataPoints: [{ startTimeUnixNano: String(Date.now() * 1_000_000), count: String(m.points.length), sum: m.points.reduce((n, p) => n + p.value, 0), bucketCounts: m.points.map(() => "1"), explicitBounds: m.points.map(p => p.value) }] } };
      }
      const numberKey = m.kind === "gauge" ? "gauge" : "sum";
      return { name: m.name, unit: m.unit, [numberKey]: { dataPoints: m.points.map(p => ({ asDouble: p.value, timeUnixNano: String(p.at * 1_000_000) })) } };
    }) }] }] };
  }

  async function flush() {
    const results = { spec: OBS_VERSION, at: nowIso(), boundary: "OTLP delivery is reported from the collector response; a missing collector is recorded, not treated as success." };
    results.traces = pending.traces.length ? await post("/v1/traces", buildTracePayload(), "traces") : { delivered: null, reason: "NO_DATA" };
    results.metrics = pending.metrics.length ? await post("/v1/metrics", buildMetricPayload(), "metrics") : { delivered: null, reason: "NO_DATA" };
    if (results.traces.delivered !== false) pending.traces = [];
    if (results.metrics.delivered !== false) pending.metrics = [];
    return results;
  }

  return Object.freeze({ spec: OBS_VERSION, recordMetric, recordSpan, flush, lastResult: () => ({ ...lastResult }) });
}

/* ------------------------------------------------------------------- SLO */

export const DEFAULT_BURN_WINDOWS = Object.freeze([
  { id: "fast-1h", minutes: 60, factor: 14.4, severity: "page" },
  { id: "slow-6h", minutes: 360, factor: 6, severity: "page" },
  { id: "slow-1d", minutes: 1440, factor: 3, severity: "ticket" },
]);

/**
 * SRE multi-window multi-burn-rate evaluation. Both a long and a short window
 * must exceed their factor before a `page` is emitted. NO_DATA is never OK.
 */
export function createSloMonitor({ objectives = [], burnWindows = DEFAULT_BURN_WINDOWS } = {}) {
  if (!Array.isArray(objectives) || objectives.length === 0) throw new TypeError("at least one objective is required");
  for (const o of objectives) {
    if (typeof o.id !== "string" || !(o.target > 0 && o.target < 1)) throw new TypeError("each objective needs id and target in (0,1)");
  }
  const events = new Map(objectives.map(o => [o.id, []]));

  function record({ objectiveId, good, total = 1, at = Date.now() }) {
    if (!events.has(objectiveId)) throw new Error(`unknown objective ${objectiveId}`);
    if (!Number.isFinite(total) || total <= 0) throw new TypeError("total must be positive");
    events.get(objectiveId).push({ good: !!good, total: Math.floor(total), at: typeof at === "string" ? Date.parse(at) : at });
  }

  function windowStats(objectiveId, minutes, now = Date.now()) {
    const from = now - minutes * 60_000;
    const rows = (events.get(objectiveId) || []).filter(e => e.at >= from && e.at <= now);
    if (rows.length === 0) return { events: 0, good: 0, total: 0, bad: 0, ratio: null, burnRate: null };
    const total = rows.reduce((n, e) => n + e.total, 0);
    const good = rows.reduce((n, e) => n + (e.good ? e.total : 0), 0);
    const bad = total - good;
    const errorRatio = total > 0 ? bad / total : null;
    const allowed = 1 - objectives.find(o => o.id === objectiveId).target;
    return { events: rows.length, good, total, bad, ratio: errorRatio, burnRate: allowed > 0 ? errorRatio / allowed : null };
  }

  function evaluate(now = Date.now()) {
    const out = [];
    for (const o of objectives) {
      const windows = burnWindows.map(w => ({ id: w.id, minutes: w.minutes, factor: w.factor, severity: w.severity, ...windowStats(o.id, w.minutes, now) }));
      const noData = windows.every(w => w.events === 0);
      const firing = windows.filter(w => w.burnRate !== null && w.burnRate >= w.factor);
      const longFiring = firing.some(w => w.minutes >= 360);
      const shortFiring = firing.some(w => w.minutes <= 60);
      const budget = windowStats(o.id, o.windowDays ? o.windowDays * 1440 : 43200, now);
      out.push({
        objectiveId: o.id, target: o.target, status: noData ? "NO_DATA" : (firing.length ? "BURNING" : "OK"),
        page: !noData && longFiring && shortFiring,
        windows,
        errorBudget: { allowedRatio: 1 - o.target, observedRatio: budget.ratio, consumed: budget.burnRate === null ? null : budget.burnRate },
      });
    }
    return { spec: OBS_VERSION, at: nowIso(), objectives: out };
  }

  return { spec: OBS_VERSION, record, evaluate };
}

/* --------------------------------------------------------------- Alerts */

export function createAlertRouter(config = {}) {
  const allowLocal = !!config.allowLocal;
  const webhookUrl = (() => {
    requireProvisioned(config, ["webhookUrl"], { allowLocal });
    const u = String(config.webhookUrl).replace(/\/+$/, "");
    if (!allowLocal && !u.startsWith("https://")) throw Object.assign(new Error("CG-OBS/1: alert webhook must be HTTPS"), { code: "INSECURE_ENDPOINT" });
    return u;
  })();
  const token = config.tokenFile ? readFileSync(config.tokenFile, "utf8").trim() : null;
  const seen = new Map();
  const dedupMs = config.dedupMs ?? 5 * 60_000;

  async function send({ alert, severity = "warning", fingerprint = null, objectiveId = null, detail = null }) {
    if (!alert || typeof alert !== "string") return verdict("INVALID_ALERT", { reason: "INVALID_ALERT" });
    const fp = fingerprint || `${severity}:${alert}:${objectiveId ?? ""}`;
    const now = Date.now();
    if (seen.has(fp) && now - seen.get(fp) < dedupMs) {
      return { spec: OBS_VERSION, verdict: "SUPPRESSED", reason: "DEDUP", fingerprint: fp, at: nowIso() };
    }
    seen.set(fp, now);
    const body = {
      spec: OBS_VERSION, alert, severity, fingerprint: fp, objectiveId,
      detail, at: nowIso(), source: "CoreGuard-CG-OBS/1",
      note: "Operational alert only; not a production-ready or SLA claim.",
    };
    try {
      const res = await requestJson(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body, expectStatus: [200, 202, 204], timeoutMs: config.timeoutMs ?? 8000, retries: 2, label: "alert-webhook",
      });
      return { spec: OBS_VERSION, verdict: "DELIVERED", reason: "OK", fingerprint: fp, status: res.status, digest: res.digest, at: nowIso() };
    } catch (err) {
      return { spec: OBS_VERSION, verdict: "DELIVERY_FAILED", reason: "WEBHOOK_UNREACHABLE", fingerprint: fp, detail: err.detail ?? { message: err.message }, at: nowIso() };
    }
  }

  return { spec: OBS_VERSION, send };
}

/* --------------------------------------------------------------- On-call */

export function createOnCallSchedule({ layers = [], overrides = [], timezone = "UTC" } = {}) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); } catch { throw new TypeError(`invalid timezone ${timezone}`); }
  if (!Array.isArray(layers) || layers.length === 0) throw new TypeError("at least one on-call layer is required");
  for (const l of layers) {
    if (!l.name || !Array.isArray(l.users) || l.users.length === 0) throw new TypeError("each layer needs name and users");
    if (!["daily", "weekly"].includes(l.rotation)) throw new TypeError("rotation must be daily or weekly");
    if (!Number.isFinite(Date.parse(l.startAt))) throw new TypeError("layer.startAt must be a timestamp");
    const unique = new Set(l.users.map(u => u.id));
    if (unique.size !== l.users.length) throw new TypeError("duplicate user in layer");
  }

  function whoIsOnCall(at = new Date()) {
    const t = typeof at === "string" ? Date.parse(at) : at.getTime ? at.getTime() : Number(at);
    if (!Number.isFinite(t)) return verdict("INVALID_TIME", { reason: "INVALID_TIME" });
    const active = layers.filter(l => {
      const end = l.until ? Date.parse(l.until) : Infinity;
      return t >= Date.parse(l.startAt) && t < end;
    });
    if (active.length === 0) return verdict("ON_CALL_GAP", { reason: "ON_CALL_GAP" });
    const assignments = active.map(l => {
      const cycleMs = (l.rotation === "daily" ? 1 : 7) * 86_400_000;
      const idx = Math.floor((t - Date.parse(l.startAt)) / cycleMs) % l.users.length;
      const user = l.users[(idx + l.users.length) % l.users.length];
      return { layer: l.name, user: user.id, timezone: user.timezone || timezone, escalationAfterMinutes: l.escalationAfterMinutes ?? 15 };
    });
    const over = overrides.filter(o => t >= Date.parse(o.from) && t < Date.parse(o.until));
    const effective = over.length ? over.map(o => ({ layer: o.layer ?? "override", user: o.userId, timezone, escalationAfterMinutes: o.escalationAfterMinutes ?? 15 })) : assignments;
    return {
      spec: OBS_VERSION, verdict: "VERIFIED", reason: "OK", at: new Date(t).toISOString(),
      primary: effective[0], escalation: effective.slice(1),
      note: "Schedule resolution only; it does not page anyone or prove an operator received an alert.",
    };
  }

  return { spec: OBS_VERSION, whoIsOnCall };
}

export function selfCheck() {
  const checks = [];
  const push = (n, ok) => checks.push({ name: n, ok: !!ok });
  push("exports", [createOtlpExporter, createSloMonitor, createAlertRouter, createOnCallSchedule].every(f => typeof f === "function"));
  let otlpRefused = false;
  try { createOtlpExporter({ endpoint: "https://collector.example.com", serviceName: "x" }); } catch (e) { otlpRefused = e.code === "NOT_PROVISIONED"; }
  push("otlp refuses placeholder", otlpRefused);
  const slo = createSloMonitor({ objectives: [{ id: "api", target: 0.99 }] });
  const empty = slo.evaluate();
  push("no data is not OK", empty.objectives[0].status === "NO_DATA" && empty.objectives[0].page === false);
  const now = Date.now();
  for (let i = 0; i < 100; i += 1) slo.record({ objectiveId: "api", good: i % 2 === 0, at: now - i * 60_000 });
  const burning = slo.evaluate();
  push("high burn rate detected", burning.objectives[0].status === "BURNING");
  const sched = createOnCallSchedule({ layers: [{ name: "primary", users: [{ id: "alice" }, { id: "bob" }], rotation: "daily", startAt: "2026-01-01T00:00:00Z" }] });
  const who = sched.whoIsOnCall("2026-01-02T12:00:00Z");
  push("on-call rotates", who.verdict === "VERIFIED" && who.primary.user === "bob");
  return { ok: checks.every(c => c.ok), checks };
}
