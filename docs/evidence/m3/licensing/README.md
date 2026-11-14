> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](../../../PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# Licensing evidence paths

The raw reports preserve the actual local inspection paths and file names. Copies were placed in this repository for review. [artifact-index.json](artifact-index.json) gives the public path and SHA-256 for each renamed integrator log and copied npm notice.

- In `integrator-run.json`, a `commands[].log` value such as `sdk-ci.log` maps to `integrator-sdk-ci.log` in this directory.
- In `npm-inventory.json`, `packages[].license_files[].retained_path` is relative to the original `.cache/license-review/npm/`. Strip `notices/` and resolve the remainder under the repository's `third_party/licenses/npm/` directory.
- In `frontend-notice-sources.json`, `dist_path` is relative to `web/public/` in source and to `web/dist/` after a build. Runtime asset keys in `frontend-dist-comparison.json` are relative to `web/dist/`.
- `cargo-inventory.json` retains original `.local/` archive and `.cache/` upstream inspection paths. These are provenance, not public download links. Use the adjacent public source URL and checksum. All retained normal-Wasm legal files have repository-relative paths in [wasm-notice-manifest.json](wasm-notice-manifest.json); selected host notices are in [notices/](notices/). Not every cached input or host notice is republished.
- `secret-run.json` describes the159-file license delta at the recorded commit. Reports and this path index were produced afterward; do not claim they were inputs to that scan.

Raw npm registry responses, generated build outputs, downloaded tools and source archives remain outside Git. The review describes their scope and observed fingerprints; it does not claim the native binaries have a complete SBOM. The original report files and third-party text hashes are unchanged by this path index.
