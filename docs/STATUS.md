> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# Publication status

The owner approved preparation of a separate sanitized publication from source snapshot `dc0f85dd34b2457c21f03ca56d83aaf7a7aaaf4f`, with the initial GitHub README as its only prior commit. Private development branches and history remain unchanged. Financial/runtime sources, interfaces, dependency pins and third-party notices are preserved. This is preparation authorization only; no push, visibility change, video publication or submission is authorized.

The release-specific clean-checkout results and independent privacy review are bound to the new candidate SHA in the separate owner review packet. Historical results below are not a substitute for those checks. See [publication provenance and the change inventory](PUBLICATION_PROVENANCE.md).

## Historical private development status

**G0/G1/G2 AND G3 SOURCE-LICENSE REVIEW APPROVED; FULL G3 PENDING OWNER REVIEW.** Updated 2026-11-13. Repository `/REDACTED_USER_HOME/Desktop/BudgetBranch`; active preparation branch `integration`. Local `main` is `4de180536eb75ebf3d653c063ef20ef7ba6dadc8`, containing independently reviewed runtime `1ea24af7c97db1733d920a2949d681218d24687f`. No remote, push/publication/Mainnet/real spending or submission occurred.

The owner personally tested the real Sandbox application, reported final **3 free / 0 pending / 2 spent / 5 returned NEAR**, and authorized transferring the exact checked integration version to local main. Before that operation, the tree was clean and no main branch existed; main was created directly at4de1805. [G2 approval and exact document versions](G2_APPROVAL.md). G1 remains approved at `4564d46d8019789146226fc4cd4b5e5aa25fcb80`; [G1 approval](G1_APPROVAL.md). Historical G2 reports below describe their pre-approval state.

## G3 preparation

- **Final packet:** [release readiness](G3_REVIEW.md), [main-transfer inventory](release/MAIN_TRANSFER.md), English submission copy and 112-second recording script are ready for the owner's separate G3 decision. Video is not recorded and public inputs remain outstanding. Main stays at G2.
- **License review approved:** the owner's latest decision accepts source distribution at exact `bcfc9f96b02c36df5f1d899270e7c4b7cb8c4e04`, preserving MPL/OFL/notices and the host near-sandbox ambiguity. Prebuilt third-party tool distribution is not approved. [Decision and fingerprints](G3_LICENSE_APPROVAL.md).
- **Final README verification at bcfc9f9:** fresh clean detached checkout, explicit pinned parent tool/cache reuse. Bootstrap, fresh Wasm, real Sandbox 19 steps / 18 transactions / 6 direct rejections, Rust 15 / SDK 18 / agents 5 / web 4, web install/build and HTTP guards passed. Final 3/0/2/5; SIGINT 130 removed the node home and closed the listener. Integrator checked 23 recorded snapshot invariants, actual failed-receiver and native owner-refund receipts, and all 17 fresh artifact hashes. [Report and exact commands](evidence/m3/final/readme-check/README.md), [acceptance](evidence/m3/final/integrator-check.json). No new cold download, interactive browser or full contract-suite run is claimed.
- **G2-to-G3 scope:** 226 paths through bcfc9f9 are documented; executable source and scripts, contract tree, frozen interfaces and dependency resolutions are unchanged. Package JSON changes contain only project license metadata; web adds seven legal text files with eight original assets unchanged. Later final-packet changes contain documentation/evidence only. [Manifest](evidence/m3/final/change-manifest.json).
- **Final G3 secret scan:** Gitleaks 8.30.1 scanned 676 source/evidence files and all 47 then-reachable commits. Both exits 1, six matches per scan, all independently recomputed public artifact SHA-256 values. Zero confirmed secrets/unresolved matches, no suppression. New scanner outputs and later outcome/QA metadata are outside that snapshot and checked separately. [Exact triage](evidence/m3/final/secrets/triage.json).
- **Final independent QA:** ACCEPT suitable for OWNER REVIEW at exact `f340f84e43e51b71d5893990455a59cb612766e7`, plus six fingerprinted metadata drafts. QA checked 34 raw files, 17 artifacts, 23 snapshots, 676 scan inputs, six checksum matches and eight post-snapshot files. One Low history-inventory gap was corrected: ordinary refs cover 46 commits; the retained detached verify-web HEAD supplies the logged 47th. Raw scans are unchanged; the addendum is explicitly a reconstruction. [Final report](evidence/m3/final/qa/README.md). The final child commit contains accepted metadata, QA evidence and outcome links only; full G3 remains pending.

