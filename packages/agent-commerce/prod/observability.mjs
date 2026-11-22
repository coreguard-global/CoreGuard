/**
 * M3 (BUILT as interfaces/hooks): observability hooks for prod control plane.
 * NOT_BUILT: managed Prometheus/Grafana/OTel collector/SLO paging.
 */
export function createMetrics() {
  const counters = new Map();
  const timings = [];
  return {
    inc(name, labels = {}, n = 1) {
      const k = JSON.stringify([name, labels]);
      counters.set(k, (counters.get(k) ?? 0) + n);
    },
    observe(name, ms, labels = {}) { timings.push({ name, ms, labels, at: Date.now() }); },
    snapshot() {
      return {
        counters: [...counters.entries()].map(([k, v]) => { const [name, labels] = JSON.parse(k); return { name, labels, value: v }; }),
        timings: timings.slice(-200),
      };
    },
  };
}

export function createHealth({ storage, tenantId = "default" } = {}) {
  return {
    live() { return { ok: true, status: "live", at: new Date().toISOString() }; },
    ready() {
      try {
        const t = storage?.getTenant?.(tenantId);
        return { ok: !!t, status: t ? "ready" : "not_ready", tenantId, at: new Date().toISOString() };
      } catch (err) {
        return { ok: false, status: "not_ready", error: err?.message ?? String(err), at: new Date().toISOString() };
      }
    },
  };
}
