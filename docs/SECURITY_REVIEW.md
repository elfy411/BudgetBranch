> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# G2 independent whole-system security review

**Recommendation: owner acceptance of `1ea24af7c97db1733d920a2949d681218d24687f` for the bounded local Sandbox prototype, with the open dependency risks below. No remaining High/Critical application-security defect or G2 security blocker was identified.** This is the independent reviewer's recommendation, not owner G2 approval or production certification.

Separate reviewer `/root/security_m0`, tool-accepted `gpt-6-astra` / `max`; effective serving telemetry UNKNOWN. The reviewer authored no implementation changes. The integrator read the report, probe source, command exits and public receipt evidence before accepting it. [Complete unmodified report](evidence/m2/security-qa/qa-report.json), [artifact SHA-256](evidence/m2/security-qa/evidence-manifest.json).

## Exact reviewed scope

Baseline `826803d658bf3bddd8f2d7ef03869c2da8e7d4f7` received the whole-system audit. Both subsequent changes were inspected and independently executed on final `1ea24af7c97db1733d920a2949d681218d24687f`. Contracts, SDK, agents, frozen SPEC/ABI, mac build script, browser signer, read proxy and the complete `signerPlugin` body are identical to baseline. [Delta comparison](evidence/m2/security-qa/final-delta-source.json). Final component trees and portable Wasm hashes match the [integration manifest](evidence/m2/integration-manifest.json).

## Independently executed checks

| Layer | Observation |
| --- | --- |
| API and real chain | 56 rejected API cases; each preserved finalized grants, payments, counters, operational funding and business ledger. Tests include Host/Origin/token/method/body limits, private/admin methods, arbitrary contract/gas/deposit/roles, read-proxy privilege and URL injection, filesystem exposure, on-chain wrong caller, narrowed recipient, overbudget and overrefund. Physical liquidity is excluded from equality because gas rewards may change it. [65 evidence records](evidence/m2/security-qa/api-evidence.json). |
| Concurrency and settlement | Concurrent identical requests and subsequent exact retry created one payment. A receiver rejection became Failed in the authoritative view. One-yocto transfer was preserved exactly. |
| Browser boundary | Actual isolated Chrome blocked foreign-origin session access, simple cross-origin writes, native RPC reads and framing. Exact one-yocto rendering, no local/session storage entries and malicious contract query text were checked. [Browser results](evidence/m2/security-qa/browser-evidence.json). |
| Controlled browser faults | Injected read failure, changed-chain status and older finalized block disabled signing while retaining the previous ledger. These are explicitly simulated transport responses, not actual chain changes or node failures. |
| Ambiguous delivered deposit | A QA-only transport preload let a real 1-NEAR deposit reach Sandbox, then discarded its SDK RPC response. The error retained the known transaction hash; a fresh session's second deposit received409. Normal owner refund recovered the full1NEAR. [Lifecycle evidence](evidence/m2/security-qa/lifecycle-evidence.json). |
| Final candidate UI | Four real browser transactions on1ea24af verified root selection and receipt retention, root/child drafts across refresh, and payment settlement:1funded =0.9free +0.1spent, pending/returned0. [Run](evidence/m2/security-qa/final-browser-run.json), [observations](evidence/m2/security-qa/final-browser-run.log). |
| Startup/cleanup | Four malformed ports rejected with exact diagnostic. Real port collision preserved the existing chain and removed the failed fixture's own process/home. SIGINT130 cleaned up both reviewed consoles. [Final diagnostics](evidence/m2/security-qa/final-diagnostics.json), [shutdown](evidence/m2/security-qa/final-shutdown-evidence.json). |
| Build/unit | Baseline SDK18, agents5, web4 unit/MOCK and web production build passed. Final web4/build passed separately. These are not extra on-chain cases. |

All final probe runners exited0. Deliberate startup refusals exited1. Three preliminary browser harness attempts exited1 because of harness expectations/injection matching; their logs are retained and only the QA harness changed. The final browser checks passed. Cold tool downloads, the complete14-transaction UI scenario and Gitleaks scanning were performed by the Integration worker/integrator respectively, not independently repeated by this QA follow-up.

## Findings and retained risks

