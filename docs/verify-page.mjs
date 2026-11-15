/**
 * docs/verify-page.mjs — the DOM half of the receipt verifier.
 *
 * Reads the bundle from the URL fragment (never the query string, so it is not
 * logged by a server), verifies it with ./verify-receipt.mjs, and renders the
 * verdict. No fetch, no XHR, no storage, no analytics: the fragment never
 * leaves the tab.
 *
 * Bundle shape (JSON, base64url-encoded, prefixed `v1.`):
 *   { receipt, xdr, network, at?, policy? }
 * `at` pins the clock for an audit replay; without it the browser clock is used.
 */

import { verifyBundle, canonicalJson } from "./verify-receipt.mjs";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function decodeBundle(hash) {
  const raw = hash.replace(/^#/, "");
  if (!raw) return { ok: false, error: "no fragment: expected #v1.<base64url>" };
  if (!raw.startsWith("v1.")) return { ok: false, error: `unknown bundle version: ${raw.slice(0, 3)}` };
  const b64 = raw.slice(3).replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const bundle = JSON.parse(new TextDecoder().decode(bytes));
    if (!bundle || typeof bundle !== "object") return { ok: false, error: "bundle is not an object" };
    return { ok: true, bundle };
  } catch (e) {
    return { ok: false, error: `bundle is not base64url JSON: ${e && e.message ? e.message : e}` };
  }
}

function renderRow(name, pass, detail) {
  const cls = pass ? "ok" : "no";
  const mark = pass ? "PASS" : "FAIL";
  return `<tr><td class="k">${esc(name)}</td><td class="v ${cls}">${mark}${detail ? ` — ${esc(detail)}` : ""}</td></tr>`;
}

function renderIdle(message) {
  $("verdict").className = "verdict idle";
  $("badge").textContent = "NO BUNDLE";
  $("code").textContent = "Nothing verified";
  $("reason").textContent = message;
}

async function main() {
  const decoded = decodeBundle(location.hash);
  if (!decoded.ok) return renderIdle(decoded.error);
  const { bundle } = decoded;

  const receipt = bundle.receipt;
  const nowSeconds = Number.isInteger(bundle.at) ? bundle.at : Math.floor(Date.now() / 1000);

  const result = await verifyBundle({
    receipt,
    xdr: bundle.xdr,
    network: bundle.network,
    policy: bundle.policy,
    nowSeconds,
    issuerPublicKey: bundle.issuerPublicKey ?? (receipt && receipt.issuer),
  });

  const pass = result.decision === "PASS";
  $("verdict").className = `verdict ${pass ? "pass" : "block"}`;
  $("badge").textContent = result.decision;
  $("code").textContent = result.code ?? "all checks passed";
  $("reason").textContent = result.reasons[0] ?? "signature, digest, binding, network and window all hold";

  const facts = [
    ["receipt digest", result.receiptId ?? "—"],
    ["issuer (pinned key)", receipt && receipt.issuer ? receipt.issuer : "—"],
    ["network", receipt && receipt.network ? receipt.network : "—"],
    ["authorized window", receipt ? `${receipt.issuedAt} → ${receipt.expiresAt}` : "—"],
    ["checked at", `${result.checkedAtSeconds}${Number.isInteger(bundle.at) ? " (pinned)" : " (browser clock)"}`],
    ["execution proof", result.executionProof],
    ["policy confirmed against the receipt", result.policyChecked ? "yes — supplied in the bundle" : "no — the receipt's policy is shown, not enforced"],
  ];
  $("facts").innerHTML = `<tbody>${facts.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join("")}</tbody>`;

  const rows = result.checks.map((c) => renderRow(c.name, c.pass, c.detail));
  rows.push(renderRow("policy equality", Boolean(result.policyChecked), result.policyChecked ? undefined : "not supplied in this bundle"));
  $("checks").innerHTML = `<tbody>${rows.join("")}</tbody>`;

  $("raw").textContent = canonicalJson({ receipt: receipt ?? null, network: bundle.network ?? null, xdrSha256: receipt ? receipt.xdrFingerprint : null });
}

main().catch((e) => {
  $("verdict").className = "verdict block";
  $("badge").textContent = "BLOCK";
  $("code").textContent = "VERIFIER_ERROR";
  $("reason").textContent = `fail-closed: ${e && e.message ? e.message : e}`;
});
