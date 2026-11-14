# BudgetBranch scripted agents

The scenario runs owner, A, B and child accounts through the frozen delegation, spend, revoke and recovery flow. Decisions come from the script. It uses disposable Sandbox accounts and no AI API.

## Build and run

From the repository root, use Node.js 22 or later.

```sh
npm --prefix sdk ci
npm --prefix sdk run build
npm --prefix agents ci
npm --prefix agents run build
npm --prefix agents test
npm --prefix agents run demo -- /absolute/path/to/sandbox-fixture.mjs
```

The agents package uses the local SDK package. Build the SDK before building or testing the agents. The agents tests run local assertions and MOCK fixtures.

## Sandbox fixture module

The CLI imports a local module that exports `createFixtureOptions()`. Its return value is `{ options, cleanup? }`, where `cleanup` is an async function that stops the local fixture. The integration harness provisions the accounts, deploys and initializes the reviewed Wasm, removes the three contract accounts' keys, and sets the rejecting receiver's mode. Use the nearcore 2.14.0 Sandbox and leave the business ledger empty for the script's 10 NEAR deposit. Deployment funding must cover the contract's operating buffer and storage reserve before the scenario starts.

```ts
import type { NearCallerSigner } from '@budgetbranch/sdk';
import type { SandboxFixtureOptions } from '@budgetbranch/agents';

type FixtureModule = {
  createFixtureOptions(): Promise<{
    options: SandboxFixtureOptions;
    cleanup?(): Promise<void>;
  }>;
};

type DisposableCallers = {
  owner: NearCallerSigner;
  agentA: NearCallerSigner;
  agentB: NearCallerSigner;
  child: NearCallerSigner;
};
```

Pass these fields in `options`.

| Field | Value |
| --- | --- |
| `rpcUrl` | Loopback HTTP RPC for the disposable Sandbox. |
| `contractId` | Initialized BudgetBranch account. Its root allowlist contains exactly the two receiver IDs. |
| `reviewedCodeHashes` | `{ budgetbranch, receiver }` with lowercase SHA-256 hex digests of the independently reviewed Wasm artifacts. RPC account hashes are base58. The fixture converts the expected hex digest before comparison. |
| `callers` | `{ owner, agentA, agentB, child }` with four separate `NearCallerSigner` instances. |
| `acceptingReceiver`, `rejectingReceiver`, `stranger` | Three distinct account IDs. The stranger is outside the root allowlist. |
| `receiverAdmins` | Optional `{ accepting, rejecting }` account IDs. Both default to the owner account. |
| `timeoutMs` | Optional per-RPC timeout in milliseconds. Default 30,000. |

Each caller's `sign(call)` constructs a direct transaction with one function call and returns `{ transactionHash, signedTransactionBase64 }`. The caller supplies the key and current nonce within the integration process. The SDK handles the single broadcast. Keep disposable signing material and signed transaction bytes out of persisted evidence and logs.

The fixture compares finalized deployment hashes and confirms empty access-key lists. It accepts local Wasm and immutable global code by hash. It rejects mutable global references and checks the receivers' admins and modes. [NEAR account and access-key queries](https://docs.near.org/api/rpc/contracts)

## Evidence

`runScriptedScenario(fixture, report?)` emits a step record after each checked action. The CLI prints these records as JSON lines under the **SCRIPTED DEMO (NEAR SANDBOX)** label. Each record includes the raw snapshot and transaction evidence. For payments, the script reads the snapshot from the initiating receipt's block, then verifies the terminal contract view, callback and delivery receipts. The failed receiver case requires the original deposit's finalized refund receipt. Final global free, pending, spent and returned must be **3 / 0 / 2 / 5 NEAR**. The scenario stops if receipt or view evidence is missing. [NEAR finalized receipt queries](https://docs.near.org/api/rpc/transactions)
