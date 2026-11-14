# BudgetBranch — protocol v0.1.0 technical specification

Document edition: **2026-11-14-public**. This edition removes historical coordination and readiness text from the published baseline. Financial rules, wire types and protocol version are unchanged. Current document and ABI hashes are recorded in [FROZEN_INTERFACE.json](docs/FROZEN_INTERFACE.json); the precise editorial scope is described in [provenance](docs/PROVENANCE.md).

## 1. Scope and trust boundary

One `budgetbranch` Rust contract owns one funded tree for one immutable owner. Root grant `"0"` belongs to that owner. Each agent is a separate NEAR account with its own disposable Sandbox signing key. There is no LLM requirement, agent-supplied owner key, arbitrary method execution, token contract, relayer, multisig, or mainnet integration in v0.1.

Two instances of the same reviewed `demo-receiver` code supply accept/reject cases. A payment calls only `receive_payment` with native NEAR attached. Delegation changes storage only; **no physical transfer occurs at delegation or reclaim**. Owner recovery is a separate native transfer to the immutable owner.

The root's finite receiver list is fixed at initialization. Every permitted receiver must use the reviewed synchronous receiver code, have no upgrade entry point and no account access keys after setup. Deploy local WASM or an immutable global-code-by-hash reference; mutable global-code-by-account references are forbidden. Deployment evidence must contain code hash/code-reference kind, empty access-key list, and admin identity. The receiver can change accept/reject mode through its admin; it cannot return a Promise, forward funds, or schedule asynchronous work in `receive_payment`.

This is a security assumption, not an on-chain code-hash enforcement claim. Arbitrary or upgradeable receivers are unsupported. A receiver can retain the attached deposit and return a failing downstream Promise; refunding that apparent failure would create unbacked budget. The CLI fixture must refuse an unsupported deployment. A general untrusted merchant protocol is deferred.

## 2. Identifiers, numeric formats and limits

- All amounts are checked unsigned 128-bit yoctoNEAR; `1 NEAR = 10^24 yoctoNEAR`. Wire encoding is canonical unsigned decimal strings, no signs, whitespace, exponents, decimals or leading zeros except `"0"`. JavaScript uses `bigint`, never `number` for amounts or timestamps.
- Grant/payment IDs and block heights are unsigned 64-bit decimal strings. Timestamps are unsigned 64-bit nanoseconds from `env::block_timestamp()`. Expiry is exclusive: `now < expires_at_ns`.
- Contract-issued IDs increase monotonically, never reuse or wrap. Root is grant `"0"`; payments begin at `"1"`, grants after root at `"1"`. Missing IDs return `null` from single-record views.
- `request_id`: ASCII `[A-Za-z0-9_-]{1,64}`; callers choose it once per intent and retain it across transport retries. No account identity comes from this string.
- Account IDs use NEAR's validated `AccountId`. Allowlists are sorted unique nonempty arrays, maximum 8 accounts. No wildcards.
- Root depth is 0 and root.max_depth is exactly 3; A/B depth 1, A.child depth 2, one further descendant depth 3. `max_depth` is an **absolute depth ceiling**, not a count reset for each child. Maximum depth 3.
- Normal activity quota: 128 grants including root, 512 **spend** payment records and 1024 successful **delegate/spend** request records. Separate owner-only recovery quota: 1024 **owner_refund** payment records and 4096 **reclaim/refund_owner** request records. Payment IDs and request key namespace remain global, but counters/storage capacity are separate. Normal activity cannot consume recovery slots. No deletion/eviction of replay records. Revoke, callbacks and fund_operations create no quota records and remain callable when any quota is full.
- Recovery storage for the entire owner-only quota must be pre-funded before business deposits are accepted, with its remaining capacity protected from normal state growth (§4). Normal-cap exhaustion stops new normal operations, not recovery of the old deployment. Maximum view page 50; the snapshot contains at most 128 grants and the latest 50 payments (of at most 1536). IDs are never reused. Repeated owner-directed partial recovery or failed owner transfers can exhaust the **owner's own** finite recovery quota; this is an explicit demonstration lifetime limit, not an agent-controlled denial of recovery.
- Availability limit: an authorized agent can consume the global normal quotas with many small valid operations and stop a sibling's **new** normal activity. This prototype guarantees protected recovery, not fair-share/rate-limited availability. Views, revoke, callbacks and owner recovery remain available. Per-agent quota isolation is deferred.
- Fixed operational liquid buffer: `0.1 NEAR` outside the business budget. Initial deploy funding and `fund_operations` fund storage and this buffer. Buffer/gas measurements are recorded in `docs/VERIFICATION.md`; changing security semantics requires a protocol amendment.

