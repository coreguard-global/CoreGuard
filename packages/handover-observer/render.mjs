/**
 * Static report for a CG-HANDOVER/1 verdict.
 *
 * Self-contained HTML: no scripts, no remote assets, no fonts to fetch. A
 * report that needs the network to render is a report that stops working when
 * the issuer does, which is the failure the observer exists to measure.
 */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
const short = (value, n = 16) => (typeof value === "string" && value.length > n ? `${value.slice(0, n)}…` : String(value ?? ""));

const TONE = {
  verified: "ok",
  proceed: "ok",
  verification_failed: "bad",
  reject: "bad",
  not_checked: "warn",
  hold: "warn",
  request_more_evidence: "warn",
  unavailable: "warn",
  unsupported: "warn",
  inconclusive: "warn",
};

export function renderReport(verdict, decision, { generatedAt } = {}) {
  const tone = TONE[verdict.outcome] ?? "warn";
  const decisionTone = TONE[decision?.decision] ?? "warn";
  const rows = (verdict.steps || [])
    .map(
      (s) => `<tr>
      <td class="num">${s.index}</td>
      <td><code title="${esc(s.receiptId)}">${esc(short(s.receiptId, 8))}</code></td>
      <td>${esc(s.tool)}</td>
      <td>${esc(s.status)}</td>
      <td>${esc(s.outcome)}</td>
    </tr>`,
    )
    .join("\n");

  const checks = (verdict.checks || [])
    .map(
      (c) => `<li class="${c.ok ? "pass" : "fail"}"><span>${c.ok ? "PASS" : "FAIL"}</span> ${esc(c.id)}</li>`,
    )
    .join("\n");

  const notEstablished = (verdict.notEstablished || []).map((n) => `<li>${esc(n)}</li>`).join("\n");
  const notChecked = (verdict.notChecked || [])
    .map((n) => `<li><strong>${esc(n.scope)}</strong> — ${esc(n.reason)}: ${esc(n.detail)}</li>`)
    .join("\n");
  const reasons = (decision?.reasons || []).map((r) => `<li>${esc(r)}</li>`).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Handover ${esc(short(verdict.handover?.id ?? "unknown", 12))} — CoreGuard observer</title>
<style>
  :root { color-scheme: light dark; --ink:#14161a; --muted:#5b6472; --line:#d9dee6; --ok:#0f7b46; --bad:#b3261e; --warn:#8a5a00; --paper:#fff; --wash:#f6f8fb; }
  @media (prefers-color-scheme: dark) { :root { --ink:#e9edf3; --muted:#9aa5b4; --line:#2b323c; --ok:#56d394; --bad:#ff8a80; --warn:#e8b85c; --paper:#0f1216; --wash:#161b21; } }
  * { box-sizing: border-box; }
  body { margin:0; font:16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color:var(--ink); background:var(--paper); }
  main { max-width: 980px; margin: 0 auto; padding: 48px 24px 80px; }
  .eyebrow { letter-spacing:.14em; text-transform:uppercase; font-size:12px; color:var(--muted); }
  h1 { margin:.2em 0 .1em; font-size: clamp(28px,4vw,44px); letter-spacing:-.02em; }
  .sub { color: var(--muted); margin-top: 0; }
  .badges { display:flex; gap:10px; flex-wrap:wrap; margin: 22px 0 30px; }
  .badge { border:1px solid var(--line); border-radius:999px; padding:6px 14px; font-weight:650; font-size:14px; }
  .badge.ok { color:var(--ok); border-color:currentColor; }
  .badge.bad { color:var(--bad); border-color:currentColor; }
  .badge.warn { color:var(--warn); border-color:currentColor; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin: 26px 0; }
  .stat { background:var(--wash); border:1px solid var(--line); border-radius:14px; padding:16px 18px; }
  .stat b { display:block; font-size:30px; line-height:1.1; }
  .stat span { color:var(--muted); font-size:13px; }
  section { margin: 38px 0; }
  h2 { font-size:19px; margin: 0 0 12px; }
  code { font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:9px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.06em; }
  td.num { width:42px; color:var(--muted); }
  ul { padding-left: 20px; margin: 8px 0; }
  ul.checks { list-style:none; padding:0; }
  ul.checks li { padding:7px 0; border-bottom:1px solid var(--line); }
  ul.checks span { display:inline-block; min-width:48px; font-size:11px; font-weight:750; letter-spacing:.06em; }
  li.pass span { color: var(--ok); }
  li.fail span { color: var(--bad); }
  .note { background:var(--wash); border-left:3px solid var(--line); padding:14px 18px; border-radius:0 10px 10px 0; color:var(--muted); }
  .decision { border:1px solid currentColor; border-radius:14px; padding:18px 20px; }
  .decision.ok { color:var(--ok); } .decision.bad { color:var(--bad); } .decision.warn { color:var(--warn); }
  .decision h2 { color:var(--ink); margin-bottom:6px; }
  .decision p { margin:0 0 8px; color:var(--ink); }
  footer { margin-top:56px; padding-top:20px; border-top:1px solid var(--line); color:var(--muted); font-size:13px; }
</style>
</head>
<body>
<main>
  <div class="eyebrow">CoreGuard · independent handover observer · ${esc(verdict.observerVersion)}</div>
  <h1>Handover ${esc(short(verdict.handover?.id ?? "unreadable", 8))}</h1>
  <p class="sub">${esc(verdict.handover?.stepCount ?? 0)} step receipts re-read from the published bundle and recomputed locally. Issuer verdicts are copied for comparison, not inherited.</p>

  <div class="badges">
    <span class="badge ${tone}">record: ${esc(verdict.outcome)}</span>
    <span class="badge ${decisionTone}">receiver policy: ${esc(decision?.decision ?? "n/a")}</span>
    <span class="badge">${esc(verdict.coverage?.receiptsVerified ?? 0)}/${esc(verdict.coverage?.steps ?? 0)} receipts verified</span>
  </div>

  <div class="grid">
    <div class="stat"><b>${esc(verdict.coverage?.steps ?? 0)}</b><span>step receipts</span></div>
    <div class="stat"><b>${esc(verdict.coverage?.receiptsVerified ?? 0)}</b><span>bytes recomputed</span></div>
    <div class="stat"><b>${esc(verdict.coverage?.declaredNotChecked ?? 0)}</b><span>declared not checked</span></div>
    <div class="stat"><b>${esc((verdict.notEstablished || []).length)}</b><span>limits carried</span></div>
  </div>

  <section class="decision ${decisionTone}">
    <h2>Receiving-agent decision</h2>
    <p><strong>${esc(decision?.decision ?? "not evaluated")}</strong> — from the policy below, applied to this verdict only.</p>
    <ul>${reasons}</ul>
  </section>

  <section>
    <h2>What was recomputed</h2>
    <ul class="checks">${checks}</ul>
  </section>

  <section>
    <h2>Step receipts</h2>
    <table>
      <thead><tr><th>#</th><th>Receipt</th><th>Tool</th><th>Recorded status</th><th>Observer outcome</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>

  <section>
    <h2>Not checked, with reasons</h2>
    <ul>${notChecked || "<li>none</li>"}</ul>
  </section>

  <section>
    <h2>What this report does not establish</h2>
    <ul>${notEstablished}</ul>
    <p class="note">A verified record means the saved bytes are unchanged and bound to this handover. It does not mean the delivery succeeded, the issuer is who it claims to be, or the work was correct.</p>
  </section>

  <section>
    <h2>Issuer claims (not used as this verdict)</h2>
    <p class="note">${esc(verdict.issuerClaims?.note ?? "")}</p>
    <ul>
      <li>Issuer checked: ${esc(verdict.issuerClaims?.receiptChecks?.checked ?? "not stated")}</li>
      <li>Issuer not checked: ${esc(verdict.issuerClaims?.receiptChecks?.not_checked ?? "not stated")}</li>
      <li>Issuer not proven: ${esc((verdict.issuerClaims?.notProven || []).join("; ") || "not stated")}</li>
    </ul>
  </section>

  <footer>
    <p>Bundle digest <code>${esc(verdict.bundleDigest)}</code></p>
    <p>Verdict digest <code>${esc(verdict.verdictDigest)}</code></p>
    <p>Observer <code>${esc(verdict.observer)}</code> · read at <code>${esc(verdict.readAt)}</code> · report generated <code>${esc(generatedAt)}</code></p>
    <p>Source <code>${esc(verdict.sourceUrl ?? "local file")}</code></p>
    <p>VERIFIED ≠ SAFE. No issuer key was pinned; no external time source was consulted.</p>
  </footer>
</main>
</body>
</html>
`;
}
