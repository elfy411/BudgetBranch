> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# Work ownership and launch plan — G0 approved v0.1.0

Repository: `/REDACTED_USER_HOME/Desktop/BudgetBranch`. Integration branch: `integration`. The original starter files were copied to this root without altering the retained source directory. No main branch, remote, public repository or publication is configured at M0.

G0 activation: owner approved implementation on 2026-11-13, source commit `a7057f2a0e68b71eacb2e0e277d1b0d3fcbd7ab2`. Frozen interfaces are recorded in `FROZEN_INTERFACE.json`; the common implementation base is the commit tagged locally `g0-approved-v0.1.0`. Actual integrator model and effort are **UNKNOWN**. Accepted native worker launch settings will be logged separately from effective runtime telemetry. M1's first deliverable is a real Wasm→Sandbox→receiver→callback cycle. Install tools only inside the project; do not alter global environment. The tasks below use SPEC's 16 exact methods, 23 validation errors and 8 event schemas; starter prompt wording does not override them.

## Actual model evidence

| Role | Required launch | Observed evidence at M0 |
| --- | --- | --- |
| Integrator | `gpt-6-astra`, `max` | Current session does not expose verifiable effective model/effort. Not claimed compliant. A prompt cannot switch it. |
| Independent Security QA | `gpt-6-astra`, `max` | Native `collaboration.spawn_agent` accepted explicit model/effort with `fork_turns=none`; task `/root/security_m0` ran and returned a report. No independent serving telemetry is exposed. |
| Contract | `gpt-6-astra`, `max` | Both values are exposed by current spawn tool; not launched before G0. |
| SDK/Agents | `gpt-6.1-sol`, `max` | Both values are exposed by current spawn tool; not launched before G0. |
| Frontend | `gpt-6.1-sol`, `max` | Both values are exposed by current spawn tool; not launched before G0. |
| Integration Tests/CI | `gpt-6.1-sol`, `max` | Both values are exposed by current spawn tool; not launched before G0. |

The tool requires `fork_turns=none` for explicit overrides, so each worker gets a self-contained prompt and reads the approved files from its own worktree. Full-history forks inherit settings and will not be used to pretend the matrix was selected. Four concurrent slots include the integrator. Contract + SDK + Frontend may run together after G0; Integration and QA run in later available slots. No effort downgrade is authorized.

[Official subagent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents) describes explicit model/effort routing; the current native tool schema and accepted invocation are the actual local evidence. The installed CLI reports `codex-cli 0.167.0-alpha.4.1`. No global Codex settings were changed. If explicit worker launch fails, use separate owner-configured sessions with the existing `PROMPTS_WORKERS_RU.md`; do not substitute inherited models. Integrator model uncertainty must be visible in the G0 decision.

## Paths and worktrees

Worktrees below are **planned, not created or launched before G0**. They will branch from the same approved SPEC commit; exact base SHA must be recorded when G0 is accepted.

| Worker / branch | Worktree under repository | Writes allowed |
| --- | --- | --- |
| Integrator / `integration` | repository root | Root architecture/instructions, `docs/**`, root README, reviewed integration |
| Contract / `work/contract` | `.worktrees/contract` | `contracts/**`, including Rust unit tests and contract-specific fixtures |
| SDK / `work/sdk` | `.worktrees/sdk` | `sdk/**`, `agents/**` |
| Frontend / `work/frontend` | `.worktrees/frontend` | `web/**` |
| Tests / `work/integration-tests` | `.worktrees/integration-tests` | `tests/**`, `scripts/**`, `.github/workflows/**` |
| QA / detached review revision | `.worktrees/security` | No implementation writes; send findings to integrator |

Each worktree has its own writable role paths. Workers may read other paths, but no worker edits `SPEC.md`, `docs/abi.ts`, status, another worker's files, `main`, or `integration`. The integrator owns shared wire declarations under `docs/`; SDK exposes those exact declarations, Frontend consumes SDK exports. Dependencies have package-local manifests/lockfiles to avoid concurrent root-lockfile writes. Integrator resolves any cross-package manifest or ABI amendment.

## Concrete post-G0 tasks

Use the role prompt already in `PROMPTS_WORKERS_RU.md`, preceded by the following task-specific assignment and the verified base SHA. Every launch must explicitly select the model and `max` and include exact cwd, branch and path restrictions.

**Contract (Astra Max).** Implement both contracts and SPEC transitions, reserve isolation, replay records, bounded storage, synchronous receiver boundary, native owner recovery and fixed-size callbacks. First prove unit invariants, then compile real Wasm with exact locked dependencies. Include deployment-lock/code-hash proof and the designed storage/callback gas bounds. Must pass direct negative calls and controlled receiver failure in Sandbox at G1. Candidate commands, to be made real by this worker: `cargo test --locked --manifest-path contracts/Cargo.toml`; contract builds under `contracts/` with the selected Wasm target. Do not claim these commands run at M0.

**SDK/Agents (Sol 6.1 Max).** Expose all public SPEC methods and exact wire types; preserve bigint/string amounts and IDs, request IDs and real pending status. No exported callback mutation helper. Implement scripted owner/A/B/child demonstration with transport injection, local-only ephemeral Sandbox keys and no paid API. Golden canonical-request vectors must match Rust. Make `npm --prefix sdk run build` and the package's real unit/fixture commands exist, then report them; final evidence must call the real contract.

**Frontend (Sol 6.1 Max).** One React/TypeScript/Vite screen consuming the SDK: budget, grant tree, constraints, payment statuses, revoke/recovery and events. Distinguish logical free, lifetime child commitments and physical liquidity. Visible network label and SCRIPTED/MOCK labels where applicable; never invent transactions. Real authorized actions use the local Sandbox transport or owner wallet appropriate to the target; no owner credentials in browser assets. Establish actual `npm --prefix web run build` and browser smoke commands. The worker must read applicable website/design workflow skills when implementation starts; no site deployment is authorized.

**Integration Tests/CI (Sol 6.1 Max).** Provide the clean local bootstrap, disposable account/receiver fixtures, SDK-backed E2E, direct-call adversarial tests and CI if time permits. Own the one-command Sandbox runbook under `scripts/`. Download/pin correct native ARM64 Sandbox and Rust target in allowed project caches or an explicitly approved toolchain location. Record complete receipts, actual binary/Wasm hashes, assertion counts and command exit codes. No ordinary-key or credential dumps. Do not alter contract fixtures without returning a specific request to Contract Engineer.

**Independent QA (Astra Max).** Audit the exact implementation revision in a detached read-only checkout; independently reproduce financial/authority attacks, particularly callback data hazards, delayed refunds, normal-cap exhaustion and pending/revoke. Return severity, reproduction, expected/actual, commands and reviewed SHA. The developer fixes the finding; QA rechecks. No self-approval of QA-authored contract fixes.

## Acceptance and merge procedure

Each worker returns model/effort evidence, branch/worktree/commit, owned file diff, exact test commands and outputs, unit/Sandbox/Testnet/MOCK classification, known failures and integration requests. The integrator reviews the diff and reruns the relevant checks on `integration` before accepting it. No worker merges or pushes. No merge to `main` without G2. No remote/push/publication/submission without the respective G3 approval. No Mainnet or personal secrets.

Local Git initialization initially hit the workspace's read-only `.git` policy and succeeded through the tool's approved escalation. This was a filesystem boundary, not a request to publish anything.