- English [README](../README.md), [demo/video plan](release/DEMO.md), [submission/X drafts](release/SUBMISSION.md), [attributions](release/ATTRIBUTIONS.md) and [three optional UX proposals](release/UX_REVIEW.md) are prepared in integration. No runtime UX or financial changes are included.
- Integration Tests worker source `106253b2e8c5ddf5cfefaa3c4635dcba02eb125d` accepted as `adec7f8`: fresh checkout of exact main4de1805, explicit project-local tool/cache reuse, no prior build outputs. Two real SDK/CLI runs each passed19 steps/18 transactions/6 rejections and3/0/2/5; Rust15/SDK18/agents5/web4 and production build passed. HTTP startup/bridge refusal/SIGINT cleanup passed. [Report](../tests/evidence/g3-native-mac.md), [public raw evidence and hashes](evidence/m3/clean-mac/manifest.json). Integrator independently inspected raw logs, exits and fresh Wasm hashes. This recheck is not a new cold download or interactive browser run.
- Frontend reviewer recommended recording the approved build with framing/captions, leaving all three small UX changes optional. No new video was recorded.
- **Owner confirmed MIT OR Apache-2.0 on2026-11-13** for original BudgetBranch material. Existing contracts/Cargo.toml remains unchanged. Root license texts, SPDX/manifest metadata and README License are complete. Reviewed438lockedCargoarchives and57uniquenpmpackages;36normalWasmcrates include2MPL components. Third-party notices preserved; host near-sandbox MIT/Apache versus GPL-file ambiguity remains explicit. Web notice packaging adds7textfiles; all8runtime output hashes are unchanged. Independent QA accepted exactd05ebc4 plus the fingerprinted path correction; scoped159-file Gitleaks scan exit0/0findings. This does not authorize publication. [License review](LICENSE_REVIEW.md).
- Independent G3 QA reviewed exact665874f and separately fingerprinted the corrected draft: one Low ancestor-check wording issue resolved; no new High/Critical application finding. QA independently checked all460 scanned Git blobs, five public checksum matches and retained test evidence. [Report](evidence/m3/security-qa/security-release-review.json). Gitleaks all41reachable history/source460 both exit1 with five public SHA-256 matches,0 confirmed secrets and0 unresolved; no suppression. [Scope/triage](evidence/m3/secrets/triage.json). The subsequent16-file staged metadata delta scanned exit0/0findings; [exact scope](evidence/m3/secrets/delta-run.json). Result files and final outcome links are separately reviewed. [G3 packet](G3_REVIEW.md). Publication/submission remain separate owner gates.

## G2 accepted deltas and verification

Frontend source `7a5401a` was accepted as `a30df84`; startup source `277a0ef` was accepted as `1ea24af`. Root selection and drafts survive finalized refreshes, and startup errors distinguish bad ports, occupied ports and denied loopback. Contract, SDK and agents trees plus frozen interfaces are unchanged from G1. [Exact trees/hashes and async delegation record](evidence/m2/integration-manifest.json).

