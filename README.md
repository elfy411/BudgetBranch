# BudgetBranch

**Delegate spending authority without multiplying the budget.** An agent that can delegate should not be able to invent funds or broaden its permissions. BudgetBranch holds one funded budget in a NEAR contract and lets agents reserve smaller budgets for descendants with narrower recipients, expiry and depth limits.

**Sandbox-only · deterministic demo agents · reviewed receivers · not production-ready.**

## Why NEAR

NEAR executes the spending checks against the actual calling account and the entire grant ancestry. Delegation changes reservations inside one contract. Payments and owner refunds are real asynchronous NEAR transfers: the contract reserves funds before dispatch, and a private callback records the result. Here, private means contract-only callback access, not confidential transactions. The browser displays finalized chain state and receipts.

## Run on an Apple Silicon Mac

Use native ARM64 macOS with Apple Command Line Tools (`xcrun --find clang`). From a clean checkout:

```sh
./scripts/mac.sh bootstrap
./scripts/mac.sh sdk-sandbox
./scripts/mac.sh unit
./scripts/mac.sh web
```

`bootstrap` installs pinned tools inside `.local/` and caches inside `.cache/`; global tools and shell profiles stay unchanged. First use needs HTTPS access to upstream tool and package registries. Pins: Rust/Cargo **1.95.0**, Node **24.14.0** / npm **11.9.0**, NEAR Sandbox **2.14.0 / protocol 88**.

`sdk-sandbox` builds portable Wasm and executes real local-chain transactions. Expect **PASS: 19 steps, 18 transactions, six expected contract rejections**, ending at **3 free / 0 pending / 2 spent / 5 returned NEAR**. `unit` runs **15 Rust, 18 SDK and 5 agents** unit/context/MOCK checks; these are separate from Sandbox evidence.

`web` starts a new unfunded Sandbox and prints the **REAL NEAR SANDBOX** URL. Open it, select a disposable signer and follow the [demonstration](docs/DEMO.md). Keep the terminal running; Ctrl-C discards that chain. No wallet, personal key, paid API or external RPC is needed. If port 5173 is occupied, use `BB_WEB_PORT=5387 ./scripts/mac.sh web`.

After the SDK has built, check the web bundle and its four unit/MOCK tests:

```sh
./scripts/mac.sh env npm --prefix web ci --ignore-scripts --no-audit --no-fund
./scripts/mac.sh env npm --prefix web run build
./scripts/mac.sh env npm --prefix web test
```

The [full Mac runbook](scripts/README.md) covers offline cache reuse, loopback startup, troubleshooting and automated browser checks. Native Apple Silicon is the verified platform; this release does not claim a tested Linux/Docker runner. The standalone Vite entry point is a developer/read-only flow; the `web` command supplies the real local chain and signing bridge.

## Demonstration

Fund 10 test NEAR. Reserve 6 for A and 4 for B. A reserves 4 for its child; another request for 4 fails. Show a successful payment, denial of an unknown recipient, and a real failure from an allowed receiver. Revoke A and its descendants; B still pays under available quotas. Reclaim unused reservations, then refund 5 to the owner.

[Step-by-step operator guide and 112-second storyboard](docs/DEMO.md).

![Actual Sandbox ledger: free 3, pending 0, spent 2, returned 5 NEAR](docs/evidence/browser/final-screen.jpg)

This is an actual historical browser capture. Its [chain trace](docs/evidence/browser/scenario.json) is separate from the automated runs; receipts from different chains are not combined into one demonstration.

## Verification

The global ledger obeys `funded = free + pending + spent + returned`. Child reservations are not counted twice. A separate physical-liquidity guard protects outgoing transfers even when logical free funds have been restored before a protocol refund arrives.

- [Ten direct contract Sandbox suites](contracts/README.md): success/failure, authority/replay negatives, interleavings, quotas, owner recovery, storage and gas.
- [Compact evidence index and current file hashes](docs/VERIFICATION.md): real receipts, expected totals, separate test levels and reproducible commands.
- [Independent security findings](docs/SECURITY_REVIEW.md): financial core and local API/browser boundary, with retained scope and gaps.
- [Protocol specification](SPEC.md), [ABI](docs/abi.ts), [portable Wasm pins](tests/portable-wasm.json) and [source/evidence provenance](docs/PROVENANCE.md).

## Known limitations

- Only reviewed, immutable, synchronous receiver contracts are supported. Arbitrary merchants and asynchronous receiver chains are outside the verified scope.
- A missing or failed callback can strand funds pending indefinitely. There is no timeout refund or manual force settlement. Revoke blocks new activity; it does not cancel an in-flight transfer. A successful nonempty/oversized `TooLong` result remains spent; only `Failed` permits logical recredit.
- A controlled delayed physical-refund interval was not reproduced. Exact expiry, authenticated duplicate callback, callback execution failure and low-cash dispatch rejection have unit-context coverage rather than all corresponding real-chain interleavings.
- Ordinary quotas are shared; sibling availability is not guaranteed. Owner recovery has separate prepaid, finite quotas. Operational endowment is not withdrawable. The initial recovery storage reserve is **13.02528 NEAR**, plus actual storage and a **0.1 NEAR** buffer, separate from the 10 NEAR business demo. The maximum recorded callback used **2.302466890107 Tgas** of 30 Tgas prepaid; this is an observation, not a universal maximum.
- The loopback bridge trusts one local operator and intentionally controls all disposable roles. Origin checks do not protect a compromised machine/origin. Deposits are not contract-idempotent; reconcile ambiguous outcomes before funding again.
- Recorded `cargo audit` exited **1**: host-only `crypto-bigint` RUSTSEC-2026-0387, unmaintained host `unsafe-libyaml`, and deployed-Wasm `wee_alloc` remain open. Recorded npm scans returned no known advisories. See [dependency findings](docs/DEPENDENCY_REVIEW.md); these observations do not certify safety.
- No Testnet, Mainnet, real-money custody or production-ready security is claimed.

## Attribution and license

BudgetBranch was developed with AI-assisted coding and review under the project owner's direction. Reused libraries and frameworks are credited separately.

The demo agents are deterministic scripts; no live LLM inference is integrated into the application.

Original BudgetBranch material is licensed under [MIT](LICENSE-MIT) **OR** [Apache-2.0](LICENSE-APACHE), at your option. `SPDX-License-Identifier: MIT OR Apache-2.0`. Copyright © 2026 BudgetBranch contributors.

[Attribution](docs/ATTRIBUTIONS.md), [third-party notices](THIRD_PARTY_NOTICES.md) and [license review](docs/LICENSE_REVIEW.md) preserve upstream terms. In particular, Geist remains OFL-1.1 and deployed `wee_alloc` / `memory_units` remain MPL-2.0. The host `near-sandbox` license-file ambiguity remains unresolved; third-party binaries are not bundled or cleared for redistribution by this source license.
