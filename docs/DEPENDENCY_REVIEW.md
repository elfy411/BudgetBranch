# Dependency review

The retained advisory checks were executed on 2026-11-13 against the dependency lockfiles still used by this release. They are historical observations, not a continuously refreshed advisory feed. No dependency version, override or suppression was added during documentation cleanup.

`cargo-audit 0.23.0` exited **1**, against RustSec database `af7b3ec33460b8e2de8d422e16d628518891a519`. The [raw result](evidence/dependencies/cargo-audit.json), [command record](evidence/dependencies/cargo-audit-run.json) and [target-specific paths](evidence/dependencies/target-scope.json) preserve the scope.

| Advisory | Scope | Status |
| --- | --- | --- |
| RUSTSEC-2026-0387, `crypto-bigint 0.5.5` | Host-side P-256/near-vm-runner/unit tooling; absent from normal deployed Wasm. The reviewed application path verifies public-input signatures; no affected secret-integer signing use was identified in that bounded review. | **OPEN**. This assessment does not clear the upstream timing advisory. |
| RUSTSEC-2024-0449, `unsafe-libyaml 0.2.11` | Host-side serde_yaml/near-parameters | **OPEN**, unmaintained dependency. |
| RUSTSEC-2022-0054, `wee_alloc 0.4.5` | Present in deployed Wasm through near-sdk | **OPEN**, unmaintained allocator with upstream memory-leak concerns. Bounded gas is not proof of allocator correctness. |

The [npm command/results record](evidence/dependencies/npm-run.json) and [SDK](evidence/dependencies/sdk-audit.json), [agents](evidence/dependencies/agents-audit.json), [web](evidence/dependencies/web-audit.json) outputs record exit 0 and no known advisories at that scan. Integrity pins and advisory checks do not certify dependency safety.

The pinned prebuilt native Sandbox, Rust/Node distributions, compiler sysroot and linked native components are not covered by a complete binary SBOM audit. This repository distributes source and evidence, not bundled third-party tools. See [licenses](LICENSE_REVIEW.md) and [security limitations](SECURITY_REVIEW.md). Dependency remediation requires separate risk assessment and fresh testing.
