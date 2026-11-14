# Native Apple Silicon runbook

Use a native ARM64 Mac with Apple Command Line Tools (`xcrun --find clang`). From a clean checkout:

```sh
./scripts/mac.sh bootstrap
mkdir -p .cache/evidence
./scripts/mac.sh sdk-sandbox > .cache/evidence/sdk-sandbox.jsonl
tail -n 1 .cache/evidence/sdk-sandbox.jsonl
```

Bootstrap installs Node.js **24.14.0** (npm **11.9.0**), Rustup **1.29.3**, Rust/Cargo **1.95.0** with `wasm32-unknown-unknown`, and native NEAR Sandbox **2.14.0** (protocol **88**) under `.local/`. Downloads and npm cache go under `.cache/`; the script does not change global tools or shell profiles. Bootstrap needs HTTPS access to the [Node.js archive](https://nodejs.org/en/download/archive/v24.14.0), [Rust distribution server](https://static.rust-lang.org/) and [NEAR Sandbox artifact host](https://github.com/near/near-sandbox-rs). The first build also needs the Cargo and npm registries. Node and Rustup archive hashes come from their published SHA-256 files. The Sandbox archive and executable hashes are observed pins from the official runner's download, not signed upstream checksums. Lockfiles pin dependencies and npm install scripts are disabled.

The scripted run builds Wasm from `contracts/` to load the checked-in `--cfg near`. It remaps Cargo and source path prefixes for the Wasm target so two checkout locations can produce the same bytes. [The portable Wasm manifest](../tests/portable-wasm.json) binds those build settings to the source, lockfile, and artifact hashes. The fixture checks the hashes before deploying and again checks code and empty key lists at finality. The earlier `contracts/evidence/` binaries were measured before path remapping and have different recorded hashes. Use `./scripts/mac.sh wasm` to build only the portable artifacts.

The fixture uses a new loopback-only chain. It funds deployment and storage separately, deploys and initializes each contract while deleting its final access key, and configures a rejecting receiver. The SDK then submits direct transactions from disposable in-memory accounts. The node's own generated validator files live in a private temporary directory under `/private/tmp` and are removed when the run exits normally or receives Ctrl-C. The fixture prints only public account identities, hashes, receipts, and ledger evidence. It does not use external RPCs, wallets, or paid APIs.

Expect `PASS` with **19 checked steps**, **18 direct SDK transactions**, and **six on-chain rejections**. The scenario verifies each payment's historical pending ledger, terminal callback, actual delivery or deposit refund, and conservation. The final amounts are **free 3 / pending 0 / spent 2 / returned 5 NEAR**. The Sandbox shuts down when the run finishes; its receipt evidence remains in the JSONL. These are real local-chain receipts, not Testnet transactions.

```sh
./scripts/mac.sh unit
./scripts/mac.sh sdk-sandbox --offline
```

`unit` runs the Rust unit contexts and SDK/agents unit and mock suites. These are separate from the real chain run. Add `--offline` to skip package downloads after that command has warmed its caches. Loopback must still be available. `BB_TOOLCHAIN_ROOT=/path/to/another/BudgetBranch` lets local worktrees reuse that project's `.local/` and `.cache/` without writing to global directories. `./scripts/mac.sh env <command>` exposes the same scoped tools to a single command.

After `sdk-sandbox` has built the Wasm, SDK, and agents, run the agents CLI directly with the repository's fixture module from the checkout root.

```sh
./scripts/mac.sh env npm --prefix agents run demo -- "$PWD/tests/sandbox-fixture.mjs"
```

To check the production web bundle and its unit/mock tests, run these commands after `sdk-sandbox` or `unit` builds the SDK:

```sh
./scripts/mac.sh env npm --prefix web ci --ignore-scripts --no-audit --no-fund
./scripts/mac.sh env npm --prefix web run build
./scripts/mac.sh env npm --prefix web test
```

## Interactive Sandbox console

```sh
./scripts/mac.sh web
```

Open the `REAL NEAR SANDBOX` URL printed in the terminal and leave the command running. It starts a fresh chain at zero business funding. Use the **Local Sandbox signer** selector above the console to switch among the four disposable accounts. Select the corresponding grant in the tree. If the finalized snapshot still shows the previous state after a completed action, click **Refresh snapshot** and wait for the ledger to reflect the change before choosing the next action or entering an amount.

1. As `owner.test.near`, fund the root with **10** NEAR. From the root, delegate **6** to `agent-a.test.near` and **4** to `agent-b.test.near`. For B, leave only `accept.test.near` selected under **Allowed recipients** by clearing `reject.test.near`.
2. As `agent-a.test.near`, delegate **4** from A to `child.test.near`. Try another **4** from A to `stranger.test.near`; the contract returns `ERR_INSUFFICIENT_FREE`.
3. As `child.test.near`, spend **1** to `accept.test.near` and watch the payment settle. Try **1** to `stranger.test.near` for `ERR_RECIPIENT`. Spend **1** to `reject.test.near`; the accepted request becomes a failed payment with `ERR_RECEIVER_FAILED`.
4. As `owner.test.near`, revoke A. Its child inherits the revocation. As `agent-b.test.near`, spend **1** to `accept.test.near` from B.
5. As owner, reclaim **3** from the child and then **5** from A. Select root and refund **5**. The global totals settle to **3 / 0 / 2 / 5**.

Each write yields a real local transaction hash. The web console's ordinary build stays read-only unless an adapter is provided. This command adds a local adapter for the disposable actors and serves the console on `127.0.0.1` only. The browser read proxy exposes chain status and finalized snapshots. The signer endpoint accepts only same-origin requests with the fixture session token, the configured BudgetBranch contract, and the six console methods. It keeps caller keys and signed transaction bytes in the local process. Use Ctrl-C to stop the console and discard the chain. Set `BB_WEB_PORT=5387` before the command if port 5173 is busy.

For an automated check, start `web` on a fresh fixture, then use a second terminal with the same `BB_WEB_PORT` to run:

```sh
./scripts/mac.sh env node tests/browser-sandbox-smoke.mjs
```

This requires Google Chrome (override the executable with `BB_CHROME_BIN`). It uses a temporary profile to submit the browser forms and checks the rendered final ledger and signer restrictions. It spends the fixture's test funds; restart `web` before a separate manual run. [SDK receipt evidence](../tests/evidence/sdk-sandbox-portable.jsonl) and [browser evidence](../tests/evidence/browser-sandbox.jsonl) come from separate disposable chains.