- **G2-UX-01, Medium usability, resolved:** the first child had changed the default selection away from root. Frontend fixed the default root selection; final independent browser checks confirmed the correction. No financial-state change was involved.
- **G2-DEP-01, Low scoped risk, OPEN:** `crypto-bigint0.5.5` / `RUSTSEC-2026-0387`. `cargo-audit` exits1. The crate is absent from normal deployed Wasm. QA traced the pinned host P-256 path to public message/signature/key verification and found no secret-bearing application use. This does not clear the upstream advisory.
- **G2-DEP-02, Low maintenance risk, OPEN:** host `unsafe-libyaml0.2.11` is unmaintained.
- **G2-DEP-03, Low maintenance/allocator risk, OPEN:** `wee_alloc0.4.5` is unmaintained and **is deployed in Wasm**. Gas bounds are not an allocator correctness proof.

[Full dependency and secret assessment](DEPENDENCY_REVIEW.md). No timing exploit experiment or comprehensive audit of the prebuilt Sandbox/Node executables was performed. A future dependency/allocator replacement requires new builds, artifact hashes and regression/storage/gas review.

The bridge is intentionally a single-operator local fixture exposing all four disposable roles. Same-origin controls do not authenticate local OS users; other local programs can forge Origin/Host and reach privileged native Sandbox RPC. Deposits are not contract-idempotent: the tested ambiguous SDK result blocks another deposit, but this is not universal end-to-end exactly-once funding, particularly after an operator reload following an unknown browser response. Resolve the existing transaction before making a new funding intent.

All G1 limits remain: delayed physical refund window unproven; callback failure can strand pending indefinitely; immutable synchronous receivers only; global normal quotas and finite prepaid recovery; no operational withdrawal. No Testnet, real funds, full autonomous LLM execution, production approval or public release follows from this review.

---

## Historical G1 implementation review

The report below records the package subsequently approved by the owner at `4564d46`; its statements that G2 is not yet reviewed describe that earlier milestone.

# Independent Security QA — M1 implementation and portable build

**Recommendation: present the exact reviewed prototype for owner G1 acceptance. No confirmed Critical/High implementation finding. G1 is not owner-approved.** This is bounded prototype evidence, not production certification or G2 application approval.

Reviewer: separate `/root/security_m0` context, accepted launch parameters `gpt-6-astra` / `max`, `fork_turns=none`. Effective serving telemetry remains UNKNOWN. The reviewer did not author or modify the contract. Integrator actual model/effort remain UNKNOWN / UNKNOWN.

## Exact scope and artifacts

- Final contract source: `e8b437490a4d60c93870c644b2f4cf373dbba601`, integrated as `9b2a9e7c114130cb68ec7f0d5f8e36ddae24607b`; contracts tree `2c691ebdbd23e9d9e22ea67fc3aa22c9b5226106`.
- Initial [implementation report](evidence/m1/security-qa/qa-report.json) assessed this source and its original environment-specific binaries. Its pending portable-build item is superseded by the following addendum.
- [Portable build follow-up](evidence/m1/security-qa-portable/qa-report.json) reviewed immutable candidate `b191642fce6dd00426fa259fa306647ea8538c1f`, accepted as `1e9d1f3d5343d258b44daeb89b6b394c319b0496`. Contracts source is unchanged. A fresh security-worktree target rebuilt the same bytes with the pinned native tools; actual Cargo fingerprints retained `--cfg near` and both intended path remaps.
- Approved-for-review portable BudgetBranch SHA-256: `2c862acc53ae8cd02f6dbf8430c1271ebbf16de27df2e2d5a77c7a52efc5aa23`; receiver: `40bc851605e5084acdb29d163e0b4c4df50dbd62189da63383e16847171f3655`. [Source/build manifest](../tests/portable-wasm.json).

## Independently executed attack probe

