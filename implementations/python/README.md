# nachweis/v1 — Python implementation

A second-language port of the resolver in `packages/agent-commerce/profiles/nachweis-v1.mjs`: record hash, intent hash, and `receipt_id` resolution with the same refusal codes.

    python3 implementations/python/nachweis_v1.py
    python3 -m unittest discover -s implementations/python -p "test_*.py"

Both read `test/fixtures/nachweis/demo-allow-reduced.json` (Apache-2.0, from `prokura-network/prokura-verify`). The CLI prints one `MATCH`/`DIFFER` line per record and the resolution for the execution receipt; `--json` prints the same data as a machine-readable object, and `--set amount=12.01` applies the edited-amount case.

`test/integrations/nachweis-python-parity.test.mjs` runs both implementations and compares them on the fixture, including the codes for the edited amount. The Python side has no dependencies outside the standard library.

## What this establishes, and what it does not

- It establishes that the record layout is not tied to one language's JSON or hashing behaviour: two independent runtime stacks re-derive the same seven ids and the same drift codes from the committed bytes.
- It is a **port**, not an independent implementation and not an audit. The same author wrote both, so a shared misreading of the upstream layout would still produce matching output. The cross-check against the public reference fixture is what guards against that, not the second language.
- Canonical encoding follows `@coreguard/canonical`, which is narrower than RFC 8785: integers only, object keys sorted by UTF-16 code units, strings starting with `0x` lowercased. A record carrying a non-integer number is rejected rather than encoded.
- It does not verify signatures, the mandate credential, revocation or any server key, and it makes no network call. `VERIFIED != SAFE`.
