> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# Project-local M1 toolchain

The installed tools live under `/REDACTED_USER_HOME/Desktop/BudgetBranch/.local`; caches live under `.cache`. Neither directory is tracked by Git. Homebrew Rust remains 1.94.0. No shell profile, global Rust toolchain, global npm package or global Codex setting was changed.

Current reproducible entry point: `./scripts/mac.sh bootstrap`, followed by `./scripts/mac.sh sdk-sandbox` or `./scripts/mac.sh web`. The script also pins local Node 24.14.0 / npm 11.9.0. See the [native runbook](../scripts/README.md) and [independent bootstrap/SDK execution](evidence/m1/integrator-sdk-sandbox/run.json). Use `./scripts/mac.sh env <command>` for a single command with the scoped tools.

Portable Wasm builds append target-specific path remaps for CARGO_HOME and checkout/contracts while preserving checked-in `--cfg near`. The [manifest](../tests/portable-wasm.json), [integrator rebuild](evidence/m1/integrator-portable-build/build.json) and [independent QA addendum](evidence/m1/security-qa-portable/qa-report.json) bind the tested source, flags and artifact hashes. Build from `contracts/` or use the wrapper; do not drop its `.cargo/config.toml`. The earlier absolute environment example below remains useful for diagnostics but does not itself request the portable remapping.

Actual versions: Rust 1.95.0 (`59807616e`, 2026-04-14), Cargo 1.95.0, installed `wasm32-unknown-unknown`; native NEAR Sandbox 2.14.0, nearcore commit `bc4e9e8cfb03d9e82f027883055624e18576993e`, protocol 88, Mach-O ARM64. See `evidence/m1/toolchain.json` and `evidence/m1/sandbox-binary.json` for executed argv/results and hashes. These files prove tool readiness, not payment behavior.

For a command in any worktree, scope the environment to that process:

```sh
env \
  CARGO_HOME=/REDACTED_USER_HOME/Desktop/BudgetBranch/.local/cargo \
  RUSTUP_HOME=/REDACTED_USER_HOME/Desktop/BudgetBranch/.local/rustup \
  PATH="/REDACTED_USER_HOME/Desktop/BudgetBranch/.local/cargo/bin:$PATH" \
  NEAR_SANDBOX_BIN_PATH=/REDACTED_USER_HOME/Desktop/BudgetBranch/.local/sandbox/2.14.0/near-sandbox \
  CARGO_BUILD_JOBS=2 \
  cargo --version
```

Replace only the final command with the package's checked-in build/test command. The default system `cargo` would still select the older Homebrew installation. Do not add these settings to user shell profiles. Native Sandbox does not need Docker.

The official Rust installer was downloaded over HTTPS and verified against its published SHA-256: `63752a1919a3a4793173ec70f8f212621a7ce38ba6a246095984482f4de20f9f`. Installation used explicit project-local CARGO_HOME/RUSTUP_HOME and `--no-modify-path --profile minimal --default-host aarch64-apple-darwin --default-toolchain 1.95.0 --target wasm32-unknown-unknown -y`. Its Homebrew coexistence warning was retained; the installer selected the isolated directories. [Official installation-location documentation](https://rust-lang.github.io/rustup/installation/index.html).

Sandbox was downloaded from the artifact URL constructed by the [official runner](https://raw.githubusercontent.com/near/near-sandbox-rs/main/src/runner/mod.rs) for Darwin-arm64/2.14.0. Observed executable SHA-256: `8e0e1521372b0fce801b7464078c1e95e5a25a0f92ad4b4241451c33fe9e5a2a`. This is a local reproducibility pin, not a claim of an independently signed upstream checksum. Keep `NEAR_SANDBOX_BIN_PATH` explicit so crates cannot silently download another version into a global location.

The bounded readiness probe initializes `.cache/sandbox-smoke` using `near-sandbox --home <that path> init --fast`, disables telemetry/boot nodes, binds RPC/network only to loopback, verifies its local chain ID and stops its own process. Run `python3 docs/evidence/m1/sandbox_startup.py` after initialization. It creates no BudgetBranch contract and makes no payment claim. The local sandbox home contains disposable development key files; it is permission-restricted and ignored. Never print, upload or commit its key files.

Default sandboxed shell DNS initially denied official downloads (`curl` exit 6). The same authorized project-local downloads succeeded with the tool's network escalation. If a build needs network or localhost access, use the applicable tool permission path; do not change global networking or disable system protections.