The reviewer executed **43 real Sandbox transactions, 22 expected initiating rejections and five successful settlement callbacks**, then repeated that probe on the portable artifacts. Both runs exited0. These were actual Wasm calls without financial state patches, not SDK mocks. [Portable receipts](evidence/m1/security-qa-portable/sandbox-independent.json), [commands and exits](evidence/m1/security-qa-portable/sandbox-run.json), [probe source](PUBLICATION_PROVENANCE.md#omitted-helper-files).

| Probe | Observed result |
| --- | --- |
| Typed request conflicts | All16 method/amount conflicts rejected without ledger or counter changes. |
| Caller namespace | Different authenticated callers can use the same textual request ID for their own authorized intents. |
| Payment queued before a later failed action in the same receipt | Entire receipt rolled back pending, request and outgoing promise. Receiver and state remained unchanged after five further blocks; the aborted ID then succeeded exactly once. |
| Exact retry after root revoke | Four10-Tgas retries returned original results without effects; four nonzero-deposit retries rejected ERR_DEPOSIT; a fresh spend rejected ERR_REVOKED. |
| Recovery and conservation | Final funded10 NEAR = spent(2 NEAR+1 yocto) + returned(8 NEAR−1 yocto), with free/pending0. |
| Deployment trust | Deployed code matched reviewed bytes; contract access-key lists were empty. |

The reviewer read the developer's 15 unit contexts and ten real suites, but did **not** independently rerun all ten. The integrator separately reran all ten, including on the portable artifacts; [integrator evidence](evidence/m1/integrator-portable-build/summary.json) must not be attributed to QA.

## Remaining evidence gaps and accepted limits

- **Medium evidence gap:** no controlled new dispatch between successful callback settlement of a failed receiver payment and later physical deposit refund. Those receipts appeared in one block; within-block order is not inferred. The physical-cash guard is present, with synthetic low-cash ERR_LIQUIDITY coverage and real final refund receipts. This gap is explicitly allowed to be reported by SPEC.
- **Medium coverage limit:** exact expiry, authenticated duplicate callback and callback execution failure/OOG remain unit-context checks. Real unauthorized callback rejection is covered. A lost or failed callback may strand pending forever; no timeout or administrative release exists.
- **Measured bounds:** maximum-width/depth storage and callback gas plus normal-cap recovery were exercised. The combination of every reachable maximum was not independently executed. Reachable requests are at most4735 =639normal+4096recovery; the configured5120 sum is unreachable and is not a missing required case.
- Only reviewed synchronous immutable receivers are supported. Normal quotas are shared; recovery quotas are separate, prepaid and finite. Operational funding is outside the business budget and cannot be withdrawn.
- No Testnet execution, full integrated UI/bridge security audit, production certification or G2 recommendation is claimed. The browser bridge received integrator review and actual UI/guard checks separately.

The initial localhost-restricted QA attempt exited1 before node startup, then authorized local execution exited0. A portable-build preflight stopped because one local tool root lacked pinned Node; an already provisioned project tool root succeeded. Both failed attempts remain recorded. No global environment changes were required.

The historical M0 report below is retained as architecture history; its “not run” statements describe M0 only.

---

# Historical M0 architecture review

**Recommendation: ACCEPT FOR G0 ARCHITECTURE REVIEW, with the prototype limits below.** This is a recommendation to the owner, not G0 approval, contract certification or a security PASS. No implementation exists at this milestone.

Reviewer: separate native agent `/root/security_m0`, explicitly launched `gpt-6-astra` / `max` with `fork_turns=none`. Launch parameters were accepted; independent serving telemetry is not exposed. The reviewer did not write implementation or modify project files. The integrator applied all proposed draft corrections and transcribed this report.

## Reviewed evidence

The reviewer read the original required planning files, root SPEC and `docs/abi.ts`, checked official sources, manually verified accounting and calculated file SHA-256. Read/hash commands succeeded. No implementation commit was available during review; fingerprints identify the reviewed draft:

- SPEC: `3064d65e1af606b6f5546ed82b72fc1e00266353c29c5969c02a64d95b91fea6`.
- ABI: `49e837b610448e6b85f9a4eab610b904aeefb7566194478e753bcd140ab6e0ba`.

After this reviewed fingerprint, the integrator applied the reviewer's sole remaining editorial correction: replace the impossible 1024-normal-request saturation trace with reachable grant/spend saturation and the derived 639-request bound. No accounting or ABI behavior changed. The final M0 validation records the resulting file hashes.

## Findings and disposition

| ID / severity | Reproduction or reasoning | Expected vs draft | Disposition |
| --- | --- | --- | --- |
| M0-01 / High | Agent sends many tiny authorized spends until a shared payment/request cap is full, then owner attempts refund of unrelated free funds. | Expected: recovery remains possible. Original draft: shared cap could permanently deny new refund/reclaim records. | **Resolved in design.** Separate 1024 refund / 4096 recovery request quotas and pre-funded remaining recovery storage. Normal operations cannot consume them; callbacks/revoke/topups remain quota-free. Must prove in G1 without new funding after normal-cap saturation. |
| M0-02 / Medium | Compare initiating, receiver and callback out-of-gas receipts. | Earlier wording implied every gas failure leaves a pending payment, or a failed callback produces reclaimable free. | **Resolved in wording.** Initiator rolls back, receiver failure is settled by callback, failed callback leaves pending. Only successful settlement of a failed payment restores source free. |
| M0-03 / Low | Maximum normal request count is 127 delegate + 512 spend = 639. | Requiring a real 1024-record saturation trace was unreachable under tighter caps. | **Editorial correction applied.** Saturate reachable caps and assert the 639≤1024 bound. |

The reviewer independently confirmed that local equations telescope to `funded = Σ(free + pending + spent) + root.returned`. Lifetime child commitments must never be added to descendant/global totals. The full scenario is consistent, including A.returned=5, root.child_reserved=5 after reclaim and final free/pending/spent/returned = **3/0/2/5**.

Direct predecessor+signer authorization, authenticated replay ordering, immutable argument identity, ancestor enforcement, private settlement and revoked-source failure restoration are coherent at the specification level. Wire types match methods, ledgers, counters, pagination and events.

## Threat constraints incorporated before implementation

1. **Receiver-returned Promise trap.** The immediate receiver may keep the deposit while a returned downstream promise fails. Thus arbitrary receivers cannot safely trigger automatic recredit from a failed final promise alone. v0.1 permits reviewed synchronous immutable receivers only; use local WASM or immutable global code by hash, no mutable global code by account. This is a deployment trust assumption. See [NEAR receipt behavior](https://docs.near.org/smart-contracts/anatomy/crosscontract) and [runtime return semantics](https://near.github.io/nearcore/RuntimeSpec/FunctionCall.html).
2. **Successful oversized/malformed data.** Never turn decoding failure into refunded money. The [pinned near-sdk 5.30.1 source](https://raw.githubusercontent.com/near/near-sdk-rs/near-sdk-v5.30.1/near-sdk/src/environment/env.rs) implements `promise_result_checked(0, 0)` so empty success is Ok, nonempty success is TooLong, and actual runtime failure is Failed. Both success forms settle spending; no result-data copy is required.
3. **Delayed refund liquidity.** Failed-receipt refunds are separate receipts and need not precede callback. Recredit logical free without asserting cash arrival; protect operational/storage balance before every later outward promise. No unconditional callback refund. See [NEP-616's refund discussion](https://github.com/near/NEPs/blob/master/neps/nep-0616.md).
4. **Storage and gas.** Lazy collections must be flushed or conservatively accounted, including serialized root/index growth. Callback records must be fully preallocated and fixed in size. Native NEAR endowment does not replace prepaid callback gas. [SDK collection persistence](https://docs.rs/near-sdk/latest/near_sdk/store/index.html).
5. **Settlement and recovery.** Revoke affects new activity, not in-flight settlement. No timeout/admin statement/balance increase proves failure. Unsettled payments remain reserved; owner only reclaims genuine free. [Private callbacks](https://docs.near.org/smart-contracts/security/cross-contract-calls/callbacks) and [callback failures](https://docs.near.org/smart-contracts/security/cross-contract-calls/callback-failures).

## Residual risks accepted only as proposed demo scope

- Arbitrary merchants/upgradeable receivers are unsupported; deployment immutability is not enforced by an on-chain code-hash registry.
- Callback failure may lock that payment's funds indefinitely; no unproven force-settlement mechanism is allowed.
- Normal quotas are global and agent-exhaustible, so new sibling spending can be denied even though recovery remains protected.
- Repeated voluntary partial/failed owner recovery can exhaust the owner's separate finite quota.
- Actual serialized storage bounds, reserve funding amount, worst-case callback gas, dependency compatibility, physical refund receipts and native recovery behavior remain unproven.

G1 must independently reproduce negative direct calls, malicious signer forwarding, request collisions/replay, forged and duplicate callbacks, both revoke/pending orderings, delayed-refund liquidity, maximum state/gas, cap-exhaustion recovery and the actual contract→SDK scenario. A developer's report and unit mock contexts cannot substitute for receipt evidence.

**QA-executed contract/unit tests: none. Sandbox: not run. Testnet: not run.** The integrator separately executed a SPEC arithmetic model (12 snapshots); that result is not independent on-chain QA. The next security review must name the real implementation commit and commands, and fixes must be authored by Contract Engineer and independently rechecked.
