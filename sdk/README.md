# BudgetBranch TypeScript SDK

The SDK exposes the eight public BudgetBranch writes and seven views from the frozen v0.1.0 ABI. The build checks that its wire types match the frozen declarations byte for byte. All yoctoNEAR amounts, grant and payment IDs, gas values and timestamps use canonical decimal strings. Use `nearToYocto`, `yoctoToNear`, `parseAmount` and `parseU64` for exact conversion.

From the repository root, use Node.js 22 or later.

```sh
npm --prefix sdk ci
npm --prefix sdk run build
npm --prefix sdk test
```

## Finalized views

```ts
import { BudgetBranchClient, createJsonRpcTransport, yoctoToNear } from '@budgetbranch/sdk';

const transport = createJsonRpcTransport({ rpcUrl: 'http://127.0.0.1:3030' });
const client = new BudgetBranchClient('budget.test.near', transport);

const snapshot = await client.get_snapshot();
console.log(snapshot.block_height, yoctoToNear(snapshot.budget.free));
```

`createJsonRpcTransport` uses NEAR JSON-RPC `query` with `finality: 'final'`. For one coherent ledger view, use `get_snapshot`. Use `list_payments` to page older payment history. [NEAR contract queries](https://docs.near.org/api/rpc/contracts)

## Authorized callers

Pass a `change` transport bound to the authorized account. Each call supplies the contract ID, frozen method and arguments, gas and attached deposit. The adapter returns the initiating receipt's decoded result, transaction hash and observed logs. `parseBudgetEvent` decodes v0.1.0 BudgetBranch logs.

The local `createSandboxChange({ rpcUrl, signer })` adapter checks a loopback Sandbox RPC and calls the supplied `NearCallerSigner.sign(call)`. The signer returns the precomputed NEAR transaction hash and signed transaction bytes in base64. Keep the key in the provisioning process's in-memory signer and keep signed transaction bytes out of logs. A signer should sign one direct function call for the supplied contract, method, arguments, gas and deposit. The adapter broadcasts those bytes once. Its RPC response includes receipt outcomes and the adapter decodes the initiating receipt even when a later receipt fails. [NEAR transaction RPC](https://docs.near.org/api/rpc/transactions)

`spend` and `refund_owner` return a payment ID. Read `get_payment` or `get_snapshot` for the contract's pending, succeeded or failed status. A callback that fails to execute can leave a payment pending indefinitely.

## Resolving an ambiguous submission

- For `delegate`, `spend`, `reclaim` or `refund_owner`, retain the original arguments and request ID. `resolveRequest(callerId, { method, args })` checks the stored method and canonical SHA-256 fingerprint at finality. A missing result is a view of the finalized state at the time of that read. If you resubmit an ambiguous request, reuse the same account, method, arguments and ID.
- For `deposit` and `fund_operations`, use the transaction hash on `BudgetBranchError.transaction_hash` with `createNearRpcReader(...).getTransaction({ transactionHash, senderId })` to resolve the existing submission. A new successfully signed transaction adds a separate deposit. If your adapter cannot provide a hash, reconcile through its signer history before submitting fresh funding.
- For a completed payment with status `failed`, a new attempt is a separate user intent and needs a new request ID. The SDK issues no retries itself.

`BudgetBranchError.kind` describes SDK, RPC or execution errors. Its optional frozen `code` identifies a contract validation error. Terminal payment failure codes live on `PaymentView.failure_code`.

`npm --prefix sdk test` runs unit and MOCK transport tests. The scripted Sandbox scenario lives in the sibling agents package.
