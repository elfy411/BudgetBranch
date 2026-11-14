> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](../../docs/PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# G2 clean native Mac verification

Baseline `826803d658bf3bddd8f2d7ef03869c2da8e7d4f7` on `work/integration-g2`. Contracts source `e8b437490a4d60c93870c644b2f4cf373dbba601`, tree `2c691ebdbd23e9d9e22ea67fc3aa22c9b5226106`. The checkout initially contained neither `.local` nor `.cache`. `BB_TOOLCHAIN_ROOT` was unset and the cold run downloaded its own dependencies. Git status was clean before the run.

macOS 26.3.1 (a), build `25D771280a`, Darwin ARM64. Node.js 24.14.0, npm 11.9.0, Rustup 1.29.3, Rust/Cargo 1.95.0, native NEAR Sandbox 2.14.0 and protocol 88. Cargo used two build jobs.

| Executed command | Exit | Observation |
| --- | ---: | --- |
| `./scripts/mac.sh bootstrap` | 0 | Installed the pinned local tools from empty directories |
| `./scripts/mac.sh wasm` | 0 | Clean locked build and both Wasm hashes matched the portable manifest |
| `./scripts/mac.sh sdk-sandbox` | 0 | Real NEAR Sandbox, 19 checks, 18 SDK transactions, 6 direct rejections |
| `./scripts/mac.sh unit` | 0 | 15 Rust unit, 18 SDK unit/mock, 5 agents unit/mock, zero failures |
| `./scripts/mac.sh env npm --prefix web ci --ignore-scripts --no-audit --no-fund` | 0 | Fresh lockfile install, 25 installed packages on Darwin ARM64 |
| `./scripts/mac.sh env npm --prefix web run build` | 0 | Production bundle built |
| `./scripts/mac.sh env npm --prefix web test` | 0 | 4 web unit/mock, zero failures |
| `./scripts/mac.sh sdk-sandbox --offline` after startup changes | 0 | Real NEAR Sandbox, 19 checks, 18 SDK transactions, 6 direct rejections |

A fresh archive of the baseline under `BudgetBranch with spaces` linked only the `.local` and npm cache from this cold run. It built both target artifacts anew with `./scripts/mac.sh sdk-sandbox --offline` and matched the same Wasm hashes. Its independent Sandbox scenario and web build both exited 0. The archive check covered source and executable paths with spaces while reusing the freshly downloaded toolchain.

All three Sandbox scenarios settled to **3 free / 0 pending / 2 spent / 5 returned NEAR**, with three keyless contract deployments. On the cold chain `test-chain-bb8cbd01cabdf09f97`, the rejecting receiver transaction was `HT2T2mKMVZDWkgv413S8h4PKxJHYPuVKsE2ErHx2B5R3`, the attached deposit returned in receipt `8cNxLDXpobdJTSpKAXUTH5EyvNjSSDJbUZa9FAEWHpdW`, and the owner native refund transaction was `Ffya21676Dd28a2toYAEuB3soLA19Q4hcEgPU9Ws8n6q`. The run after the startup changes used chain `test-chain-bb4f5bb0ec91f035a4` and verified the failed receiver refund receipt `C4x2ycu6Jps6zT1wpuXZoCKbhpgbbLLkEHPCoe6s7Sz9` and owner refund transaction `EKjAJKVUtp24rPndMVhoJMXMfjsKFjqz3Xof8vfgPk73`.

| Artifact | Observed SHA-256 |
| --- | --- |
| Node.js archive | `a1a54f46a750d2523d628d924aab61758a51c9dad3e0238beb14141be9615dd3` |
| Rustup installer | `63752a1919a3a4793173ec70f8f212621a7ce38ba6a246095984482f4de20f9f` |
| NEAR Sandbox archive | `ea53448ef97540c012e5c3d967c74d78292b0465a98cf7027811a936718fe232` |
| NEAR Sandbox executable | `8e0e1521372b0fce801b7464078c1e95e5a25a0f92ad4b4241451c33fe9e5a2a` |
| BudgetBranch Wasm | `2c862acc53ae8cd02f6dbf8430c1271ebbf16de27df2e2d5a77c7a52efc5aa23` |
| Demo receiver Wasm | `40bc851605e5084acdb29d163e0b4c4df50dbd62189da63383e16847171f3655` |

All 438 external entries in `Cargo.lock` had a crates.io registry source and SHA-256 checksum. All 59 external npm lockfile entries across the three packages used `https://registry.npmjs.org` and SHA-512 integrity. Agents and web each linked SDK locally.

The `web --offline` startup probe received HTTP 200 from the local page and from the finalized `get_snapshot` on a fresh real chain. The snapshot showed zero business funding. Foreign origin, absent signing token, and `sandbox_patch_state` through the read-only proxy each returned 403. SIGINT exited 130 and removed the fixture's temporary node home. A separate HTTP listener forced a real port collision. The console exited 1, reported the occupied port, preserved that listener and cleaned up its own node home. An out-of-range port and hexadecimal input exited 1 with the expected decimal-port instruction. An absent toolchain, replaced Sandbox binary and altered Wasm each exited 1 before deployment. An unknown command and invalid SDK option exited 2 with usage. The managed execution environment's loopback denial also exited 1 with the new actionable diagnostic. These are expected rejection checks. The browser walkthrough and G2 owner acceptance are separate from this HTTP verification.

Raw commands and output were recorded in the worker checkout's `.cache/g2/`. The cold SDK JSONL hash is `7d79df143a136ff8d30e53fd75e88e691adc14917f8211c202ebc8d56ed3a15e`. The space-path SDK JSONL hash is `06a45e9e0ef01e3465267fbb22cc388827759dd7ec34b991dc0b5490d295f659`. The post-change SDK JSONL hash is `0c4a35deb1b0dca2e8f8a8c3ed3ef0ee490f1fd488527263d00808831252644f`. The startup probe JSONL hash is `8fd72de82b7bb7a42956047dd126b81cc7abe4c56478e3339f4c0f847150a648`.
