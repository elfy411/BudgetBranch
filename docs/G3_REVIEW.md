> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# Final G3 owner-review packet

**Technical preparation is complete for owner review. Full G3, public release and submission are not approved.** The owner approved the source-license review on 2026-11-13; [that decision](G3_LICENSE_APPROVAL.md) is recorded separately. Actual video recording and public release inputs remain outstanding. No production-ready security claim is made.

## Release identity and readiness

| Item | Exact scope / status |
| --- | --- |
| Local main | `4de180536eb75ebf3d653c063ef20ef7ba6dadc8`, the G2-approved package; unchanged |
| Current tested source | **`bcfc9f96b02c36df5f1d899270e7c4b7cb8c4e04`**; clean Mac README verification after licensing integration |
| Whole-system security-reviewed runtime | `1ea24af7c97db1733d920a2949d681218d24687f`; application source unchanged |
| Contract tree | `2c691ebdbd23e9d9e22ea67fc3aa22c9b5226106`; [frozen fingerprints](FROZEN_INTERFACE.json) unchanged |
| BudgetBranch Wasm SHA-256 | `2c862acc53ae8cd02f6dbf8430c1271ebbf16de27df2e2d5a77c7a52efc5aa23` |
| Receiver Wasm SHA-256 | `40bc851605e5084acdb29d163e0b4c4df50dbd62189da63383e16847171f3655` |
| Source licensing | **APPROVED**; original material MIT OR Apache-2.0; third-party obligations and host ambiguity retained |
| README, English copy, video script | Ready; no actual G3 video claimed |
| Public repository, X video post, submission | Not created or submitted; require separate owner decisions |

The immutable final package commit is reported in the integrator's handoff, avoiding a self-referential hash here. Changes after the tested source are documentation and verification records only. [Main-transfer plan and path inventory](release/MAIN_TRANSFER.md) identify proposed changes. Preparation stays in integration; there is no configured remote.

## Materials for judges and recording

| Material | Contents |
| --- | --- |
| [English README](../README.md) | Problem, NEAR enforcement, commands, expected outputs, limitations, attribution and license |
| [Contest description and X draft](release/SUBMISSION.md) | 1,050-character English description and 219-character post before the URL; unpublished |
| [Video script](release/DEMO.md) | Approximately 112-second English edit, operator actions, narration and captions; 13 initiating transactions including two explicit rejections |
| [Optional UX improvements](release/UX_REVIEW.md) | Three proposals; framing/captions allow recording with the approved application |
| [Attributions](release/ATTRIBUTIONS.md) | Planning baseline, third-party components and AI development roles; distinct from scripted product agents |
| [Final README check](evidence/m3/final/readme-check/README.md) | Exact source checkout, commands, logs and artifact hashes |

The demo shows funding 10, A=6/B=4, child=4, over-allocation rejection, narrower rights, successful payment, unknown receiver rejection, allowed receiver failure, inherited revocation, a working sibling, reclaim and a native owner refund of 5. Final totals: **3 free / 0 pending / 2 spent / 5 returned NEAR**. The existing G2 screenshot is an actual capture and composition aid, not the required video. The script distinguishes request acceptance from settlement and logical reclaim from physical refund.

## Final executed checks

The Integration Tests worker used a clean detached checkout at `bcfc9f9`, initially without local tools, caches or build outputs. It explicitly reused the parent project's pinned tools and warmed downloads through `BB_TOOLCHAIN_ROOT`. This is a fresh-output build, **not another cold-download run**. [Earlier G2 cold reproduction](../tests/evidence/g2-native-mac.md) covers first installation; the [current raw report](evidence/m3/final/readme-check/final-readme-check.md) records adaptations and platform.

| Check | Result |
| --- | --- |
| Native bootstrap | Exit 0; Apple Silicon, Rust/Cargo 1.95.0, Node 24.14.0, npm 11.9.0, Sandbox 2.14.0 / protocol 88 |
| Fresh Wasm → Sandbox → receiver → callback | Exit 0; 19 steps, 18 transactions, six expected direct contract rejections; final **3/0/2/5** |
| Unit/MOCK checks | Exit 0; Rust 15, SDK 18, agents 5, web 4; separate from real chain evidence |
| Web install/build | Exit 0; eight original output files unchanged; seven notices equal their public sources |
| Wasm artifacts | Both fresh hashes equal approved portable pins |
| Live HTTP entry point | Page and finalized snapshot HTTP 200; fresh business funding 0, one grant, no payments |
| Bridge guards | Foreign Origin, absent signing token and privileged read-proxy method each return 403 |
| Shutdown | Intentional SIGINT exit 130; listener closed, temporary node home removed |

The integrator inspected logs and receipts, verified conservation in **23 recorded snapshots** and independently rehashed **17** built artifacts. Real failed-receiver deposit-refund and owner-transfer/callback receipts are present. [Acceptance checks](evidence/m3/final/integrator-check.json), [raw manifest](evidence/m3/final/readme-check/manifest.json). These are not a new interactive browser run or independent execution of all contract suites.

Retained evidence covers ten real direct-contract suites; recovery after 128 grants, 512 spends and 639 reachable ordinary requests using 127 reclaims and owner refund without new operational funding; independent contract/API/browser QA; owner G2 testing; and the integrator's 14-transaction browser flow. [Contract results](../contracts/README.md), [whole-system review](SECURITY_REVIEW.md), [G2 approval](G2_APPROVAL.md).

Conservative storage bounds remain **304 B per payment / 242 B per recovery request**. Initial recovery reserve is **13.02528 NEAR**, plus actual storage and a **0.1 NEAR** buffer. Maximum observed callback gas: **2.302466890107 Tgas** from a fixed **30 Tgas** allocation. This is a measurement, not a universal maximum.

