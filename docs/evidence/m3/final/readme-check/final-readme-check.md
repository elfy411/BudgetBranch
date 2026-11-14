> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](../../../../PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# Final G3 README check on Apple Silicon

Verified the release candidate `bcfc9f96b02c36df5f1d899270e7c4b7cb8c4e04` in the clean detached `release-readme-check` worktree. At entry, `.local`, `.cache`, `contracts/target`, and every package's `node_modules` and `dist` were absent. The checkout remained Git-clean. Local `main` stayed at the G2-approved `4de180536eb75ebf3d653c063ef20ef7ba6dadc8`.

The host used macOS 26.3.1 (a), build `25D771280a`, on native Darwin ARM64 with Apple Command Line Tools. All README commands used `BB_TOOLCHAIN_ROOT=/REDACTED_USER_HOME/Desktop/BudgetBranch` to reuse the pinned project-local tools and warmed Cargo/npm downloads. The build outputs were newly produced in the clean checkout. Node.js 24.14.0, npm 11.9.0, Rust/Cargo 1.95.0, and native NEAR Sandbox 2.14.0 with protocol 88 were verified. The pinned Sandbox binary SHA-256 was `8e0e1521372b0fce801b7464078c1e95e5a25a0f92ad4b4241451c33fe9e5a2a`. The earlier G2 cold run covers first downloads from empty caches.

| Command | Exit | Observed result |
| --- | ---: | --- |
| `./scripts/mac.sh bootstrap` | 0 | Verified the installed project-local runtime |
| `./scripts/mac.sh sdk-sandbox --offline` | 0 | Fresh Wasm and SDK/agents builds, real chain with 19 checked steps, 18 SDK transactions and six direct on-chain rejections |
| `./scripts/mac.sh unit --offline` | 0 | 15 Rust unit contexts, 18 SDK unit/mock and five agents unit/mock |
| `./scripts/mac.sh env npm --prefix web ci --offline --ignore-scripts --no-audit --no-fund` | 0 | 25 packages installed from the web lockfile |
| `./scripts/mac.sh env npm --prefix web run build` | 0 | Production web bundle built, including all expected notices |
| `./scripts/mac.sh env npm --prefix web test` | 0 | Four web unit/mock tests passed |
| `python3 /REDACTED_USER_HOME/Desktop/BudgetBranch/.cache/g3-final/check-hashes.py` | 0 | All seven notices, eight static assets and two Wasm artifacts match their pins |
| `./scripts/mac.sh env node /REDACTED_USER_HOME/Desktop/BudgetBranch/.cache/g3-final/probe-web.mjs` | 0 | HTTP startup, finalized root state and all three guards passed |
| `BB_WEB_PORT=58945 ./scripts/mac.sh web --offline` | 130 | Started and stopped by SIGINT. Listener closed and temporary Sandbox node home removed |

The HTTP probe used `BB_CHECK_LOG_DIR=/REDACTED_USER_HOME/Desktop/BudgetBranch/.cache/g3-final` to place public logs outside the worktree. The live page and finalized snapshot each returned HTTP 200 on chain `test-chain-bb6f1e9863b461176a`, block 69. Business funding was zero, with one root grant and no payments. Foreign origin, absent signing token and `sandbox_patch_state` through the read-only proxy each returned 403. The positive session endpoint was outside this probe. The only documentation adaptations were running the web bundle checks before the foreground web process, using a free loopback port and adding `--offline` where the warmed caches made it applicable. README, runbook and demo file-link targets resolved. No README quickstart fault was observed in these commands.

The SDK run used a separate real chain, `test-chain-bb85012122d43bc655`. The three contract accounts had zero access keys. The final business ledger was **3 free / 0 pending / 2 spent / 5 returned NEAR**. The rejecting receiver transaction was `BVtq8EreCkVsCeKQpEC5ivMQMdKCjuZU83dY2WtrrSnZ` and its finalized deposit-refund receipt was `DyCGaek5YTMuR31dC375E66pj1DpcNLNEJgyrExRq2t8`. The native owner refund was `CwWk9wA6iduiQxyXLz3gBmjDpYZzwecBcBMn1KfD7RWL`.

The frontend comparison used the pinned `frontend-dist-comparison.json` from the checkout. All eight original files, including the five font subsets, JavaScript, stylesheet and HTML, matched SHA-256 and byte length. All seven notice files matched the licensing baseline and their `web/public` sources byte for byte. The resulting `web/dist` held exactly those 15 files. The two Wasm files matched `tests/portable-wasm.json`:

- `budgetbranch.wasm` SHA-256 `2c862acc53ae8cd02f6dbf8430c1271ebbf16de27df2e2d5a77c7a52efc5aa23`
- `demo_receiver.wasm` SHA-256 `40bc851605e5084acdb29d163e0b4c4df50dbd62189da63383e16847171f3655`

| Source subtree | Git tree |
| --- | --- |
| `contracts` | `2c691ebdbd23e9d9e22ea67fc3aa22c9b5226106` |
| `sdk` | `0a5697bd43dfa43413056ce7b6db84908a88c98e` |
| `agents` | `b206dc73cfd95481a45030192f744c77e8c2953d` |
| `web` | `26c3057345a95285a4473f1945adf9a1a991c9c6` |
| `scripts` | `467578bb9b2b936956ffdb1993e0f7e580629557` |
| `tests` | `65acf66f31cd12571eaab2b7f4352424c9b71dc7` |

Public logs and commands are under `/REDACTED_USER_HOME/Desktop/BudgetBranch/.cache/g3-final/`. Key evidence SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `sdk-sandbox.jsonl` | `0680906a241519e61d31d0897fc5a0d94cf5d538c5508552771941d462da8f65` |
| `artifact-hashes.json` | `c2cd0a910cc3a3912e506276d72ecc3f6e0129e5273a60363d1017f68fe7a46d` |
| `web-http.jsonl` | `f1b76f1a15c465d9faeec291dd8a7565faf9dcebec4ed4a4a777236fca8b65c4` |

This verification covers local commands and evidence at the recorded release commit. Interactive browser and direct contract-suite evidence are retained from prior reviews. The report is local to the ignored evidence directory.
