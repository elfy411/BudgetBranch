# BudgetBranch web console

The console reads one finalized `get_snapshot` through the local `@budgetbranch/sdk` package. It displays the global budget, physical liquidity, each grant’s local ledger and limits, and the latest 50 payment records. When principal is pending, the console refreshes more frequently until the snapshot reports settlement. A failed refresh marks any previously loaded block as stale and disables signing.

## Local setup

Use Node 22.12+ within the 22 release line or Node 24+. From the repository root:

```sh
npm --prefix sdk ci --cache .cache/npm
npm --prefix sdk run build
npm --prefix web ci --cache .cache/npm
npm --prefix web run test
npm --prefix web run build
npm --prefix web run dev
```

Open the local URL printed by Vite. The default screen is a labeled **MOCK · SCRIPTED** example with signing disabled. The production build is in `web/dist`. Use `npm --prefix web run preview` to serve it locally with the same Sandbox read path.

### Sandbox

Start the repository’s local Sandbox fixture and leave it running. Set `BB_SANDBOX_PORT` to the fixture’s loopback RPC port when starting Vite. The default is `3030`.

```sh
BB_SANDBOX_PORT=3030 npm --prefix web run dev
```

In **Connection**, choose **Sandbox**, enter the deployed BudgetBranch contract account, and apply. The same-origin `/sandbox-rpc` path forwards only chain status and finalized BudgetBranch snapshot reads to the fixed loopback port. You can open directly with `?network=sandbox&contract=<account>&scripted=1`. Add `scripted=1` only for a fixture driven by the scripted scenario.

### Testnet

In **Connection**, choose **Testnet**, enter the deployed contract account and a public HTTPS Testnet RPC URL that permits browser requests, and apply. The console checks the RPC’s chain ID before reading the snapshot. The optional **Scripted scenario** label describes the origin of the demo activity. [NEAR RPC providers](https://docs.near.org/api/rpc/providers)

## Signing boundary

The console ships with a read transport. A local runner or wallet integration can provide a direct signing adapter before loading the page, or dispatch `budgetbranch:signerchange` after updating it. The app enables actions for the matching grant delegatee or immutable owner. The contract still validates the actual signer and every business constraint.

```ts
import type { BudgetBranchTransport } from "@budgetbranch/sdk";

function connectSigner(
  network: "sandbox" | "testnet",
  chainId: string,
  contractId: string,
  accountId: string,
  change: NonNullable<BudgetBranchTransport["change"]>,
) {
  window.budgetBranchSigner = { network, chainId, contractId, accountId, change };
  window.dispatchEvent(new Event("budgetbranch:signerchange"));
}
```

The adapter receives the SDK’s `ChangeCall` with the contract ID, exact method and JSON arguments, gas, and attached deposit. It must return the SDK’s `ChangeReceipt` with the initiating receipt’s result, actual transaction hash, and observed logs. Signing and key custody stay with the adapter. The console sends no test transaction unless a matching adapter is supplied and the user submits an action.

Funding, delegate, spend, revoke, reclaim, and owner refund use the SDK. A spend or refund receipt acknowledges an accepted payment ID. The UI takes terminal payment state from later snapshots. Retrying an unresolved request-ID action within its open form keeps its original arguments and request ID. If a deposit outcome is uncertain, the screen blocks another deposit for that connection until reload. Verify the first transaction with the adapter before reopening the funding form. Receipt events in the screen come from writes initiated during the current connection.

The package tests exercise UI intent preparation and SDK dispatch with a mock signing transport. Successful on-chain reads and writes require a live deployment and, for writes, a real adapter.
