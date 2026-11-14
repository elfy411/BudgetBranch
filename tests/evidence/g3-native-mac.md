> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](../../docs/PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# G3 clean checkout verification on Apple Silicon

Tested source `4de180536eb75ebf3d653c063ef20ef7ba6dadc8`, the local `main` approved at G2. The `work/integration-g3` checkout started clean with no `.local`, `.cache`, Cargo target, npm `node_modules`, or compiled `dist` directories. All commands used `BB_TOOLCHAIN_ROOT=/REDACTED_USER_HOME/Desktop/BudgetBranch` to reuse the project's existing pinned tools and package caches. Outputs were built in the fresh checkout. The separate [G2 cold run](g2-native-mac.md) covers downloads from empty tool and cache directories.

macOS 26.3.1 (a), build `25D771280a`, Darwin ARM64, Node.js 24.14.0, npm 11.9.0, Rust/Cargo 1.95.0, NEAR Sandbox 2.14.0 and protocol 88. Sandbox executable SHA-256 `8e0e1521372b0fce801b7464078c1e95e5a25a0f92ad4b4241451c33fe9e5a2a`. The fresh Wasm hashes matched [the portable manifest](../portable-wasm.json).

| Executed command | Exit | Result |
| --- | ---: | --- |
| `./scripts/mac.sh bootstrap` | 0 | Verified existing project-local runtime versions |
| `./scripts/mac.sh sdk-sandbox --offline` | 0 | Fresh locked Wasm and TypeScript builds. Real Sandbox, 19 steps, 18 SDK transactions, six expected on-chain rejections |
| `./scripts/mac.sh unit --offline` | 0 | 15 Rust unit contexts, 18 SDK unit/mock, five agents unit/mock |
| `./scripts/mac.sh env npm --prefix web ci --offline --ignore-scripts --no-audit --no-fund` | 0 | Fresh lockfile install |
| `./scripts/mac.sh env npm --prefix web run build` | 0 | Production bundle built |
| `./scripts/mac.sh env npm --prefix web test` | 0 | Four web unit/mock passed |
| `./scripts/mac.sh env npm --prefix agents run demo -- "$PWD/tests/sandbox-fixture.mjs"` | 0 | Separate real Sandbox, 19 steps, 18 SDK transactions, six expected on-chain rejections |
| `./scripts/mac.sh env node .cache/g3/probe-web.mjs` | 0 | Local live and standalone HTTP entry points plus SIGINT cleanup |

Both real SDK scenarios settled to **3 free / 0 pending / 2 spent / 5 returned NEAR**. The primary run used fresh chain `test-chain-bb52d0f8050148b1f3`. The rejecting receiver transaction was `593NH3zJ6hiTgihqrAEv4ph6AV3nvVshz3SYTaWhRy5R`, its attached-deposit refund receipt was `8EQLS9wsvA9YLPgTaT5T4NRP56umRpsU8AhExh5u5J5w`, and the native owner refund transaction was `GDMyPaunCXJVpaiY88VXJbkGVTMsPkjKh6Y9seEEiXaG`. The checkout built BudgetBranch Wasm SHA-256 `2c862acc53ae8cd02f6dbf8430c1271ebbf16de27df2e2d5a77c7a52efc5aa23` and receiver Wasm `40bc851605e5084acdb29d163e0b4c4df50dbd62189da63383e16847171f3655`.

The probe started `./scripts/mac.sh web --offline` on an available loopback port. The page and finalized `get_snapshot` returned HTTP 200, with zero business funding on a fresh chain. Foreign origin, missing signer token, and state modification through the read proxy each returned HTTP 403. The server exited 130 on SIGINT, closed its listener, and removed its temporary node home. The separate `npm --prefix web run dev` entry point returned HTTP 200 and HTTP 404 for the fixture signing route. Its listener also closed on SIGINT. This check used HTTP. Interactive browser evidence comes from the separately executed G2 owner workflow.

| Runtime subtree | Git tree |
| --- | --- |
| `contracts` | `2c691ebdbd23e9d9e22ea67fc3aa22c9b5226106` |
| `sdk` | `bdd9a33e07ee30e2cbc78f159beb47e3a74cb33e` |
| `agents` | `fbef5871dd5dba9efa6c1a182ddfdb2e99783eaa` |
| `web` | `92564b13fb7490d961649908075e77454bc0e25f` |
| `scripts` | `87414207e72ced67ba2e6fc69f4af04f3d373173` |
| `tests` | `cacc655d68c60c4defc399d5bc270c88eac7bf46` |

Raw logs in the worker checkout's `.cache/g3/` include `sdk-sandbox.jsonl` (SHA-256 `6ad6a2e188feb6008fb6746c86c76181da658035baf8c08c40791ab9eb508982`), `agents-cli.stdout.log` (SHA-256 `12ece11b9746ad1c0ee28ec85bfc26086e6012ec6246caa0426e590eb4c07f91`), and `web-http.jsonl` (SHA-256 `57479bdba29f84d07a543ae590cb622636509014374117902b0ef63e2b399d5e`). All release verification commands passed. The occupied-port, checksum, and malformed-input evidence comes from the G2 run.
