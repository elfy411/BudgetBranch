# Attribution

BudgetBranch was developed with AI-assisted coding and review under the project owner's direction. Reused libraries and frameworks are credited separately.

The demo agents are deterministic scripts; no live LLM inference is integrated into the application.

The project-specific work comprises the funded delegation contract, typed client, scripted scenario, local signing bridge and console. NEAR accounts, keys, asynchronous promises and callbacks are existing NEAR mechanisms. The project does not claim to invent them or to integrate NEAR Intents, Chain Signatures or private inference.

The owner's planning material provided the initial project brief. Original work is credited collectively as Copyright © 2026 BudgetBranch contributors; no individual legal name or company is invented. [Source provenance](PROVENANCE.md) explains the imported baseline.

| Reused component | Role |
| --- | --- |
| NEAR Rust SDK and NEAR Sandbox | Contract execution and real local-chain testing |
| Rust, Node.js and TypeScript | Build and application tooling |
| React, Vite and Rolldown | Browser console and build |
| Geist | Unmodified interface font |

Exact versions are pinned in the Cargo/npm lockfiles. [Third-party notices](../THIRD_PARTY_NOTICES.md), [license review](LICENSE_REVIEW.md) and verbatim files under `third_party/licenses/` and `web/public/licenses/` retain upstream copyrights and conditions. The screenshot in the README is a capture of the actual application, with its separate chain trace retained.
