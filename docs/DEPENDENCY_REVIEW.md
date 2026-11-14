> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# Dependency and secret review — G2 / G3

Checked on 2026-11-13. Final code candidate `1ea24af7c97db1733d920a2949d681218d24687f` retains the dependency lockfiles audited at baseline `826803d658bf3bddd8f2d7ef03869c2da8e7d4f7`. No automated dependency fix, advisory suppression or global tool installation was performed.

## G3 release scan addendum

The G3 documentation candidate `665874f445a23a1a35db09f0c5cb6b9e803eac88` leaves application code and dependency lockfiles unchanged. Cargo/npm advisory results below are the recorded G2 checks, not newly run advisory scans.

Gitleaks8.30.1 scanned **41 reachable commits** across all refs and a separate exact export of **460 tracked files**. Both scans exited **1**, with five matches each in the G2 QA artifact checksum manifest. History now includes that manifest at the G2 package commit4de1805, which was committed after the earlier G2 history scan. The integrator recomputed each artifact from the current source and from approved Git content: all five are public SHA-256 values. **Zero confirmed secrets, zero unresolved matches, no suppression.** [Commands, scope and input fingerprints](evidence/m3/secrets/run.json), [redacted history](evidence/m3/secrets/history.json), [redacted source](evidence/m3/secrets/source.json), [triage](evidence/m3/secrets/triage.json).

Scan reports and this outcome addendum are produced after the scanned snapshot. Independent QA verified all460 source digests and each reported public checksum; [review](evidence/m3/security-qa/security-release-review.json). The later16-file staged metadata delta scanned exit0 with0findings; [scope and hashes](evidence/m3/secrets/delta-run.json). The final result files and outcome links are separately inspected. Caches, tools and private temporary Sandbox homes remain outside the tracked source scan; pattern scanning is not proof that every possible secret is absent.

## Advisory results

`npm 11.9.0 audit --package-lock-only --ignore-scripts --json` against the official registry exited **0** for SDK, agents and web, with zero known advisories returned. [Commands, lock hashes and outputs](evidence/m2/dependencies/npm-run.json). This is a registry advisory check, not a proof of dependency safety.

Project-local `cargo-audit 0.23.0` against RustSec database commit `af7b3ec33460b8e2de8d422e16d628518891a519` exited **1**. The scan is **not PASS**: one vulnerability advisory and two maintenance warnings remain open. [Command and exit](evidence/m2/dependencies/cargo-audit-run.json), [raw result](evidence/m2/dependencies/cargo-audit.json), [actual target-specific dependency paths](evidence/m2/dependencies/target-scope.json).

| Advisory | Dependency and scope | Disposition |
| --- | --- | --- |
| [RUSTSEC-2026-0387](https://rustsec.org/advisories/RUSTSEC-2026-0387.html) | `crypto-bigint 0.5.5`: potentially secret-dependent timing. RustSec lists patched versions ≥0.7.6. The normal BudgetBranch Wasm graph does not contain this crate. The host graph reaches it through elliptic-curve/p256/near-vm-runner and near-sdk unit tooling. | **OPEN.** Independent QA traced the pinned P-256 path to public-input signature verification and found no applicable secret-integer signing path in this prototype. That scoped assessment does not suppress the advisory or establish general immunity. Upgrading across the upstream dependency range requires a reviewed change and new validation. |
| [RUSTSEC-2024-0449](https://rustsec.org/advisories/RUSTSEC-2024-0449.html) | `unsafe-libyaml 0.2.11`, unmaintained; host path through serde_yaml/near-parameters. | **OPEN maintenance debt.** No patched release listed. |
| [RUSTSEC-2022-0054](https://rustsec.org/advisories/RUSTSEC-2022-0054.html) | `wee_alloc 0.4.5`, unmaintained; **present in deployed Wasm** through near-sdk. Upstream notes unresolved memory-leak issues. | **OPEN deployed dependency risk.** Bounded contract execution and measured gas are not proof of allocator correctness. No production suitability claim. |

The installed native Sandbox binary is pinned by observed SHA-256. This Cargo.lock review does not constitute a full dependency/SBOM audit of that prebuilt executable.

The Integration worker verified registry source and checksum presence for 438 Cargo lock entries and official npm registry URLs plus SHA-512 integrity for 59 external npm entries. [Pin evidence](evidence/m2/clean-mac/lock-pins.jsonl). Integrity and advisory results answer different questions.

## Secrets

Project-local Gitleaks **8.30.1**, downloaded from its official release with archive/checksum digest verification, initially scanned all 34 then-reachable Git commits and all refs, including both G2 worker commits, plus 285 tracked or unignored source/evidence files. Both scans exited **0**, zero findings. [Tool provenance](evidence/m2/secrets/tool.json), [initial scope](evidence/m2/secrets/run.json).

The final check covered 36 reachable commits and 411 source/evidence files, including the staged public QA logs. History exited **0**; source scanning exited **1** with five `generic-api-key` matches in the QA checksum manifest. Each matched value was independently recomputed from its named public artifact and proved to be its SHA-256 checksum. **Zero confirmed secrets; five classified false positives; no unresolved matches or suppression added.** The raw exit1 remains recorded. [Final commands/input hashes](evidence/m2/secrets/final-run.json), [redacted finding metadata](evidence/m2/secrets/final-source.json), [checksum-by-checksum triage](evidence/m2/secrets/final-triage.json). Result/triage files were written after the scanned snapshot; README, STATUS, G2_REVIEW and this dependency review were also updated to describe that outcome. Independent QA recomputed all five checksums and reviewed those four documentation diffs: only results/links changed, with no secrets. [Package follow-up](evidence/m2/security-qa-package-review.json).

Built-in rules were used without a custom allowlist, ignore file, baseline or inline allow comments. Reports were redacted and retained without matched secret text. Ignored local tools, dependency caches and disposable Sandbox node homes were outside the source snapshot. The fixture's own generated validator files remain private and are removed on normal shutdown/Ctrl-C; caller keys and signed transaction bytes are not recorded. Pattern scanning cannot rule out every possible secret.

## Optional genuine agent demonstration

The SDK/Agents worker assessed a live model-driven demonstration; the integrator independently checked executable names, known local app paths and six default model-service ports. No local inference runtime was found within that bounded search. Codex CLI is installed. [Observed checks and proposed design](evidence/m2/agent-feasibility/integrator-check.json).

A one-off Codex-assisted decision is feasible without changing the financial contract: expose a finalized task snapshot and bounded task choices to the model; let a disposable Agent A executor accept one structured `delegate` decision or abstention; recheck amount, recipient, expiry and depth; retain a brief decision, request fingerprint, finalized receipt and ledger. Exclude the owner signer. This would be application-level capability scoping, not a claim of cryptographically restricted account keys. The worker estimated roughly 45–90 minutes for implementation and a real receipt check; this is an estimate, not executed work.

No such live runtime was implemented or executed for G2. Current agents remain **SCRIPTED** and the real Sandbox scenario needs no paid AI service. A Codex-assisted one-off would not establish a standalone autonomous runtime or reproducible model choices. Testnet and a full live LLM agent remain unverified.
