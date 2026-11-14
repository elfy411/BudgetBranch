# Verification and retained evidence

The evidence below records actual native Apple Silicon NEAR Sandbox executions from 2026-11-13. These historical runs are retained with the same application code and portable Wasm pins as the public baseline. They are not new Testnet runs or recordings of a single shared chain. Each fixture/run has its own accounts, chain and receipts.

Use the root [README](../README.md) and [Mac runbook](../scripts/README.md) to reproduce the current checkout. The commands rebuild the artifacts, validate their [source and Wasm hashes](../tests/portable-wasm.json), execute the SDK scenario, and run unit/MOCK checks separately.

| Evidence | Recorded result |
| --- | --- |
| [SDK scenario](../tests/evidence/sdk-sandbox-portable.jsonl) | 19 checked steps / 18 transactions / six expected rejections; final 3 free, 0 pending, 2 spent, 5 returned NEAR |
| [Browser smoke](../tests/evidence/browser-sandbox.jsonl) | Actual local signer/browser flow on a separate disposable chain |
| [Contract full scenario](../contracts/evidence/sandbox-full.json) | Direct contract actions and negatives, callbacks, revoke, reclaim and physical owner refund; final 3/0/2/5 |
| [Normal-capacity recovery](../contracts/evidence/sandbox-capacity.json) | 128 grants, 512 spends, 639 normal requests; 127 reclaims and one owner refund after ordinary capacity exhaustion, without topup |
| [Storage boundary](../contracts/evidence/sandbox-storage-boundary.json) | Deposit denied before reserve funding; exact funding boundary; recovery remains prepaid |
| [Maximum state](../contracts/evidence/sandbox-maximum-state.json) | Depth 3, eight receivers and bounded long IDs; callback storage does not grow |
| [Suite summary](../contracts/evidence/summary.json) | All ten direct suites and per-suite callback gas; original receipt files retained |
| [API/browser security review](SECURITY_REVIEW.md) | Independent probes, rejected cases and controlled fault injections clearly distinguished |
| [Screenshot trace](evidence/browser/scenario.json) | Historical manual browser run and final 3/0/2/5 screen, separate from SDK evidence |

The [contract runbook](../contracts/README.md) explains all ten suites. The 15 Rust, 18 SDK, 5 agents and 4 web unit/context/MOCK tests complement real-chain checks; they cannot prove receipt ordering. The complete suites also preserve [direct negatives](../contracts/evidence/sandbox-negatives.json), [adversarial calls](../contracts/evidence/sandbox-adversarial.json), [interleavings](../contracts/evidence/sandbox-interleaving.json), [owner transfer failure](../contracts/evidence/sandbox-refund-failure.json), [refund ordering](../contracts/evidence/sandbox-refund-order.json) and the [minimal callback cycle](../contracts/evidence/sandbox-cycle.json).

## Artifact and measurement pins

- `budgetbranch.wasm`: `2c862acc53ae8cd02f6dbf8430c1271ebbf16de27df2e2d5a77c7a52efc5aa23`
- `demo_receiver.wasm`: `40bc851605e5084acdb29d163e0b4c4df50dbd62189da63383e16847171f3655`
- Recovery payment record bound: **304 bytes**; recovery request bound: **242 bytes**. Initial bound: **1,302,528 bytes / 13.02528 NEAR**, plus actual storage and the 0.1 NEAR operational buffer.
- Maximum recorded callback: **2.302466890107 Tgas**, with **30 Tgas** prepaid. This does not establish a universal upper gas bound.

The [evidence manifest](evidence/manifest.json) records current file sizes/SHA-256 and the published source path/hash of each retained artifact. Byte-identical copies and edited extracts are explicitly distinguished. Original private development logs are not claimed to be byte-identical to privacy-redacted public copies. Metadata and legal summaries are not transaction evidence. No retained chain receipt was synthesized or mixed with another chain.

Missing-callback recovery and controlled delayed physical-refund coverage remain incomplete. Read the full [security limits](SECURITY_REVIEW.md) and [open dependency findings](DEPENDENCY_REVIEW.md). No test result establishes production readiness.
