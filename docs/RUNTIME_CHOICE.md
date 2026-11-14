> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# M1 runtime choice: native Apple Silicon Sandbox

**Selected: project-local native ARM64 Rust/Wasm + NEAR Sandbox 2.14.0.** This decision changes no G0 architecture or financial behavior. Contract/SDK/Frontend development continued in independent worktrees while this runtime was prepared; the accepted results are now on integration.

| Check | Native Mac | OrbStack containers |
| --- | --- | --- |
| Runtime available now | Rust 1.95 and Wasm target installed locally; Sandbox executable runs | OrbStack.app installed, but exact process check found none |
| Actual daemon/node check | Real loopback chain, protocol 88; ten contract suites, SDK scenario and complete UI scenario passed | `docker info` exit 1: missing OrbStack socket |
| Configuration | Scoped process environment; existing Homebrew Rust unchanged | `docker context ls` exit 0: current `orbstack`, alternate `default`; no context/configuration changed |
| Reproducibility evidence | Pinned local tools, source/Wasm hashes, independent rebuilds and real transaction evidence | No image build, container run or Sandbox transaction executed |
| M1 suitability now | Working local execution path with fewer active prerequisites | Requires starting daemon, resolving image digests and separately proving the same chain tests |

Full commands and exit codes: [docker-assessment.json](evidence/m1/docker-assessment.json). The elevated read-only `pgrep -x OrbStack` returned 1 (no process); the first sandbox-restricted process probe was inconclusive and was not used to assert the result. The user was informed OrbStack is not running. It was not launched automatically and global Docker configuration was not changed.

The candidate container would use an official Rust **1.95** Linux ARM64 image, the `wasm32-unknown-unknown` target and **NEAR Sandbox 2.14.0 for Linux-aarch64**, with the exact image digest and downloaded artifact hash pinned when actually verified. It must compile from `contracts/` so the target-specific `--cfg near` Cargo configuration is loaded, then execute the same real Wasm/receiver/callback tests. SDK integration would additionally need its compatible Node runtime. No macOS Sandbox executable can be reused in a Linux container.

[OrbStack's documentation](https://docs.orbstack.dev/docker/) supports native ARM and emulated x86 images; [official Rust images](https://hub.docker.com/_/rust) provide the prospective Rust base. The [NEAR Sandbox runner](https://raw.githubusercontent.com/near/near-sandbox-rs/main/src/runner/mod.rs) defines distinct Darwin-arm64/Linux-aarch64 artifacts. These are feasibility sources, not a successful container test.

Because the daemon is unavailable, no Dockerfile is represented as working or accepted. If OrbStack becomes available, Integration Tests can implement the container wrapper and retain it only after the real Sandbox suite passes inside it, then add the judge-facing Dockerfile/run instructions. A container mock run cannot satisfy this condition. The judge reproduction path is the [tested native runbook](../scripts/README.md). The integrator independently repeated [ten portable contract suites](evidence/m1/integrator-portable-build/summary.json), the [real SDK run](evidence/m1/integrator-sdk-sandbox/run.json) and the [full browser scenario](evidence/m1/integrator-live-ui/scenario.json).
