# Reviewer demo script — CoreGuard (2026-09)

*العربية: [سكربت العرض — النسخة العربية](reviewer-demo-script-2026-09-ar.md) — declared pair; the Arabic edition pins this file's digest and `test/ci/bilingual-pairs.test.js` fails when they drift.*

A 10–15 minute live walkthrough for a technical reviewer, verifier, or
prospective partner. Everything shown is reproducible from the committed tree;
nothing in this script performs a network call (`networkCall: NOT_PERFORMED`
is a test-invariant).

Prerequisites: Node 18+, `git clone`, `npm install`. That is the entire setup.

**This script is executable.** Every step below sits in a `demo` fence carrying
its command, the output fragments it promises, and its exit code. The contract
in `test/ci/demo-script-contract.test.js` extracts those blocks, runs them in
order from the repository root, and compares the printed output to the promises
— a mismatch fails the build naming the line of this file. Placeholders were
removed on purpose: a script with `<your-copy>` in it cannot be verified by
anyone, and this file's whole claim is that its steps can.

One exception, stated rather than hidden: `npm test` (Part 1) is *not* in a
`demo` fence. It hosts the contract, so executing it from inside itself would
recurse; CI runs it as its own job. Everything else runs.

Only external link used: https://github.com/coreguard-global/CoreGuard/releases/tag/v0.6.0

---

## Part 0 — What you are watching (30 s)

We are not claiming "integration". We are showing a *verification layer* that
(1) pins execution evidence, (2) keeps consent honest, (3) packages a
dispute deterministically, and (4) fails closed on tamper. The money-moving
steps — settlement, escrow, broadcast — are deliberately outside it.

## Part 1 — The suite is the claim (2 min)

Run `npm test` in the repository root. Expected: the conformance + delivery
suite passes with zero failures, and the pass total is machine-pinned against
`docs/state-snapshot.json` — a drifted count turns the run red rather than
being tolerated. This is the headline number: not a video, not a screenshot, a
local run.

## Part 2 — Build the transport packet offline (2 min)

```demo
$ npm run -s peoples-court:harness -- --case examples/delivery-fixture/pairs/dispute-package/reference-A --out var/demo/run-a
> x402       : adjudication.prepare
> webhook    : 7 events · 4 applied · 1 duplicate · 2 out-of-order · 0 tampered · cursor=4
> network    : NOT_PERFORMED
> PEOPLES_COURT_HARNESS_READY
! exit 0
```

Emitted and pinned into `var/demo/run-a`: `x402-prepare-packet.json`,
`x402-packet-digest.json`, `webhook-ledger.json`, `webhook-events-log.json`,
`harness-report.json`, `harness-hashes.json` — then re-verified before exit.
`var/` is gitignored, so a demo never dirties the tree.

## Part 3 — Determinism (1 min)

Run the same case again, into a second directory, and compare the pinned
packet digest. Identical bytes, or the demo fails:

```demo
$ npm run -s peoples-court:harness -- --case examples/delivery-fixture/pairs/dispute-package/reference-A --out var/demo/run-b
> PEOPLES_COURT_HARNESS_READY
! exit 0

$ node -e "const fs=require('fs');const a=fs.readFileSync('var/demo/run-a/x402-packet-digest.json','utf8');const b=fs.readFileSync('var/demo/run-b/x402-packet-digest.json','utf8');console.log(a===b?'DETERMINISTIC: equal':'DETERMINISTIC: varied')"
> DETERMINISTIC: equal
! exit 0
```

## Part 4 — Tamper, fail-closed (2 min)

Copy the case out of the fixture, flip exactly one byte in the package, and run
the same harness on the copy. It must refuse, name the pin that no longer
matches, and emit nothing usable:

```demo
$ node -e "const fs=require('fs');fs.rmSync('var/demo/tampered',{recursive:true,force:true});fs.cpSync('examples/delivery-fixture/pairs/dispute-package/reference-A','var/demo/tampered',{recursive:true});const p='var/demo/tampered/dispute-package.json';const b=fs.readFileSync(p);const i=Math.floor(b.length/2);b[i]=b[i]+1>255?b[i]-1:b[i]+1;fs.writeFileSync(p,b);console.log('TAMPERED: one byte flipped')"
> TAMPERED: one byte flipped
! exit 0

$ npm run -s peoples-court:harness -- --case var/demo/tampered --out var/demo/tampered-out
> PEOPLES_COURT_HARNESS_FAILED at verify
> pin mismatch
! exit 1
```

An expected non-zero exit is part of the promise: a fail-closed layer whose
tamper step exited 0 would be the defect, so the contract asserts this step's
code rather than ignoring it.

## Part 5 — Honest consent + tribunal simulation (2 min)

```demo
$ node examples/reference-tribunal/sim-tribunal.mjs --case examples/delivery-fixture/pairs/dispute-package/reference-A --scenario A --out var/demo/tribunal
> verdict   : tribunal-ready
> award     : SYNTHETIC
> NOT People's Court
! exit 0
```

The simulator refuses settlement on partial consent, and the award slot stays
`UNKNOWN` unless the package carries a real external award. Consent gaps are
never promoted to bilateral consent — and the simulated award says `SYNTHETIC`
in its own output so no reader can mistake it for an adjudicator's.

## Part 6 — The reviewer challenge (the part we want you to practice)

Everything above is stated as *weaker than the evidence*, on purpose. Try to
break the evidence model — any claim here must survive your own run:

1. Flip a byte anywhere in a package → the verifier must refuse it (Part 4 is
   that experiment, already automated).
2. Turn a `PARTIAL` into `FULL` → pin checks must reject the edit.
3. Rewrite a claimed status in a doc → the conformance suite's honesty tests
   fail (the suite asserts the project never overclaims).
4. Run on a clean clone with `core.autocrlf=false` → deterministic bytes.

If you find an ambiguity, false assumption, or fail-open path: open an issue or
send us the reproduction. The last four defects reported against these surfaces
(including a receipt-identity swap that verified as integrity) were closed with
a must-fail test each, and the tests are in this tree.

## Reviewer outcome template

When you've run Part 1–2 (and ideally the tamper):

- Environment: OS + Node version + commit SHA.
- `npm test` final count: ___ pass / ___ fail.
- Harness decision line: ___
- Tamper result (if run): exit ___
- Findings / issues opened: ___

That record is the strongest artifact this project can publish — and the one
thing a funding conversation is actually built on.
