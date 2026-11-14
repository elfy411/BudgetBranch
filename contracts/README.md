# BudgetBranch contracts — v0.1.0 implementation

This implements the frozen root `SPEC.md` and `docs/abi.ts`. It is a Sandbox-only prototype. Only reviewed synchronous immutable receivers are supported. A failed or missing callback leaves its principal pending indefinitely; there is no timeout, administrative override, or inferred settlement from account balances.

## Reproduce the contract checks

The verified host is **macOS ARM64**, Rust **1.95.0**, `near-sdk = 5.30.1`, `near-workspaces = 0.24.0`, native Sandbox **2.14.0 / protocol 88**. Cargo.lock pins transitive dependencies, including `near-sandbox 0.4.1` and nearcore crates `0.38.1`. The externally selected Sandbox binary is pinned independently: SHA-256 `8e0e1521372b0fce801b7464078c1e95e5a25a0f92ad4b4241451c33fe9e5a2a`.

Run from the checkout root. The wrapper selects only project-local tools; Cargo itself must execute inside `contracts/` to load the checked-in `--cfg near` configuration.

```sh
./scripts/mac.sh bootstrap
./scripts/mac.sh wasm
./scripts/mac.sh env sh -c 'cd contracts && cargo build --locked --release --target wasm32-unknown-unknown -p test-adversary'
./scripts/mac.sh env sh -c 'cd contracts && cargo test --locked -p budgetbranch --lib'
./scripts/mac.sh env sh -c 'cd contracts && for suite in cycle full capacity storage-boundary interleaving negatives adversarial refund-failure maximum-state refund-order; do cargo run --locked -p budgetbranch-sandbox --bin sandbox-evidence -- "$suite" || exit; done'
```

The first Wasm command builds the two portable production artifacts; the next builds only the adversarial test fixture. After dependencies are cached, the wrapper's Wasm command and individual Cargo commands accept `--offline`. These additional direct suites write their fresh results to `contracts/evidence/sandbox-<suite>.json`, replacing that suite's local historical copy. They create independent disposable chains, so new transaction/receipt IDs are expected.

No paid services, user credentials, Mainnet connection or global installation is needed. Sandbox validator files live in a private temporary directory removed on exit; account signers stay in memory. Loopback sockets must be permitted. The Wasm crates fail compilation without `cfg(near)`.

The harness deploys and initializes each contract atomically, deletes its final access key in that same action batch, and verifies the resulting empty access-key list, local code reference, actual Wasm hash, and receiver admin/budget identities. Its receiver policy refuses unknown code, mutable global references, and keyed accounts. Business funding is separate from deployment funding.

## Recorded Sandbox evidence

`evidence/sandbox-cycle.json` records actual transaction/receipt IDs, block hashes, gas, outcomes, pending and terminal events, receiver counters, and accounting snapshots for one accept and one reject. `evidence/sandbox-full.json` records the complete required scenario, including direct negative calls, exact replay after revoke, sibling spending, reclaim, and an actual native owner refund. Final global totals are **free 3 / pending 0 / spent 2 / returned 5 NEAR**. Initiating success is checked separately from receiver/callback outcomes and terminal payment state.

The current **15 Rust unit-context tests** cover conservation, caller checks, exact expiry, narrowing, replay, revoke with a pending payment, duplicate callback, successful nonempty result classification, missing-result rejection, storage widths, recovery reserve accounting, liquidity denial, checked arithmetic, pagination and four SHA-256 golden vectors shared with TypeScript. A rejected callback and elapsed time leave principal pending. These unit contexts are explicitly not Sandbox receipt evidence. Fresh unit results are recorded with the [clean-checkout verification](../docs/VERIFICATION.md).

The initial plain-Cargo build exposed generic Wasm panic traps because it omitted `cfg(near)`. The committed build config fixes this; both Sandbox suites were rerun against the corrected Wasm. No validation error matching is waived.

The **10 real Sandbox suites** have separate evidence files. `evidence/summary.json` derives transaction rejection counts and measured callback gas from the recorded outcomes; an initiating transaction with a failed receiver is not counted as an initiating rejection.

