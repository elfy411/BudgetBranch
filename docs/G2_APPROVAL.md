> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# G2 owner approval and local main

The owner explicitly approved **G2 APPROVED TO MERGE** on 2026-11-13 after personally exercising the real local NEAR Sandbox application. Their reported final state was **free 3 / pending 0 / spent 2 / returned 5 NEAR**.

The approved package is `4de180536eb75ebf3d653c063ef20ef7ba6dadc8`. Its runtime code is the independently reviewed `1ea24af7c97db1733d920a2949d681218d24687f`. The intervening package commit contains documentation/evidence, not a runtime change. The [approval record](evidence/m3/g2-approval.json) fixes runtime trees and SHA-256 versions of the documents the owner approved.

Before the local branch operation, `integration` was clean and pointed exactly at the approved package; there were no unplanned changes. No `main` branch existed. The integrator ran:

```sh
git branch main 4de180536eb75ebf3d653c063ef20ef7ba6dadc8
```

Both branch tips then identified the same approved package. No merge commit was necessary. Subsequent G3 documentation and evidence are prepared on `integration`; `main` stays at the exact G2-approved commit until the next applicable owner decision. No remote, push, publication, Mainnet action or contest submission was performed.

The owner verified funding, nested delegation, over-allocation rejection, successful payment, unknown-recipient denial, an allowed receiver's failure, inherited revoke, a working neighboring branch and owner refund. The independent review and prior executed evidence remain in the [historical G2 packet](G2_REVIEW_RU.md). Its “pending approval” wording describes the earlier checkpoint; this approval supersedes that status without rewriting the reviewed evidence.

The new authorized scope is English release documentation, limited UX proposals, recording materials, clean-checkout verification and a separate G3 package. Financial architecture remains frozen. G2 does not authorize public actions. Integrator actual model/effort remain **UNKNOWN / UNKNOWN**; requested roles and tool-accepted worker settings are recorded separately.
