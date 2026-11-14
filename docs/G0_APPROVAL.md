> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# G0 approval — BudgetBranch v0.1.0

Owner decision received in this chat on 2026-11-13: **G0 APPROVED FOR IMPLEMENTATION**.

Approved source commit: `a7057f2a0e68b71eacb2e0e277d1b0d3fcbd7ab2` on `integration`.
Approved SPEC SHA-256 before status activation: `48be3a1f046f763dc1e75bde6ec51ce4eeda2f36fefa55953387be7603c8fe7b`.
Approved ABI SHA-256 before status activation: `49e837b610448e6b85f9a4eab610b904aeefb7566194478e753bcd140ab6e0ba`.

The freeze commit is identified by the local tag **`g0-approved-v0.1.0`**; `git rev-parse g0-approved-v0.1.0` resolves its exact SHA. All implementation worktrees start from that same commit. `FROZEN_INTERFACE.json` records the v0.1.0 files and hashes after status-only activation. Protocol behavior, method/field names, errors and events are unchanged from the owner's reviewed source. `evidence/m1/interface-reconciliation.json` records the actual pre-freeze comparison: 16 methods, 23 validation error codes, 8 events, no mismatch.

Approved scope: one funded contract, logical nested reservations, narrowing authority, private payment settlement, revoke, reclaim and refund_owner. Accepted prototype limits: reviewed synchronous immutable receivers only; no forced settlement of lost/failed callbacks; global normal quotas without independent sibling availability; separately bounded and prepaid recovery capacity. No arbitrary-receiver, guaranteed-pending-recovery or production-security claims are authorized.

Actual integrator model: **UNKNOWN**. Actual integrator effort: **UNKNOWN**. Required role matrix remains Astra Max for Contract/QA and Sol 6.1 Max for SDK/Agents, Frontend and Integration Tests. Accepted explicit tool launch parameters are evidence of requested configuration, not independent model-serving telemetry. Do not conflate the two.

M1 priority: compatible **project-local** toolchain and a real Wasm→Sandbox→receiver→callback cycle. No global environment changes, mocks substituted for chain behavior, manual financial bypasses or timeout returns of pending funds. Preserve Failed/TooLong distinction and the physical liquidity guard.

G1 still requires actual success/failure receipts, the full SPEC scenario with owner refund, direct negative calls, storage-reserve and callback-gas measurements, recovery after normal-cap saturation, and independent QA of an exact implementation commit. SDK/Frontend may proceed in isolated worktrees after freeze; Integration and QA use free slots. Only reviewed changes enter `integration`.

This approval does **not** authorize G1/G2/G3 acceptance, merge to main, push, publication, Mainnet, real expenses or personal secrets. Renew G0 only for a material architectural amendment.
