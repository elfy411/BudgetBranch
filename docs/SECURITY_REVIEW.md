# Security review and limits

This is a bounded project review of a local Sandbox prototype, not professional audit certification or production-security approval. Financial and application code are unchanged from the reviewed public baseline. Independent reviewers did not author the implementations they reviewed. Development assistance is disclosed in [Attribution](ATTRIBUTIONS.md).

## Retained results

- The [independent contract probe](evidence/security/contract-probe.json) records real Sandbox replay, caller/authority and receipt rollback checks on the portable artifacts. The [ten direct contract suites](../contracts/README.md) additionally cover narrowing, callbacks, quotas, recovery and storage/gas.
- The [API evidence](evidence/security/api.json) records 65 checks including 56 rejected cases. Rejections preserved finalized financial state. Checks cover origin/host/session boundaries, routes, extra ABI fields, caller rights, exact amounts, replay and forbidden signing methods.
- The [browser evidence](evidence/security/browser.json) separates real cross-origin/framing/rendering checks from controlled injected transport failures and simulated changed-chain/stale-block responses. Simulated responses are not chain transactions.
- The [lifecycle evidence](evidence/security/lifecycle.json) covers occupied ports, shutdown and an actual deposit whose response was deliberately discarded. The response-loss injection is explicit; it does not make deposits universally idempotent.
- The [review extract](evidence/security/review-summary.json) retains historical findings and scope. A root-selection usability issue was resolved in the existing baseline. No confirmed Critical/High application finding was identified within the recorded scope. Open dependency advisories remain open.

## Trust boundaries and remaining gaps

Only reviewed, immutable, synchronous receiver contracts are supported. Their code/key checks are fixture deployment policy, not on-chain receiver-code enforcement. Arbitrary merchants or asynchronous receiver chains are unsupported.

A missing or failed callback can leave funds pending indefinitely. There is no timeout refund or administrative force settlement. Only `PromiseError::Failed` permits logical recredit; a successful nonempty/oversized `TooLong` result remains spent. Revocation blocks new actions without cancelling transfers already in flight.

A controlled interval between logical recredit and delayed physical refund was not reproduced. Exact expiry, authenticated duplicate callback, callback execution failure and low-cash dispatch denial have unit-context coverage, not all corresponding real-chain interleavings. Both storage recovery capacity and ordinary quotas are finite; shared ordinary quotas do not guarantee independent sibling availability. Operational funding cannot be withdrawn.

The loopback bridge intentionally controls all disposable demo roles for one trusted local operator. Origin/session checks do not authenticate local OS users or protect against a compromised machine/origin. Deposits lack contract request IDs: reconcile an ambiguous transaction before another funding intent. No Testnet, Mainnet, real-money custody, live LLM inference or general escrow safety is claimed.

See [dependency findings](DEPENDENCY_REVIEW.md), [verification and reproduction](VERIFICATION.md), and the [protocol specification](../SPEC.md).