- Clean Mac826803d: empty local tools/caches, own bootstrap download; Wasm, real SDK19/18/6, Rust15/SDK18/agents5/web4 unit/MOCK and web build passed. A source archive with spaces independently rebuilt matching Wasm using that newly downloaded toolchain. [Cold evidence](evidence/m2/clean-mac/manifest.json).
- Combined1ea24af: integrator independently repeated real SDK19/18/6, web4/build and startup diagnostics; all verification commands exited0, expected startup refusals1. [Run](evidence/m2/integrator-combined/run.json).
- Final real browser:14 transactions,3 initiating rejects, narrowing all three rights, actual Pending/Failed/Succeeded, revoke inheritance, owner refund5. Final3/0/2/5, independently checked against RPC and all ledger equations. [Run/screenshot](evidence/m2/integrator-final-ui/scenario.json).
- Independent whole-system QA covers API/browser/signing, concurrency, exact1yocto, failed receiver, ambiguous delivered deposit and cleanup; final selection/startup delta independently executed on1ea24af. [Report](SECURITY_REVIEW.md).
- npm audit:0 known advisories. Cargo audit:**exit1**, one vulnerability advisory in host crypto-bigint and two unmaintained warnings; wee_alloc is deployed. Gitleaks history:0 findings; final source exit1 has5 matches, all recomputed public artifact hashes and classified false positives,0 confirmed secrets. [Open risks and evidence](DEPENDENCY_REVIEW.md).
- Live-agent feasibility assessed; no standalone inference service found, no LIVE AI runtime executed. Scripted agents remain the reproducible baseline.

## M1 accepted implementation (retained history)

- Owner-approved G0 source: `a7057f2a0e68b71eacb2e0e277d1b0d3fcbd7ab2`. Freeze: `fa17fddbf8552d499851076ed926214cf810bd28`, tag `g0-approved-v0.1.0`. [Document versions/hashes](FROZEN_INTERFACE.json) remain unchanged.
- Contract source `e8b437490a4d60c93870c644b2f4cf373dbba601` → integration `9b2a9e7c114130cb68ec7f0d5f8e36ddae24607b`; contracts tree `2c691ebdbd23e9d9e22ea67fc3aa22c9b5226106`.
- SDK/Agents source `83323be4431889b23a1071c1ebe758986dd9eff0` → integration `85555d69e87ac5c8f6cf445c84bc7664aeeb0b9f`.
- Frontend source `bdb6c64f9ca78366fc165d871d08b41d7aeace95` → integration `00bfc142b3d0a488861c8210fa022b6a978fbeac`, final cosmetic source `cf36ae1facdec4c9ac7f02a0a435247ec65afc5a` → integration `51b161465a509c117f39487972c24128393651a8`; [final web4/build verification](evidence/m1/integrator-web-final/run.json).
- Native bootstrap/portable SDK fixture source `b191642fce6dd00426fa259fa306647ea8538c1f` → integration `1e9d1f3d5343d258b44daeb89b6b394c319b0496`.
- Local browser fixture source `e69b0257d520bfedaf02bdc30ceaee62af0337ad` → integration `5f5a29ab7a71950b06c9bc5fe52ac16629b31925`. Manual-runbook correction source `f9f60743a3dc6c49b5f9681b4287c854a6636a2b` → integration `1afe14dde40f95d89412c59854a437232104edf0`.

The integrator checked actual diffs, independently executed appropriate checks, and accepted these changes only into integration. Frozen ABI reconciliation covers 16 methods, 23 validation errors and 8 events; SDK wire types and fingerprint vectors agree. [Final interface check](evidence/m1/final-interface-check.json).

## M1 executed evidence (retained history)

