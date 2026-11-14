> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](../PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# Attributions and development provenance

BudgetBranch was built from the owner’s planning starter with AI-assisted implementation and independent review. This public repository imports the approved private source snapshot as one release commit. It does not reconstruct or backdate the private development history. The release author is the owner’s approved GitHub identity; this import does not claim that one person manually authored every component. Original project authorship remains credited to BudgetBranch contributors, with separate upstream attribution below.

Historical commit IDs in retained reports identify private review checkpoints and are not public Git ancestors. Do not run old-history `git diff` or evidence-inspection commands against this two-commit publication. [Publication provenance and exact source comparison](../PUBLICATION_PROVENANCE.md) documents the import without inventing development commits or authors.

The NEAR financial contract, client, deterministic agent scenario and console are the project-specific work. NEAR accounts, access keys, promise/callback settlement and the frameworks below are existing ecosystem mechanisms, not BudgetBranch inventions. No integration with NEAR Intents, Chain Signatures, TEE/private inference or a live LLM is claimed.

| Reused component | Use and pinned source of truth |
| --- | --- |
| NEAR Rust SDK 5.30.1 | Contract API and cross-contract promises; [Cargo manifest](../../contracts/Cargo.toml) and [lockfile](../../contracts/Cargo.lock). |
| NEAR Sandbox 2.14.0 / protocol 88 | Official native local-chain binary; [bootstrap and observed artifact pins](../../scripts/mac.sh), [runtime choice](../RUNTIME_CHOICE.md). |
| Rust/Cargo 1.95.0 and Node.js 24.14.0 | Project-local compiler and JavaScript runtime; bootstrap records distinguish downloaded checksums from observed pins. |
| React/React DOM 19.3.1, Vite 8.3.8, TypeScript 5.9.3 | Console and TypeScript build; [web package metadata](../../web/package.json) and lockfile. |
| Geist variable font 5.3.0 | Console typography through `@fontsource-variable/geist`; upstream font license remains applicable. |
| Other Rust/npm libraries | Versions and transitive dependencies remain in the checked-in lockfiles; see the [dependency review](../DEPENDENCY_REVIEW.md) for scan scope and open advisories. |

Third-party components retain their own licenses. Repository licensing does not replace those notices. The owner confirmed `MIT OR Apache-2.0` for original BudgetBranch material on 2026-11-13; the Rust workspace declaration remains unchanged. [Third-party notices](../../THIRD_PARTY_NOTICES.md) and the [license review](../LICENSE_REVIEW.md) identify external components separately. Publication is still a separate decision.

The implementation and reviews used AI coding agents under owner direction. Requested roles were Astra/Max for integration, contract and independent security review, and Sol 6.1/Max for SDK/Agents, frontend and integration tests. [Launch records](../evidence/m1/worker-launches.json) document accepted worker parameters. Effective serving telemetry is unknown; the integrator's actual model and effort remain **UNKNOWN / UNKNOWN**. The independent security reviewer did not author the reviewed implementation. This development process is distinct from the product's **scripted agents**, which make deterministic decisions without an inference API.