| Suite | Executed evidence |
| --- | --- |
| `cycle` | Actual accept/reject and private settlement; locked code and empty access keys. |
| `full` | Frozen scenario ending 3/0/2/5; 11 direct transaction failures; reclaim and owner refund. |
| `capacity` | 128 grants, 512 spends, 639 normal requests. All scheduled callbacks settle at capacity. 127 reclaims and 1 owner refund succeed without topup. |
| `storage-boundary` | Deposit denied before recovery reserve funding; exact reserve topup; normal growth denied at the boundary; prepaid owner recovery succeeds without another topup. |
| `interleaving` | Same initiating receipt executes spend, revoke and partial reclaim before a later real callback. Both receiver success and receiver failure are settled correctly. |
| `negatives` | Direct validation/gas/depth errors, pending replay dispatches once, two independent transactions compete for one grant's last free amount and only one wins. |
| `adversarial` | Forwarded real owner signer denied; forged callback with a real promise dependency denied; deployment policy refuses Promise-capable unknown code; isolated successful malformed 64 KiB return remains spent. |
| `refund-failure` | Disposable owner is deleted after refund submission and before native transfer; actual transfer fails, successful callback restores free with `ERR_TRANSFER_FAILED`. |
| `maximum-state` | 128 grants, source depth 3, 8 receivers per ancestor, 64-byte account/request IDs. Actual payment+spend request storage growth is 614 bytes; callback does not grow storage. |
| `refund-order` | Real rejected payment, protocol principal refund, receipt block heights and restored physical liquidity. No ordering is inferred within a block. |

`test-adversary` is an explicitly unsupported test fixture. The normal deployment policy refuses it. Only an isolated deployment created for the classifier test temporarily allowlists its malformed-return behavior; this is not evidence of support for arbitrary merchants. The Promise-returning trap code is excluded by policy, not made safe by the budget contract.

## Accounting and storage implementation

Each raw map write is immediate; no lazy collection cache exists. Before every storage-reserve check, the fixed-size root state is serialized to storage explicitly, so the automatic SDK wrapper cannot introduce unmeasured root growth. Grant/payment IDs serve directly as map keys; there is no growing index.

Payments preallocate fixed-width status, failure, and timestamp fields. Callback storage usage must remain unchanged. Only `PromiseError::Failed` restores free; `Ok` and successful nonempty `TooLong` consume the original reserved principal. Unclassified future SDK outcomes fail the callback without changing pending.

Maximum serialized payment value: **255 bytes**; payment key: **9**; measured storage record overhead: **40**; total upper bound: **304 bytes**. Maximum recovery request value: **65 bytes**; bounded caller/request key: **137**; overhead: **40**; total: **242 bytes**. Root fields are fixed-width, including all counters. The initial remaining-recovery bound is `1024 × 304 + 4096 × 242 = 1,302,528` bytes (**13.02528 NEAR** at the tested storage price), in addition to actual storage and the 0.1 NEAR operational buffer. Schema/overhead tests serialize maximum-length account/request IDs and maximum integers. The guard uses runtime storage byte cost.

Normal growth cannot consume protected recovery storage. Each recovery operation consumes its own finite reserved slots. All outward value promises require the actual account balance to cover protected operational funding plus the outgoing amount. Logical free restored by a failure callback is not assumed to have physically arrived.

## Coverage gaps and remaining limits

In the recorded `refund-order` run, the callback and attached-deposit refund execute in the same block; the exact receipt/block IDs are in that evidence file. A dispatch between successful failure settlement and later physical refund was **not reproduced**; `ERR_LIQUIDITY` is tested with a synthetic low-balance unit context. Exact expiry, legitimate duplicate private callback and callback execution failure are unit-context cases; the Sandbox spoof tests exercise actual unauthorized callbacks, not authenticated duplicates. No Testnet execution is claimed. The retained [independent review](../docs/SECURITY_REVIEW.md) describes its exact historical scope and these gaps.

A successful callback that observes a failed receiver restores free. A callback that itself fails restores nothing and leaves the payment pending. No timeout, owner statement, extra deposit or new deployment recovers such pending principal. Global normal quotas can stop siblings' new activity; separate recovery quotas remain finite and can be exhausted by repeated voluntary owner recovery attempts. These prototype limits remain unchanged.

The portable run's maximum measured callback was **2.302466890107 Tgas** against **30 Tgas** prepaid. See the [verification index](../docs/VERIFICATION.md) and [open dependency findings](../docs/DEPENDENCY_REVIEW.md).
