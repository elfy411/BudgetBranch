> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](../PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# Contest copy and owner inputs

**Draft only. Nothing in this document has been posted or submitted.** The proposed primary track is **AI Security & Defense**, API ID `security`: the project implements bounded agent spending and permission checks. This fit is our assessment; the owner confirms the final track selection.

## Project description draft

The following paragraph is intended for the 20–2000-character project description field:

> BudgetBranch lets agents delegate spending authority without multiplying the budget or widening permissions. One NEAR contract holds a funded budget; nested grants reserve portions for agents and can only narrow recipients, expiry and depth. Every new delegation or spend checks the actual caller and the full ancestor chain. Payments reserve funds before the receiver call and settle through private callbacks. An owner can revoke a branch, reclaim unused reservations and refund free funds. The local demo shows a rejected over-allocation, an unknown-recipient denial, successful and failed receivers, a revoked branch and a working neighbor, ending with 3 free / 0 pending / 2 spent / 5 returned from 10 test NEAR. The repo includes a typed SDK, scripted agents, a web console and real Sandbox evidence. This is Sandbox-only, with reviewed immutable synchronous receivers. Lost callbacks may leave funds pending indefinitely; finite quotas, operational reserves and cargo audit findings remain. No live LLM or production-ready security is claimed.

## X post draft

Attach the actual video from the [recording plan](DEMO.md). This text leaves room within 280 characters for a shortened public repository URL; validate the final composed post before publishing:

> Agents can delegate a budget, not invent one. BudgetBranch enforces nested spending limits on NEAR. Real local Sandbox; scripted agents; prototype limits documented. Built at NEAR HACKATHON. @NEARProtocol #NEARHackathon

Append the real public repository link only after it exists. Do not substitute a screenshot-only post for the planned local-demo video. The owner publishes the post.

## Release requirements checked 2026-11-13

The [official rules](https://nearhackathon.com/HACKATHON.md) allow a local-only project with a public repository, reproducible instructions and an X video. Deadline: **2026-11-14 23:59 UTC**. Include a license; disclose borrowed material and any earlier baseline. The repo must remain public through judging. The human's post needs the event attribution and required tags shown above. Recheck the live rules before release.

Before a submission, the owner supplies project/lead names, email, team size, tracks, their Mainnet payout account, public repository and demo-post URLs, and confirms the description and contact consent. These are submission metadata; no Mainnet transaction or private key is needed. Keep personal payload data outside Git.

Contact notice to present verbatim at the actual consent step: “I agree that the organizers may use these details to review our submission and contact us about this hackathon.”

Publication and submission are separate approvals. Show the exact final payload before submitting once; never invent missing values. No payload, request ID or outbound submission is prepared here. See the [official form](https://nearhackathon.com/#apply) and live API schema for field validation.
