> **Publication-copy notice:** This document records the private development review. Historical logs and reports may be redacted, and one-off audit helpers are omitted. Any original/byte-identical claims and historical hashes below refer to the private artifacts before publication processing, not necessarily these public copies. See [publication provenance](../PUBLICATION_PROVENANCE.md) for scope, exclusions and current file hashes. Use the root README for runnable commands.

# Small UX proposals for the demo

**Recommendation: record the approved G2 build unchanged.** These three improvements are optional follow-up work. They change presentation, not the financial contract, and are not prerequisites for G3.

The Frontend reviewer inspected the actual G2 final screenshot, its 14-transaction trace and the approved UI source. This was a review of existing evidence, not a new usability, accessibility or live-browser test. The [recording plan](DEMO.md) incorporates its practical workarounds.

| Priority | Trigger and proposal | Scope / risk | G3 recording workaround |
| --- | --- | --- | --- |
| 1 | After an accepted spend/refund, turn its payment ID into a link to the matching settlement row. Currently the viewer must scroll from the receipt to Recent payments. | Small UI change; handle a row that has not arrived and preserve focus. Never imply settlement from acceptance. | Show the receipt ID, then the same row. If Pending is brief, show actual pending/terminal events for that ID. |
| 2 | Make manual versus scripted activity explicit alongside Sandbox mode. The existing SCRIPTED label is opt-in; manual signing must not silently inherit it. | Copy/fixture presentation only; careless labeling could imply autonomous agents. | Persistent video caption “LOCAL NEAR SANDBOX · TEST NEAR · MANUAL SIGNER DEMO”; separately label any agents CLI clip. |
| 3 | Put the exact reason for unavailable actions next to disabled controls. Inherited revoke is currently explained near the grant heading. | Small conditional-copy change; distinguish revocation, signer mismatch and stale data; consider keyboard users. | Frame the child's inherited-revocation reason with its disabled actions, then switch to active B. |

Source locations: [receipt and action controls](../../web/src/GrantActions.tsx), [grant/payment views](../../web/src/Ledger.tsx), [connection mode](../../web/src/connection.ts), [mode banner](../../web/src/main.tsx).

Any later implementation should preserve the G2 state semantics and get a focused UI check. No runtime UX changes are included in this G3 packet.
