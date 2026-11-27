# Handover observer evidence — 2026-11-27

Two public handover bundles issued by Zambo, read from `zambo.dev`, verified
offline with `CG-HANDOVER/1`. The bundles are committed under
`test/fixtures/handover/` so a clean checkout reproduces both runs without the
network.

## Source reads

| Record | URL | HTTP | Bytes |
|---|---|---|---|
| zamback | `https://zambo.dev/handover/e2ef637d-663e-4020-bdc9-c69fbb1fa4de.json` | 200 | 184950 |
| adctx rowcheck | `https://zambo.dev/handover/60b51198-98fa-40c1-be0c-5566eded0feb.json` | 200 | 35328 |

## Runs

| Record | Outcome | Receipts | Operations not checked | Merkle | Workflow close | Decision |
|---|---|---|---|---|---|---|
| zamback | `verified` | 41 / 41 | 1 (step 18, refused) | matched | verified | `hold` |
| adctx | `verified` | 4 / 4 | 0 | matched | verified | `proceed` |

Decision traces (`CG-HANDOVER-TRACE/1`) are in `trace-*.json` beside the verdicts:

| Record | Before | After | Changed | Reason |
|---|---|---|---|---|
| zamback | proceed | hold | yes | step 18 refused; operation not_checked |
| adctx | proceed | proceed | no | none |

Digests:

- zamback bundle `sha256:9ff930d5e074ce193a5074ddfbc491eb0dbc86bc05a15e9eba5c1560e31f3720`
- zamback verdict `sha256:16b425972a46bda507f6efa2fd8e41e4658a547f32f253890e08831b79727012`
- adctx bundle `sha256:5f3a41ab3e7004e555c31741ae4f25fe328596f34049904b18f54d7448aa4f41`
- adctx verdict `sha256:75634942367aa54dd729e4908743130b2fe47aaa30a367ca5e6ca5638c13317b`

## Commands

```text
node packages/handover-observer/cli.mjs --file test/fixtures/handover/zamback-e2ef637d.json \
  --expected-id e2ef637d-663e-4020-bdc9-c69fbb1fa4de --read-at 2026-11-27T12:00:00.000Z \
  --out evidence/handover-observer/zamback-e2ef637d.json \
  --trace evidence/handover-observer/trace-zamback-e2ef637d.json \
  --html evidence/handover-observer/zamback-e2ef637d.html

node packages/handover-observer/cli.mjs --file test/fixtures/handover/adctx-60b51198.json \
  --expected-id 60b51198-98fa-40c1-be0c-5566eded0feb --read-at 2026-11-27T12:00:00.000Z \
  --out evidence/handover-observer/adctx-60b51198.json \
  --trace evidence/handover-observer/trace-adctx-60b51198.json \
  --html evidence/handover-observer/adctx-60b51198.html

node --test test/integrations/handover-observer.test.mjs
```

## Boundary

The bundles are public records. The observer reads them; it does not modify them
and does not post anything to Zambo. No issuer key was pinned, no external time
source was consulted, and no third-party receiving agent has consumed either
verdict. `VERIFIED ≠ SAFE`.