## 3. Funds: local ledger and global conservation

Each grant stores `allocation`, `free`, `child_reserved`, `pending`, `spent`, `returned`.

```text
allocation(n) = free(n) + child_reserved(n) + pending(n) + spent(n) + returned(n)
child_reserved(n) = Σ [allocation(c) - returned(c)] for DIRECT children c

funded = allocation(root)
funded = Σ free(n) + Σ pending(n) + Σ spent(n) + returned(root)
```

`allocation` is the lifetime amount assigned to that grant. Only owner deposits increase the root allocation. Child allocations cannot be increased in place. `child_reserved` is the lifetime child commitment still charged to the parent; it includes that child's descendants, pending payments and confirmed spending. It is **not liquid money**. Never sum `child_reserved` across levels or add it to global free/pending/spent.

`free` is local, unallocated business principal. `pending` is local principal committed to an outgoing payment/refund not yet settled by its callback. `spent` is local successful receiver spending. A non-root `returned` is unused principal logically reclaimed to its immediate parent; root `returned` is a confirmed physical owner refund. These two meanings never enter the same global sum: only root.returned is globally returned.

Global totals sum only local `free/pending/spent`. The view must report both local ledgers and the global totals, with clear labels. Failed payments contribute neither spending nor an additional deposit. Donations, protocol gas rewards and operational funding do not increase `funded` or any grant allocation.

### State transitions (all amounts positive)

| Operation | Changes committed in its own receipt |
| --- | --- |
| `deposit(d)` | root.allocation += d; root.free += d; funded += d. `d` is the actual attached deposit. |
| `delegate(parent,d)` | parent.free -= d; parent.child_reserved += d; child.allocation = child.free = d; other child ledger fields = 0. |
| `spend(node,d)` | node.free -= d; node.pending += d; create pending payment and replay record **before** dispatch. |
| spend callback succeeded | node.pending -= d; node.spent += d; terminal payment succeeded. |
| spend callback failed | node.pending -= d; node.free += d; terminal payment failed. Allowed only under the synchronous receiver trust boundary in §1. |
| `reclaim(node,d)` | node.free -= d; node.returned += d; parent.child_reserved -= d; parent.free += d. No NEAR transfer. |
| `refund_owner(d)` | root.free -= d; root.pending += d; create pending refund; native transfer to owner. |
| refund callback succeeded | root.pending -= d; root.returned += d. |
| refund callback failed | root.pending -= d; root.free += d. |
| revoke | Set that grant's local revoked bit. No balance mutation, traversal, refund or pending cancellation. |

All arithmetic uses checked add/subtract, including intermediate sums, counters and conversions. Atomic failure reverts the entire initiating receipt, including newly created records/promises. All invariants must hold after every successful receipt, including callbacks and refunds.

## 4. Physical liquidity and operational funding

At initialization, `operational_funding` is the contract's existing account balance, with a zero business budget. Later `fund_operations` increases only that counter by the actual attached deposit. No operational withdrawal exists in v0.1. This keeps startup/storage funding separate from the exactly 10 NEAR business demonstration.

