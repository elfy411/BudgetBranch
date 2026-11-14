> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](../../../../PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# Exact-current README verification

The [worker report](final-readme-check.md) records actual Mac commands and outcomes at `bcfc9f96b02c36df5f1d899270e7c4b7cb8c4e04`. [Initial state](initial-state.txt) shows a clean detached checkout without local tools, caches or build outputs. The run explicitly reused the parent project's pinned tools and warmed downloads through `BB_TOOLCHAIN_ROOT`; it is not a cold-download claim. [Earlier G2 reproduction](../../../../../tests/evidence/g2-native-mac.md) covers first downloads.

The [manifest](manifest.json) maps each original `.cache/g3-final/<name>` to the same basename here. Those 34 worker files are retained byte for byte, including command paths as execution provenance. This index and the manifest were added afterward. No private runtime home, keys, signing token or signed transaction bytes were copied.

The integrator inspected logs, recomputed 23 snapshot invariants, checked failed-receiver/refund and native owner-transfer receipts, and independently rehashed 17 freshly built artifacts. [Acceptance checks](../integrator-check.json). Commands passed; the foreground web process exited 130 because the probe intentionally sent SIGINT and verified cleanup.

For another run use the root [README](../../../../../README.md). To repeat the optional artifact checks from the repository root after building:

```sh
python3 docs/evidence/m3/final/readme-check/check-hashes.py
```

`check-hashes.py` compares newly built Wasm/web files with retained manifests. `probe-web.mjs` starts a real local chain, checks HTTP and cleans up. It requires an existing writable `BB_CHECK_LOG_DIR` and warmed dependencies for `web --offline`. It does not exercise interactive browser controls. G2 browser and direct-contract suite evidence remains separate.
