# Negative control: one tampered step in the public handover corpus

Built for CoreGuard issue #165 from the public 41-step zamback handover `e2ef637d-663e-4020-bdc9-c69fbb1fa4de`. The committed bundle `zamback-tampered-step.json` is byte-identical to `zamback-e2ef637d.json` except for one documented mutation. `node scripts/handover-negative-build.mjs --check` regenerates it from the positive fixture and asserts that nothing else changed.

- Step index 4 in `steps` (observer label `step[5]`), receipt `2477de3d-377d-4da3-92d4-b878566346d4`.
- Field: `tool.name` inside the step's canonical receipt bytes, at byte offset 768.
- Value: `proof_loop_check` -> `proof_loop_fix`, another tool that really appears in this workflow, so the record reads as plausible work rather than noise.
- Both published byte forms were updated consistently (`canonical_bytes` text and `canonical_bytes_base64`), so text/base64 agreement still passes and the control isolates the per-step digest binding.
- Source bundle hash: `sha256:9ff930d5e074ce193a5074ddfbc491eb0dbc86bc05a15e9eba5c1560e31f3720` (184,950 bytes).
- Tampered bundle hash: `sha256:3172d20c199130f1b9b786069ff729305a3091deb0d36881ea5ae8cfc290e3fc` (184,948 bytes).
- Committed step `output_hash` is unchanged: `sha256:9808fc6c4b4b3abdd641d2fb2d30de9fde8f076588fa4d58c548f43bd40e782f`.
- Recomputed mutated step bytes: `sha256:b62f7cd9e35508770e07c1f0c08ce71e66cbfd9ac4a6efb8860d06328ee88dae`.

Expected verdict: `verification_failed`, with exactly two failed checks on `step[5]`: `output_hash matches the decoded bytes` and the AER-1 parser with `DIGEST_MISMATCH`. The workflow Merkle root still recomputes because `seq-output-v1` covers claimed output hashes, which this mutation does not touch. A Merkle-layer negative would require changing the claimed hash itself; that is a different control.

Positive control in the same pass: the unmutated bundle returns `verified`, 41/41 receipts, zero failed checks. Both `steps_digest` and `metadata_hash` still pass in the tampered bundle: those bindings cover ids and the workflow-close receipt respectively, not this step's receipt bytes.

Original control and full observer records: https://gist.github.com/zambodotdev/c35e21182e86ae0bae62a5fce88cf23d

Boundary: VERIFIED != SAFE. A passing recomputation says the saved bytes were not altered; it does not authenticate the issuer, establish delivery, or make any compatibility, safety or endorsement claim.