After fully persisting the current mutation, require:

```text
storage_required = storage_bytes_after_write * env::storage_byte_cost()
recovery_storage_reserved = remaining_recovery_bytes * env::storage_byte_cost()
operational_funding >= storage_required + recovery_storage_reserved + operational_buffer
protected_balance = max(operational_funding, storage_required + operational_buffer)
env::account_balance() >= protected_balance + outgoing_amount
```

The last check is required for **each** new outward transfer/call; v0.1 schedules at most one outgoing value-bearing promise per public call and none in a callback. `protected_balance` already includes storage; do not add storage twice. The reserve check applies before business deposits and to all new delegate/spend/reclaim/refund records, using remaining recovery capacity **after** that mutation. Initialization/operational topups need only cover their actual storage plus buffer, so the owner can fund the reserve before the first deposit. Callbacks/revoke cannot be blocked by creation quotas and must not grow storage. Protocol refunds can be delayed past the callback. A failed payment may restore logical `free` before cash is available; the liquidity check then rejects a new dispatch with `ERR_LIQUIDITY` until funds arrive. A balance increase is never used to infer the outcome of a particular payment.

`remaining_recovery_bytes` is a conservative measured upper bound for every unused owner-refund record (1024 maximum) and owner-recovery request record (4096 maximum), including map keys, indexes and serialized root growth. Maximum record sizes must be established from the bounded input schema; a guessed buffer is insufficient. A new recovery operation consumes its own reserved slots/bytes while normal records cannot do so. Expose the reserve and separate counters in BudgetView. A full-sweep recovery strategy needs at most 127 initial non-root reclaims + 512 failed spends × 3 ancestor reclaims + 513 owner refunds = 2176 recovery requests, below 4096; at most 513 successful owner refund batches, below 1024. Additional voluntary partial operations or repeated failed owner transfers consume the owner's finite extra allowance. A fresh deployment never solves stranded funds in an old deployment.

`near_sdk::store` writes can be cached. A storage measurement before flush is insufficient: flush collections and account for the serialized root state, or reserve a proven worst-case amount including root growth. The callback must update preallocated fixed-size fields only: no new map entries, dynamic error strings, growing collections or storage payments. Allocate maximum final representation before dispatch. Test serialized sizes and the reserve boundary.

Gas is prepaid by the transaction signer, separately from business NEAR and operational storage funds. Minimum prepaid gas: 100 Tgas for `spend`, 60 Tgas for `refund_owner`; reserve 30 Tgas for receiver execution and 30 Tgas for settlement, leaving local overhead. Use fixed gas allocations with no unbounded redistribution. Measure worst-case ancestor/storage/event costs in Sandbox; any required gas-constant amendment must also update shared SDK constants. Initiating-receipt out-of-gas rolls back reservation and dispatch; receiver out-of-gas produces a failed receiver result; **callback** out-of-gas leaves the accepted payment pending. Cash reserves cannot substitute for callback gas.

## 5. Caller identity and narrowing

Every public mutation other than initialization and callbacks requires a **direct call**: `predecessor_account_id == signer_account_id`. For owner actions they must also equal the immutable `owner_id`. For `delegate`/`spend` they must equal the selected grant's `delegatee_id`. Owner has no special power to spend/delegate another agent's grant; owner can revoke and recover unused funds instead. No JSON sender/agent parameter grants authority.

`new` is one-time, nonpayable, with predecessor AND signer equal to current contract account. Deploy+initialize atomically using that deployment account, then remove its access keys. Owner must differ from current contract account. The prototype has no upgrade method; fixture evidence shows the contract is locked. This prevents an exposed uninitialized contract and makes the deployment trust boundary explicit.