## Independent review, dependencies and secrets

Independent G3 documentation QA reviewed `665874f445a23a1a35db09f0c5cb6b9e803eac88` and accepted a wording correction: full-ancestor activity checks apply to new delegations/spends; recovery remains available after revocation. [Report](evidence/m3/security-qa/security-release-review.json). Independent licensing QA reviewed `d05ebc47ad55452fc0b80e7aef0e9ad08f85e51d` and accepted the evidence-path correction. [License review](LICENSE_REVIEW.md). Neither review is professional certification or a rerun of every prior test.

**Final independent verdict: ACCEPT suitable for OWNER REVIEW**, exact package `f340f84e43e51b71d5893990455a59cb612766e7` plus six fingerprinted metadata drafts. One Low history-input inventory gap was corrected with an independently checked addendum; raw scan results stayed intact. QA checked the execution evidence and source invariance without repeating the financial suites. [Final report and scope](evidence/m3/final/qa/README.md). The final child commit adds this attestation and outcome links; it does not imply owner approval or another runtime review.

The recorded cargo audit remains **exit 1**: host crypto-bigint RUSTSEC-2026-0387 and unmaintained host unsafe-libyaml / deployed-Wasm wee_alloc. npm audit recorded zero known advisories at its scan time. Dependency resolutions are unchanged; these are retained results, not a new advisory-database refresh. [Assessment](DEPENDENCY_REVIEW.md).

Earlier history/source scans found five public artifact checksums, independently recomputed; the 159-file licensing delta had zero findings; later licensing metadata matched one additional public scan-record checksum. Actual nonzero scanner exits are preserved. All matches were classified with evidence, without suppression: **zero confirmed secrets and zero unresolved reported matches**. [Original triage](evidence/m3/secrets/triage.json), [licensing scan index](evidence/m3/licensing/README.md). Final-packet checks are identified separately; no scan covers files created after its input snapshot.

The final G3 scan used Gitleaks 8.30.1 on **676 source/evidence files and all 47 then-reachable commits**. Both scans exited **1**, each reporting the same six public checksums. The integrator independently recomputed all six against retained artifacts and their historical Git versions: **zero confirmed secrets, zero unresolved matches**, no suppression. [Commands, input fingerprints and triage](evidence/m3/final/secrets/triage.json). Scan outputs and the later outcome/QA metadata are outside that input snapshot and reviewed separately.

The eight post-snapshot files at package `f340f84e43e51b71d5893990455a59cb612766e7` were scanned separately: **exit 0, zero findings**. [Exact delta](evidence/m3/final/secrets/metadata-run.json). The source-distribution check found no tracked tool binaries, build outputs or key files; the only tracked binary is the actual G2 screenshot. [Scope](evidence/m3/final/source-check.json). Final scan-result/attestation metadata is produced after these inputs and inspected separately.

## Remaining limitations

- **Receivers/callbacks:** reviewed immutable synchronous receivers only. Failed permits logical recredit through a successful callback; successful nonempty TooLong remains spent. Lost/failing callbacks may strand pending forever. No timeout refund or administrative bypass.
- **Physical funds:** dispatch checks liquidity after protected operational/storage funding. A controlled logical-recredit versus delayed-physical-refund gap was not reproduced. Low-cash ERR_LIQUIDITY, exact expiry, authenticated duplicate callbacks and callback failure/OOG have unit-context evidence only.
- **Capacity:** shared ordinary quotas do not guarantee sibling availability. Recovery is prepaid and finite; operational endowment is not withdrawable. Not every combination of limits was exercised.
- **Local trust:** the bridge holds disposable roles for one trusted operator, not production wallet/multi-user custody. Local machine/application-origin compromise is outside this boundary. Deposits are not contract-idempotent; reconcile ambiguity before funding again.
- **Execution:** Sandbox-only, scripted agents/manual browser. No Testnet, Mainnet, autonomous LLM or hosted CI run claimed. OrbStack's daemon was unavailable in the recorded check; native ARM64 is the verified route. No working container claim.
- **Distribution:** MPL/OFL and other notices remain applicable. Host near-sandbox license-file ambiguity stays open. No prebuilt third-party tool or complete native-binary SBOM is included or approved for redistribution.

## Owner decisions before public release

1. **Full G3/local main:** review this package and the exact final handoff hash, then explicitly approve any G3 main transfer. G2 approval already placed its exact package on main; later material has not been transferred.
2. **Video:** record and review the actual take with local/Sandbox and manual/scripted labels. No new feature is required.
3. **GitHub:** choose the destination and explicitly authorize exact source content, remote setup if needed, public visibility and push. Include source/notices; exclude generated tools, caches, keys and prebuilt native binaries.
4. **X:** approve the final post and actual video. The owner publishes with event attribution/tags and provides the public URL. Verify all judge-facing links without authentication afterward.
5. **Submission:** confirm lead/contact/team/track and payout-account metadata, public URLs, description and contact consent outside Git. Inspect the complete payload and separately authorize submission. No invented values or duplicate submissions.

The [official-rule check](release/SUBMISSION.md#release-requirements-checked-2026-11-13) was rechecked on 2026-11-13. A public source repository and video post are required for this local-only entry. Deadline: **2026-11-14 23:59 UTC / 18:59 America/New_York**. Mainnet actions, real spending and bundling prebuilt tools remain outside this source-release proposal.

Integrator actual model/effort: **UNKNOWN / UNKNOWN**. Requested roles remain Max; tool-accepted worker settings and unknown serving telemetry remain separate. Existing Integration Tests and independent QA workers are reused asynchronously.