| Layer | Actual result and evidence |
| --- | --- |
| Project-local tools | Rust/Cargo 1.95.0, wasm32-unknown-unknown, Node 24.14.0 / npm 11.9.0, native ARM64 Sandbox 2.14.0 / protocol 88. [Bootstrap/SDK run](evidence/m1/integrator-sdk-sandbox/run.json). |
| Contract unit contexts |15 passed, exit 0. Synthetic cases are not chain receipts. [Combined accepted checkout run](evidence/m1/integrator-combined-unit/run.json). |
| Contract real Sandbox |All ten suites exited0: cycle/full/capacity/storage-boundary/interleaving/negatives/adversarial/refund-failure/maximum-state/refund-order. Repeated on portable Wasm. [Summary](evidence/m1/integrator-portable-build/summary.json). |
| Full frozen scenario |Deposit10,A6 / B4,child4, denied over-allocation/recipient, successful and failed receiver, revokeA, validB, reclaim3/5 and native owner refund5. Final free/pending/spent/returned3/0/2/5. `full` includes11 initial denials. |
| Capacity recovery |128 grants,512 spends,639 reachable normal requests; pending callbacks settle; revoke,127 reclaims and refund succeed without new operational funding. |
| Storage/gas |Payment 304 B / recovery request 242 B; initial recovery reserve13.02528 NEAR plus actual storage and0.1 NEAR buffer. Max measured callback2.302466890107 Tgas of30 on portable artifacts. Maximum-width/depth case has128 grants,8 receivers,64-byte IDs; callback storage does not grow. |
| Real SDK scenario |19 steps,18 direct transactions,6 expected on-chain rejections, final3/0/2/5, exit 0. [Raw JSONL](evidence/m1/integrator-sdk-sandbox/sdk-sandbox.jsonl). |
| SDK/agents unit and MOCK |18 SDK + 5 agents passed; CLI and golden vectors verified. [Initial acceptance](evidence/m1/sdk-complete-review/run.json), [combined rerun](evidence/m1/integrator-combined-unit/run.json). |
| Web |4 unit/MOCK checks and build passed at initial acceptance; live UI independently executed13 transactions and final3/0/2/5. [Browser scenario](evidence/m1/integrator-live-ui/scenario.json). |
| Browser bridge restrictions |Foreign Origin, absent fixture token and privileged read-proxy RPC all HTTP 403. [Evidence](evidence/m1/integrator-live-ui/bridge-guards.json). |
| Independent Security QA |Exact contract review plus43 real transactions,22 expected rejects and5 callbacks. Independently rebuilt portable artifacts and repeated probe. No confirmed Critical/High finding. [Report](SECURITY_REVIEW.md). |

Real tests include private callback spoof rejection with actual promise dependency, signer forwarding denial, oversized successful return remaining spent, pending/revoke/reclaim interleavings and actual native refund transfer failure. Failed receiver calls restore logical free only through a successful callback. Missing/failed callbacks never release pending by timeout or administrator decision.

## Reproducibility and environment

`./scripts/mac.sh bootstrap`, `sdk-sandbox`, `unit`, `web` provide the native entry points. [English README](../README.md), [full native runbook](../scripts/README.md), [toolchain detail](LOCAL_TOOLCHAIN.md).

**Resolved build issue:** clean CARGO_HOME paths originally changed Wasm bytes through embedded panic strings. The accepted script adds target-specific Cargo/source prefix remaps while retaining `--cfg near`. Source/ABI is unchanged. Independent builds matched the [portable manifest](../tests/portable-wasm.json); the integrator reran ten suites and QA repeated its separate real attack probe. Earlier environment-specific hashes remain historical under [integrator-final-contract](evidence/m1/integrator-final-contract/summary.json).

**OrbStack:** installed, but observed process absent and daemon socket missing. `docker context ls` selected `orbstack`; `docker info` exit 1. Native ARM64 was selected because it actually runs the real tests without a container daemon. No global Docker changes, container PASS or working Dockerfile claim. [Executed Docker checks](evidence/m1/docker-assessment.json), [runtime comparison](RUNTIME_CHOICE.md).

Homebrew Rust remains 1.94.0; no shell profile, global npm package or global model setting changed. Default restricted DNS/localhost attempts failed and scoped tool permissions succeeded; those attempts remain in evidence. No auto-review rejection occurred. Generated Sandbox validator files stayed in private ignored local/temp directories; caller keys and signed transactions were not logged or committed. Subsequent G2 Gitleaks history/source scanning is described above with exact scope; it is not proof that every possible secret is absent.

## Independent QA scope and remaining limits

The independent reviewer did not author the contract. Exact source e8b4374 and portable build candidate b191642 are reviewed; [portable addendum](evidence/m1/security-qa-portable/qa-report.json) supersedes the initial pending build item. The probe tests16 typed replay conflicts, per-caller namespaces, whole-receipt rollback of a queued outgoing promise, aborted-ID reuse, exact post-revoke retries and recovery. QA did not rerun all ten suites; the integrator did.