For every **new** spend/delegation traverse the grant and all ancestors to root (at most four nodes), validating existence, correct parent/depth links, non-revocation and unexpired time. For spending validate receiver membership at every ancestor. For delegation require the child's receivers to be a subset of every ancestor's receivers, expiry ≤ every ancestor's expiry, and absolute max_depth ≤ every ancestor's max_depth; child depth = parent.depth + 1 ≤ child.max_depth ≤ 3. Amount ≤ parent's local free; existing ancestor commitments already reserve that principal. Delegatee cannot equal the BudgetBranch contract account.

Existing grant constraints and delegatee are immutable. There is no widen/update/extend/unrevoke method. To change a grant, revoke it, reclaim unused money and issue a new grant within the still-valid parent constraints. Narrowing is enforced on chain, not inferred from the UI. Sibling grants are independent; revoking A does not change B.

## 6. Request identity and async payments

Idempotent methods: `delegate`, `spend`, `reclaim`, `refund_owner`. Persistent key `(actual caller account, request_id)` is global across these methods. Store method plus normalized semantic arguments and stable result (`grant_id`, `payment_id`, or reclaimed amount) atomically with the effect. Canonicalization includes sorted unique receivers, canonical integer strings and method name; use a typed persisted intent or an unambiguous canonical digest, never ad-hoc joined strings.

Processing order: validate direct identity/zero attached deposit and basic parsing, then look up the request. Exact retry by the same caller returns the stored identifier/result with no fresh transfer, even if its grant has since expired or been revoked. Different method or payload with the same key fails `ERR_REQUEST_CONFLICT`. New requests undergo all authorization, ancestry, bounds, free balance, gas and storage checks before acceptance. Failed transactions consume no request ID. Never automatically retry a failed payment under a new ID; the user must create a new intent.

`deposit` and `fund_operations` have no replay ID: each distinct successful payable transaction contributes its actual deposit, so it is separately funded. SDK must resolve a transaction hash before retrying; a fresh signed transaction is an additional deposit. `revoke` is idempotent by grant ID. A successful transaction submission is not a successful payment.

Payment fields are immutable after creation except fixed-size status, failure code and settlement timestamp. Callback arguments carry only `payment_id`; amount, destination, kind and source grant are loaded from storage. Public `spend/refund_owner` return `{ payment_id }` after scheduling, not a fabricated terminal status; callers poll the views. All receipts in the transaction must be inspected in tests.

```text
accepted transaction -> pending -> succeeded
                              \-> failed
callback missing/failed      -> remains pending (no timeout refund)
revoke during pending       -> remains pending until real result
```

`on_payment_result(payment_id)` is `#[private]`, predecessor must equal current account, exactly one dependency result must exist, and the payment must exist. No public API takes a caller-supplied outcome. Settled duplicates are no-ops after authenticating the callback and checking the result context. Callback authorization does NOT require signer == current: the original external signer may remain in the receipt chain.

