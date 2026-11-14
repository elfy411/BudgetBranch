> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](../PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# Proposed G3 transfer to local main

**Prepared, not executed.** Local main remains the owner-approved G2 package `4de180536eb75ebf3d653c063ef20ef7ba6dadc8`. No remote is configured. The license approval accepts source licensing, not a new main transfer or public release.

The exact tested G3 source candidate is **`bcfc9f96b02c36df5f1d899270e7c4b7cb8c4e04`**. The final packet adds approval records, final README evidence and release-review documentation. Its immutable commit is supplied in the integrator's handoff; use that full hash for a future approval, not a moving branch name. Application source, launch scripts and dependency resolution must remain identical to the tested candidate.

## Changes collected in integration

The [complete path/hash inventory](../evidence/m3/final/change-manifest.json) covers **226 changed or added files** from G2 main through the tested candidate.

| Scope | Files | Effect |
| --- | ---: | --- |
| English documentation and recording materials | 12 | README, runbook, copy, demonstration plan, approval/status and review documents |
| Root license and notices | 4 | Source-only dual license, both license texts and third-party index |
| Third-party legal text | 94 | 69 Cargo and 25 npm license/notice copies with provenance |
| Web distribution notices | 7 | Static license/notice files copied by the existing Vite build |
| Project package metadata | 6 | License fields in three manifests and corresponding local lockfile entries |
| Evidence and review records | 102 | Command output, hashes, independent reviews and scan triage |
| Git whitespace attributes | 1 | Preserve verbatim upstream legal-file bytes |

All six package JSON changes equal G2 after removing only newly added project license fields. Versions, resolved URLs and integrity hashes did not change. The contract tree remains `2c691ebdbd23e9d9e22ea67fc3aa22c9b5226106`, including its unchanged Cargo manifest and lockfile. SPEC, ABI, financial logic, SDK/agent/web source, executable launch scripts and tests are unchanged. Fresh builds reproduced both approved Wasm and all eight original web output hashes; seven legal text files are the only added web outputs.

| Commit | Purpose |
| --- | --- |
| `adec7f871317db609ad46f7f93247b614fb02e2e` | Clean Mac verification and runbook |
| `fce896818a2c665f7959ade3c8e76b7e7d70224d` | English release and recording materials |
| `665874f445a23a1a35db09f0c5cb6b9e803eac88` | Offline prerequisites and recording precision |
| `af444fc12695efabef698977651f5549b58325e6` | Independent G3 review and scan evidence |
| `780ad89b3351856cb4fafb93c74d763f208310e2` | Final documentation-review attestation |
| `0caf90f692ba71ac7d07d006783815665bdd9c7d` | Web distribution notices |
| `d05ebc47ad55452fc0b80e7aef0e9ad08f85e51d` | Approved license metadata, legal copies and provenance |
| `bcfc9f96b02c36df5f1d899270e7c4b7cb8c4e04` | Independent license review and evidence mapping |

Final packet commits after these eight contain documentation and public verification records only. They are identified in the final handoff and independent final review. No financial feature or required UX change is added; [UX improvements](UX_REVIEW.md) remain optional proposals.

## Procedure after explicit owner approval

1. Recheck the full approved package hash, clean tracked tree, current main hash and post-review changes. Stop if a value differs from the reviewed scope.
2. Confirm main is an ancestor of that exact package. A local fast-forward preserves reviewed commits without introducing a new merge implementation.
3. Advance only local main to the explicitly approved hash and record it. Do not implicitly push or create a remote, repository, tag or release asset.

No G3 main transfer or public operation has been performed. Public destination, exact content, push/visibility, video/X publication and submission payload remain separate owner decisions in the [G3 packet](../G3_REVIEW.md).