1. **Physical refund timing:** no controlled dispatch between successful failed-payment settlement and a later physical deposit refund. Observed receipts landed in one block; no within-block ordering inferred. Low-cash ERR_LIQUIDITY has unit-context coverage, while ordinary real refund receipts and final cash are observed.
2. **Callback edge cases:** exact expiry, authenticated duplicate callback and callback execution failure/OOG are unit-context checks. Real forged callbacks and pending/revoke are covered. Missing/failing callback can strand pending indefinitely; there is no administrative/time-based release.
3. **Trust and availability:** only reviewed synchronous immutable receivers; no arbitrary merchants. Shared normal quotas can halt sibling new activity; separate recovery quotas are prepaid and finite. Operational endowment is not withdrawable.
4. **Measured bounds:** storage and maximum-width/depth gas are measured. Not every combination of all reachable caps was executed. Reachable request bound≤4735, not the unreachable5120 configured-cap sum.
5. **G2/G3:** independent whole-system review and owner exercise/approval are recorded for exact G2. Local main now points at4de1805. No hosted CI run, Testnet run, release video, public repository or submission is claimed; G3 remains pending.
6. **G2 dependency and local-trust risks:** cargo audit is not clean; wee_alloc remains a deployed unmaintained dependency. The local bridge is a trusted single-operator fixture, not multi-user authorization. [Details](DEPENDENCY_REVIEW.md).

## Roles and asynchronous execution

Requested integrator role remains Astra 6/Max; actual model and effort are **UNKNOWN/UNKNOWN**. Tool-accepted worker settings are Astra/max for Contract and Independent QA, Sol 6.1/max for SDK/Agents, Frontend and Integration Tests. Effective worker serving telemetry is UNKNOWN. [Launch records](evidence/m1/worker-launches.json) and [ownership](WORK_ALLOCATION.md).

Contract/SDK/Frontend ran in separate worktrees after G0. Integration Tests and independent QA used freed slots; no more than four total concurrent agents including root. Results were delivered asynchronously, checked and either accepted or returned for narrow corrections. No duplicate agent task or busy status polling was needed.

## Historical M0

M0 architecture/tooling snapshot: `6e7ef828c9a496ff264b726a8e48aab5c67e92d8`. At that point Rust 1.94 lacked the Wasm target and no implementation/Sandbox payment existed. [Environment commands](evidence/m0/environment.json), [12-snapshot arithmetic model](evidence/m0/accounting-result.json), [initial validation](evidence/m0/validation.json). These are historical preparation, not M1 execution evidence. The [security review](SECURITY_REVIEW.md) retains the M0 architecture report separately.

Original planning documents remain preserved. G0 reconciliation and approved document fingerprints are in [G0_APPROVAL](G0_APPROVAL.md) and [FROZEN_INTERFACE](FROZEN_INTERFACE.json).

## Gates and next action

| Stage | Status |
| --- | --- |
|M0|DONE; architecture reviewed and frozen after owner G0|
|G0|APPROVED FOR IMPLEMENTATION; architecture unchanged|
|M1 / G1|M1 complete; real contract/negative/recovery evidence and independent QA ready; **G1 APPROVED at4564d46**|
|M2 / M3 / M3b|SDK, scripted agents, UI and local integration runner accepted; real SDK and browser scenario passed|
|M4 / G2|**APPROVED TO MERGE** after owner exercise; local main created at exact4de1805|
|M5 / G3|Source-license review approved; final technical packet/recording materials ready; **FULL G3, MAIN TRANSFER, PUBLICATION AND SUBMISSION PENDING**|

Next: present the concrete [G3 packet](G3_REVIEW.md), record/review the video, obtain separate publication and submission decisions with the actual release inputs. Main remains the exact G2-approved version while G3 documentation is reviewed in integration. Deadline:2026-11-14T23:59:00Z; [official-rule check](release/SUBMISSION.md#release-requirements-checked-2026-11-13).