Inspect actual promise success/failure without using receiver return JSON to decide money movement. A successful result with malformed/oversized bytes remains a successful monetary transfer. For pinned near-sdk 5.30.1 use `env::promise_result_checked(0, 0)`: `Ok` (empty successful return) and `PromiseError::TooLong` (nonempty successful return) both classify as **succeeded**; only `PromiseError::Failed` classifies as failed. The zero length bound avoids copying result bytes. Source: [pinned SDK implementation](https://raw.githubusercontent.com/near/near-sdk-rs/near-sdk-v5.30.1/near-sdk/src/environment/env.rs). If a future SDK introduces an unclassified outcome, preserve pending and report callback failure rather than recrediting. Do not recheck expiry/revoke in settlement; they only block new operations. Success/failure settles the original source grant even if it is revoked. Duplicate callbacks never change totals twice.

Callbacks never initiate automatic physical refunds. Failed receiver attached deposits return through protocol receipts, which can arrive later. This ordering is precisely why §4's liquidity check is required. The frontend must show a pending payment until the view becomes terminal, even when the initial transaction is successful.

## 7. Revoke, reclaim and recovery

Only the owner may `revoke` any grant, including root. Revocation is permanent and O(1); descendant views compute effective revocation from ancestors. Root revocation stops new grants/spends/deposits across the tree, but does not stop callbacks, operating topups, reclaim or owner refunds.

Only the owner may `reclaim` from a non-root grant that is effectively revoked or expired (itself or any ancestor). Reclaim can move at most that node's current `free`, to its immediate parent. It does not require the parent to be active. To recover a subtree, reclaim children then parents using distinct request IDs. A single reclaim does not recursively traverse or sweep funds. `pending` and `spent` cannot be reclaimed. After a later failed callback adds free to a revoked node, the owner can reclaim that new free with a new request ID. Replaying an old request has no extra effect.

`refund_owner` transfers only root.free to the immutable owner via native NEAR transfer, including after root expiry/revocation. It has the same reservation, replay protection, private callback, liquidity protection and pending semantics as spending. Root refunds count in root.returned only after actual transfer success. There is no arbitrary refund destination, admin payout bypass or refund of storage funding.

**Known limit:** there is no safe timeout-based force settlement for a callback that failed or never completed. Funds stay pending indefinitely, even if an explorer suggests the receiver settled. No owner override may manufacture a success/failure. A future recovery protocol would need independently verifiable receipt evidence and a separate design review.

## 8. ABI and wire types

`docs/abi.ts` is the exact JSON wire shape and error union. `sdk/src/types.ts` must expose it without independently redefining competing interfaces; the build may re-export the shared declaration or generate a verified identical copy. Rust serde output uses snake_case names below. All methods use a single JSON object argument; no arguments means `{}`. Mutations return JSON; BB validation failures panic with `BB:<ERROR_CODE>`. NEAR deserialization/runtime failures remain separate transport/contract-execution errors.

| Method | Caller / attached deposit | Args | Result |
| --- | --- | --- | --- |
| `new` | contract deployment self / 0 | `InitArgs` | `null` |
| `deposit` | owner / positive amount | `{}` | `BudgetView` |
| `fund_operations` | owner / positive amount | `{}` | `BudgetView` |
| `delegate` | parent delegatee / 0 | `DelegateArgs` | `{ grant_id }` |
| `spend` | source delegatee / 0 | `SpendArgs` | `{ payment_id }` |
| `revoke` | owner / 0 | `{ grant_id }` | `{ grant_id }` |
| `reclaim` | owner / 0 | `ReclaimArgs` | `{ grant_id, amount }` |
| `refund_owner` | owner / 0 | `RefundArgs` | `{ payment_id }` |
| `on_payment_result` | private self / 0 | `{ payment_id }` plus runtime result | `PaymentView` |
| `get_budget` | view | `{}` | `BudgetView` |
| `get_grant` | view | `{ grant_id }` | `GrantView \| null` |
| `list_grants` | view | `{ from_index, limit }` | `GrantView[]`, ascending numeric ID |
| `get_payment` | view | `{ payment_id }` | `PaymentView \| null` |
| `list_payments` | view | `{ from_index, limit }` | `PaymentView[]`, ascending numeric ID |
| `get_request` | view | `{ caller_id, request_id }` | `RequestView \| null` |
| `get_snapshot` | view | `{}` | `SnapshotView` (one consistent state read) |

Paging `from_index` is a zero-based **collection offset**, string u64, default `"0"`; `limit` integer 1..50, default 50; beyond end returns `[]`. No filtering in v0.1. Snapshot payments are the latest ≤50, still ascending by ID. Snapshot block/time belong to the same read, and total payment_count signals when history is partial. SDK should use finalized RPC reads; UI must not mix snapshots from different heights as if they were atomic.

Budget `physical_liquid` is `max(account_balance - protected_balance, 0)` at the view's block, not an invariant-derived balance or receiver-specific refund confirmation. `free` is the global logical free sum. `can_dispatch` is not exposed because auth/gas/state can change after a view.

`GrantView.effective_status` is `revoked` if any ancestor/self is revoked, otherwise `expired` if any is expired, otherwise `active`. `blocked_by` is the nearest node walking self→root with the selected blocking condition; active gives null. For payments, pending has null failure_code/settled_at_ns; succeeded has null failure_code and a settlement timestamp; failed has a settlement timestamp and exactly `ERR_RECEIVER_FAILED` (spend) or `ERR_TRANSFER_FAILED` (owner refund). Internal timestamp/error slots are preallocated even when JSON presents null.

The wire `RequestView.fingerprint` is lowercase SHA-256 of UTF-8 canonical JSON with **lexically sorted object keys**, canonical string integers, arrays in validated order, no whitespace, and shape `{ "method": <name>, "args": <arguments except request_id> }`. Store the typed intent too if needed for collision-independent equality. Rust/TS must share golden vectors. Serialization/transport errors that occur before contract validation need not carry the `BB:` prefix.

Events are single-line NEP-297-shaped JSON prefixed `EVENT_JSON:`, `standard: "budgetbranch"`, `version: "0.1.0"`, event name and `data: [object]`. Exact payloads are `EventPayloads` in `docs/abi.ts`. Names: `budget_deposited`, `operations_funded`, `grant_created`, `grant_revoked`, `grant_reclaimed`, `payment_pending`, `payment_succeeded`, `payment_failed`. Payment events carry the corresponding complete PaymentView. No new event for exact replay or already-revoked target. Views are authoritative; events do not assert off-chain service delivery or fungible cash location.

## 9. Demo receiver ABI

`new({ admin_id, budgetbranch_id })` is deployment-self only, one-time, nonpayable; starts in accept mode. `set_accepting({ accepting: boolean })` is direct admin only, nonpayable. `get_state({})` returns `{ admin_id, budgetbranch_id, accepting, received: Amount }`.

`receive_payment({ payment_id })` is payable and accepts only predecessor `budgetbranch_id`, attached amount >0, zero external promises, synchronous unit/null return. On reject, panic before writing; on accept, checked-add the actual deposit to `received`, record a fixed event and return. No user-specified refund, retained deposit on rejection, forwarding, async return or upgrade. Extra result-size/Promise-chain adversaries used by tests are **not** supported production receivers and never enter the normal allowlist fixture.

## 10. E2E acceptance scenario and expected totals

Use freshly created disposable Sandbox accounts: owner, A, B, A.child, optional depth-3 child, stranger, accepting and rejecting receivers. Fund deployment/storage/gas separately. Deploy reviewed WASM, initialize and remove contract keys. Deposit exactly `10000000000000000000000000` yoctoNEAR business principal.

| Step | Action | Expected result / global free, pending, spent, returned (NEAR) |
| --- | --- | --- |
| 1 | owner deposit 10 | 10 / 0 / 0 / 0 |
| 2 | owner delegates A=6, B=4 | same globals; root.free=0, root.child_reserved=10 |
| 3 | A delegates child=4 | A.free=2, A.child_reserved=4; globals unchanged |
| 4 | A attempts second child=4 | `ERR_INSUFFICIENT_FREE`; no grant/request/balance change |
| 5 | child pays accepting receiver 1 | receipt: 9/1/0/0; real successful callback: 9/0/1/0; receiver received increases by 1 |
| 6 | child pays stranger 1 | `ERR_RECIPIENT`; balances unchanged |
| 7 | child pays allowlisted rejecting receiver 1 | 8/1/1/0 then 9/0/1/0; payment failed, receiver received unchanged; verify actual refund receipts/liquidity |
| 8 | owner revokes A | no accounting change; new A/child spend+delegate fail; existing pending remains pending |
| 9 | B pays accepting receiver 1 | settles 8/0/2/0; B remains authorized |
| 10 | owner reclaims child free 3 then A free 5 | globals unchanged; root.free=5; A.returned=5; root.child_reserved=5 |
| 11 | owner refunds 5 | 3/5/2/0 then 3/0/2/5; no business budget leaked into storage costs |

At every step assert both equations, actual raw ledger, request/event counts, receiver balance/received counter, and receipt outcomes. Ignore signer gas when comparing their total account balances, or explicitly subtract measured fees. A failed RPC request alone proves no on-chain rejection.

Additional verification cases: sibling races/different request IDs; identical retry before/after settlement/revoke; request payload/method conflict; forged caller and intermediary preserving signer; widening receiver/expiry/depth; depth 4; exact expiry; revoked/expired ancestor; callback spoof with malicious promise; duplicate settlement; successful malformed/oversized result must not refund; receiver downstream-Promise trap rejected by deployment policy; failed receipt refund arriving after callback; simultaneous revoke/pending (both receipt orderings); native owner refund failure; partial reclaim while other funds pending; reclaim free restored by successful settlement of a failed payment after revoke; storage/gas boundary, request cap and overflow. Saturate the reachable normal grant/spend quotas, then prove owner revoke/reclaim/refund and previously scheduled callbacks still work without new funding. The 1024 normal-request ceiling is redundant under the tighter grant/spend caps: at most 127 + 512 = 639 normal requests can succeed; assert this bound rather than inventing an unreachable 1024-request Sandbox trace. Missing callback stays pending and cannot be force-settled.

Test levels are explicit: mathematical model, Rust unit context, NEAR Sandbox, Testnet, MOCK. Verification requires real Sandbox successes/failures and independent QA on the actual commit. Deterministic mock promise injection alone cannot prove real receipt ordering. Sandbox tests must capture or control the pending/revoke interleaving; if ordering cannot be reproduced, record that gap instead of calling the case passed.

## 11. Reproducible implementation

The verified host is native Apple Silicon macOS. The project-local runner pins Rust/Cargo 1.95.0, Node 24.14.0 / npm 11.9.0 and NEAR Sandbox 2.14.0 / protocol 88. Cargo.lock pins near-sdk 5.30.1, near-workspaces 0.24.0 and the host near-sandbox 0.4.1 launcher. The contract target is `wasm32-unknown-unknown`, with `--cfg near` and explicit source/cache path remapping.

Use the [Mac runbook](scripts/README.md). The [portable Wasm manifest](tests/portable-wasm.json) fixes build settings, source inputs and both reviewed artifact hashes. See [verification evidence](docs/VERIFICATION.md) for real Sandbox results and explicit remaining coverage gaps. Testnet, Mainnet and a working Linux/container runner are not claimed.

## 12. Technical references

- [NEAR cross-contract calls](https://docs.near.org/smart-contracts/anatomy/crosscontract): asynchronous independent execution; initiating receipt is not rolled back by receiver failure.
- [Private callbacks](https://docs.near.org/smart-contracts/security/cross-contract-calls/callbacks): only the contract itself may settle a callback.
- [NEP-616](https://github.com/near/NEPs/blob/master/neps/nep-0616.md): refund receipt and callback ordering are not a synchronous cash guarantee.
- [SDK storage collections](https://docs.rs/near-sdk/latest/near_sdk/store/index.html): persistence/flush behavior; pin implementation checks to the selected SDK.
- [near-sdk 5.30.1 manifest](https://raw.githubusercontent.com/near/near-sdk-rs/near-sdk-v5.30.1/Cargo.toml) and [SDK package metadata](https://raw.githubusercontent.com/near/near-sdk-rs/master/near-sdk/Cargo.toml).
- [near-workspaces 0.24.0 manifest](https://raw.githubusercontent.com/near/near-workspaces-rs/near-workspaces-v0.24.0/workspaces/Cargo.toml) and [native Sandbox requirements](https://github.com/near/near-sandbox-rs/).
