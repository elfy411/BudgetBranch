# BudgetBranch — repository-wide Codex instructions (v2)

## Mission and source of truth

- Build a **real, reproducible** NEAR HACKATHON 2026 prototype of constrained, funded delegation for AI-agent spending.
- Primary track: **AI Security & Defense**. Submission deadline: **2026-11-14T23:59:00Z**.
- Read **`PLAN_RU.md`**, **`MODEL_ROLES_RU.md`**, **`SPEC.md`** (when created), and **`OWNER_CHECKPOINTS_RU.md`** before coding.
- `SPEC.md` is the frozen technical contract after Owner Gate G0. Do not silently change shared ABI, error types, status semantics, or accounting.
- `docs/STATUS.md` tracks evidence, commit IDs, pass/fail and unresolved risks. Update it at each completed milestone; only the integrator edits the shared status file.

## Model routing — requested by owner, not optional optimization

- **Lead Integrator:** **GPT-6 Astra**, reasoning **Max**.
- **NEAR Smart Contract Engineer:** **GPT-6 Astra**, reasoning **Max**.
- **Independent Security QA:** **GPT-6 Astra**, reasoning **Max**.
- **SDK / scripted agents:** **GPT-6.1 Sol**, reasoning **Max**.
- **Frontend:** **GPT-6.1 Sol**, reasoning **Max**.
- **Integration Tests / CI:** **GPT-6.1 Sol**, reasoning **Max**.
- UI model labels and API IDs differ; do **not** assume `Max` is part of the model ID. API IDs where appropriate: `gpt-6-astra`, `gpt-6.1-sol` and `reasoning.effort=max` (only in contexts that expose these parameters).
- At the start of each task report **actual** model and effort if visible. If they cannot be verified, say so; do not invent a launch configuration.
- A prompt requesting a model is **not** a guarantee that a native subagent runs on it. If the runtime cannot assign per-subagent model/effort, prepare independent Codex sessions/worktrees with those owner-selected settings rather than silently falling back.

## Division of responsibility and branches

- Integrator: architecture, `SPEC.md`, root instructions, integration branch, final README and release coordination; not the default implementer of all components.
- Contract (Astra): `contracts/**` and contract unit tests only.
- SDK/Agents (Sol): `sdk/**`, `agents/**`.
- Frontend (Sol): `web/**`.
- Integration Tests/CI (Sol): `tests/**`, `scripts/**`, `.github/workflows/**` only when assigned.
- Independent Security QA (Astra): initially **read-only** on implementation; produce review notes under `docs/SECURITY_REVIEW.md` via integrator or separate report. Never make the same agent both implement and approve its own security fixes.
- Workers use separate branches/worktrees and do not merge into `integration` or `main`. Integrator inspects diffs, executes real checks, and integrates accepted changes into `integration`.
- `main` changes require G2 owner approval. Public repo/push/publications/submission require explicit G3 owner permission.
- Do not modify unrelated user work or force-push/rebase/delete user branches without consent.

## Owner gates and team parallelism

- **G0 (architecture)**: owner accepts frozen ABI, accounting model, identity, async handling and worker split **before parallel implementation**.
- **G1 (contract)**: owner sees reproducible Sandbox success + failure cases and independent Security QA findings.
- **G2 (integrated)**: owner tests complete application from clean Mac checkout; approve merging to `main`.
- **G3 (release)**: owner reviews repo, demo video, X post and application; only owner authorizes public actions.
- Use three core workers in parallel only after G0 (Contract / SDK / Frontend). Test/CI and Security QA run with separate paths or read-only reviews. No simultaneous edits of the same shared files.

## Security and accounting absolutes

- Sandbox/Testnet only. No mainnet, real money, production wallet custody, or unapproved network spending.
- Never store, print, upload, or commit private keys, seed phrases, credentials, or paid LLM API keys.
- Actual signer identity checked on-chain; never rely only on UI controls or an `agent_id` argument.
- Preserve funded conservation across `available`, child delegations, `pending`, `succeeded`, and `returned`. Use safe integer arithmetic and distinguish gas/storage from business budget.
- New grants can only narrow parent limits: total amount, recipient allowlist, expiration, and depth. Every spend checks the full ancestor chain and revocation.
- Reserve pending money before asynchronous external call; callback access must be restricted; process each response only once. A failed promise is not a successful payment. Revoke does not cancel a transfer already in flight.
- For failure demos use a dedicated receiver contract which can accept/reject a function call with attached deposit; verify actual behavior through Sandbox execution.
- If safe recovery/refund is not implemented, state it as a serious limitation, never claim production-ready escrow.

## Definition of done and reporting

- Test results must be **real**: report executed commands, exit status, counts, locations of logs, branch/commit and platform.
- Distinguish unit, NEAR Sandbox, Testnet and **SIMULATED/MOCK** output.
- Build and tests pass again **after integration**, from a clean checkout without secret environment dependence or paid AI service.
- README reflects actual code, known limitations, external dependencies and inspiration; do not exaggerate originality or implemented security.
- If the configured multi-agent feature is absent, say so clearly and give the owner exact instructions and role prompts for separate Codex sessions; do not claim agents were launched.
