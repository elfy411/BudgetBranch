# Publication provenance and privacy processing

This repository publishes an owner-approved snapshot of BudgetBranch. It is **not a reconstructed development history**. The existing GitHub README commit is retained, followed by one release import authored with the owner's confirmed GitHub identity, `elfy411 <200042033+elfy411@users.noreply.github.com>`.

The source snapshot is `dc0f85dd34b2457c21f03ca56d83aaf7a7aaaf4f`. That identifier records the private source checkpoint; it is not an ancestor of this public branch. Earlier development commits, author metadata, branches and original evidence remain unchanged in the owner's private local repository. No force push or history replacement is needed to publish this branch over the initial GitHub README.

The owner authorized this separate publication history after a privacy review found machine-account identifiers in Git metadata and historical execution paths. These identifiers were not the owner's identity. The public import does not attribute every implementation line to the release committer or invent historical authors. Project credits and third-party copyright/license notices are preserved; [development and component attributions](release/ATTRIBUTIONS.md) remain applicable.

## What remains unchanged

The financial contract and receiver code, contract tests, TypeScript SDK and scripted agents, browser application, supported test fixtures and runner scripts, frozen SPEC/ABI, dependency manifests/lockfiles, build configuration and third-party notices are unchanged from the approved snapshot. Financial behavior was not changed to sanitize paths.

The Mac runner computes the project root from its own location. Its optional `BB_TOOLCHAIN_ROOT` is an explicit caller-supplied override, not a hidden user-home dependency. Wasm source/Cargo prefixes are remapped dynamically. Standard macOS paths such as `/private/tmp` and the overridable Chrome application location identify platform facilities, not a particular user's project directory. See [the supported runbook](../scripts/README.md).

The portable artifacts remain pinned to:

- `budgetbranch.wasm`: `2c862acc53ae8cd02f6dbf8430c1271ebbf16de27df2e2d5a77c7a52efc5aa23`.
- `demo_receiver.wasm`: `40bc851605e5084acdb29d163e0b4c4df50dbd62189da63383e16847171f3655`.

Binaries, local toolchains, dependency caches, temporary Sandbox keys and video recordings are not included in the repository. This publication does not distribute third-party executables or resolve the documented host-library license ambiguity.

## Processed historical evidence

Retained reports and logs are **public copies that have been processed for privacy**. Identifying local account, hostname and home-path strings are replaced by explicit redaction markers where present. The markers are documentary placeholders, not runnable filesystem paths. Ledger values, transaction/receipt hashes and financial outcomes were not synthesized or combined across chains.

An original hash, source commit, "raw" label or byte-for-byte statement inside a historical report describes the private artifact **before** this publication pass. It must not be used to claim that a redacted public file has the same bytes. Historical scanner attestations likewise cover their original inputs, not this new publication snapshot. The originals were retained privately without modification. Fresh release checks and independent QA bind their own reports to the exact new release SHA; the publication step itself is not a test result.

The [publication manifest](PUBLICATION_MANIFEST.json) distinguishes original SHA-256 values, public-copy SHA-256 values, files removed, protected files unchanged, and new publication documents. It intentionally does not hash itself or this companion document. There is no blanket claim that every retained report is byte-identical or that every historical command can run in the public two-commit history.

Supported reproduction commands are in the root [README](../README.md) and [Mac runbook](../scripts/README.md). They run fresh unit/MOCK checks and real NEAR Sandbox transactions. Old archive-only commands may reference private commits or omitted local review helpers and are not public startup instructions.

## Omitted helper files

All 57 one-off capture/review programs and saved command wrappers under `docs/evidence/` are omitted. They were archival audit tools, some bound to private worktrees or historical Git objects; they are not the supported `scripts/`, `tests/` or `contracts/sandbox-tests/` and `contracts/budgetbranch/src/tests.rs` implementation. Omitting these programs avoids presenting private-environment helpers as portable public entry points. Their historical report references are retained with this qualification, and Markdown links to omitted helpers lead here.

The exact 57 paths and their original hashes are in `excluded_files` in the [publication manifest](PUBLICATION_MANIFEST.json). `modified_existing_files` lists every altered report/document and its before/after hash. `unchanged_protected_files` permits direct verification of executable sources, configuration, frozen interfaces, dependency pins and notices.

No third-party license or copyright notice was stripped. No new financial capability, Linux runner, external signer service, Testnet deployment or live LLM agent is part of this import. Sandbox-only limitations, callback-recovery constraints and open dependency warnings remain documented in the README.

## Release permissions

Preparation of this candidate is authorized. GitHub push, public visibility, video/X publication and hackathon submission remain separate owner decisions. A future authorized push must name the approved release SHA, update only `origin/main` normally, and omit other branches/tags. The private development histories must remain private and unchanged.
