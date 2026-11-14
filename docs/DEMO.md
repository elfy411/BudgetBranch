# Record a real BudgetBranch demo

Run the actual local Sandbox flow below. The final ledger is **3 free / 0 pending / 2 spent / 5 returned NEAR**. The 112-second storyboard is a suggested presentation, not a verbatim transcript of a particular recording.

## Prepare the take

Follow the [README](../README.md) once, then start a fresh chain:

```sh
./scripts/mac.sh web --offline
```

Use `--offline` only after `./scripts/mac.sh web` has successfully run with network access, or after the earlier build steps and the README's web `npm ci` command have completed. SDK/unit alone do not download the web dependencies. Open the printed **REAL NEAR SANDBOX** URL. The fixture starts with zero business funding and four disposable signers; infrastructure/storage funding is already separate. Keep the process running. Ctrl-C discards this chain; a new run starts a new chain.

Record only the application window at a readable size. Show the Sandbox badge and use the persistent video caption **LOCAL NEAR SANDBOX · TEST NEAR · MANUAL SIGNER DEMO**. The browser actions below are operator-driven. The repository's separate agents CLI is deterministic and must be labeled **SCRIPTED AGENTS** if shown. Do not call this an autonomous LLM demonstration.

Frame the selected grant, its local free amount and the action. After a transaction, wait for the finalized snapshot or click **Refresh snapshot** before the next action. An initiating success is not yet payment settlement. Read the matching payment ID in **Recent payments**. If Pending settles before a frame is captured, show that same payment's real `payment_pending` and terminal receipt events; do not synthesize a Pending screen.

## Operator checklist

Use the signer selector and select the named grant in the tree before each action. Amounts below are whole test NEAR, entered as decimal values in the UI.

| Step | Signer / selected grant | Action and visible evidence |
| --- | --- | --- |
| 1 | `owner.test.near` / root | Fund **10**. Global funded and free become 10. |
| 2 | owner / root | Delegate **6** to `agent-a.test.near`; keep both reviewed receivers. |
| 3 | owner / root | Delegate **4** to `agent-b.test.near`. Keep only `accept.test.near`; clear `reject.test.near`. To show all narrowing dimensions, set **Depth ceiling** to **1** and **Earlier expiry (UTC, optional)** safely in the future, such as tomorrow in UTC. Read the UI's UTC label; do not reuse an expired date from an old recording. |
| 4 | `agent-a.test.near` / A | Delegate **4** to `child.test.near`. A now has only **2 local free**. |
| 5 | A / A | Try another **4** to `stranger.test.near`. Show `ERR_INSUFFICIENT_FREE`; no second child appears. |
| 6 | `child.test.near` / child | Spend **1** to `accept.test.near`. Match the accepted payment ID to **Succeeded**. |
| 7 | child / child | Try **1** to `stranger.test.near`. Show `ERR_RECIPIENT`; no payment is created. |
| 8 | child / child | Spend **1** to allowed `reject.test.near`. The request is accepted; settlement becomes **Failed / ERR_RECEIVER_FAILED**. Child's local free returns to **3**. The receiver rejects in a real Sandbox receipt. |
| 9 | owner / A | Revoke A. Select the child as its signer: show inherited revocation and disabled new actions. The contract also enforces this directly; independent negative tests are linked below. |
| 10 | `agent-b.test.near` / B | Spend **1** to `accept.test.near`. Show **Succeeded**, with B still active. This demonstrates this branch under available quotas, not guaranteed independent availability. |
| 11 | owner / child | Reclaim **3** from child to A. This moves a logical reservation up one level; it does not transfer to the owner's account. |
| 12 | owner / A | Reclaim **5** from A to root. |
| 13 | owner / root | **Refund owner 5**. Match its payment ID to **Owner refund · Succeeded**. This is the actual native transfer. |
| 14 | any / root and global ledger | Hold the final **free 3 / pending 0 / spent 2 / returned 5** totals. Free 3 remains in B; root local free is 0. Physical liquidity is a different field and can differ because it includes protocol effects. |

There are 13 initiating transactions in this concise flow, including the two explicit rejections. The retained browser evidence records 14 transactions: it also tries B paying its disallowed `reject.test.near` and observes `ERR_RECIPIENT`. That optional extra shot demonstrates B's narrower list directly and leaves the final totals unchanged. Without that shot, do not label this shorter take “14 transactions.” The complete automated scenario includes further direct negatives: [native runbook](../scripts/README.md), [security review](SECURITY_REVIEW.md).

## 112-second edit and English narration

Use cuts for typing and waiting, keeping an action, its receipt and its matching finalized state visible. A small “wait shortened” caption makes time compression clear. Pause longer on errors and the final ledger than on form entry.

| Time | Picture | Voiceover |
| --- | --- | --- |
| 0:00–0:10 | Sandbox badge, disposable owner, fresh root | “BudgetBranch limits delegated spending on NEAR. This is a local Sandbox with test NEAR. I’m driving the signers; the repo includes scripted agents.” |
| 0:10–0:31 | Fund 10; A6, B4 with narrower rights; A's child4; tree | “One funded budget. A gets six, B gets four with narrower permissions. A reserves four for its child, leaving only two to allocate.” |
| 0:31–0:42 | Second four rejected; unchanged tree | “Another four is rejected by the contract. Delegation cannot expand the budget.” |
| 0:42–1:07 | Child's successful one; unknown recipient rejection; allowed receiver's failed one; matching payment IDs | “An unknown receiver is rejected too. An accepted payment reserves funds until its callback settles. One receiver succeeds; the other rejects. That failure restores the child’s logical free funds.” |
| 1:07–1:25 | Owner revokes A; child's inherited status; B succeeds | “Revocation blocks new activity throughout A’s branch. B stays active and pays one. Existing payments still need their callbacks.” |
| 1:25–1:46 | Reclaim3, reclaim5; owner refund5; Succeeded row | “Reclaim moves unused reservations back up the tree. The owner refund is a separate transfer, confirmed here as succeeded.” |
| 1:46–1:52 | Final global ledger, readable end caption | “Ten funded: three free, zero pending, two spent, five refunded.” |

Keep transaction chronology clear. Never juxtapose receipts from different chains as if they were one run. The closing caption should remain legible: **Sandbox prototype · callback recovery and dependency limits remain**.

## Captions and assets

- Opening: **BudgetBranch — bounded delegation on NEAR**.
- Persistent mode: **LOCAL NEAR SANDBOX · TEST NEAR · MANUAL SIGNER DEMO**.
- Callback shot: **Accepted request ≠ settled payment**.
- Recovery shot: **Reclaim: logical reservation · Refund: native transfer**.
- Closing: **3 free / 0 pending / 2 spent / 5 returned · Prototype, not production-ready**.

The existing [actual Sandbox screenshot](evidence/browser/final-screen.jpg) is a composition reference and optional clearly labeled still. Its [trace](evidence/browser/scenario.json) identifies the chain. Hide unrelated tabs and desktop notifications. Keep private generated files, session credentials and local terminal environment dumps out of the recording.

Do not claim arbitrary receivers, confidential payments, Testnet/Mainnet deployment, a clean cargo audit, guaranteed callback recovery, or live LLM execution.
