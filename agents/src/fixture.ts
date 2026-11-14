import { strict as assert } from 'node:assert';
import {
  BudgetBranchClient, checkSandboxRpc, createJsonRpcTransport, createNearRpcReader, createSandboxChange,
  isAccountId,
} from '@budgetbranch/sdk';
import type { AccountId, Amount, NearCallerSigner, ReceiverState, SnapshotView } from '@budgetbranch/sdk';
import { amount, decodeTransactionEvidence, list, object, text } from './evidence.js';
import type { TransactionEvidence } from './evidence.js';

export interface ScriptedCaller { accountId: AccountId; client: BudgetBranchClient }
export interface ReceiverReading { state: ReceiverState; balance: Amount; blockHash: string }
export interface DeploymentProof {
  accountId: AccountId;
  reference: 'local' | 'global-by-hash';
  codeHash: string;
  wasmSha256: string;
  accessKeyCount: 0;
  blockHash: string;
}

export interface ScriptedFixture {
  mode: 'NEAR_SANDBOX' | 'MOCK';
  chainId: string;
  contractId: AccountId;
  callers: { owner: ScriptedCaller; agentA: ScriptedCaller; agentB: ScriptedCaller; child: ScriptedCaller };
  acceptingReceiver: AccountId;
  rejectingReceiver: AccountId;
  stranger: AccountId;
  deployments: readonly DeploymentProof[];
  receiver(accountId: AccountId): Promise<ReceiverReading>;
  balance(accountId: AccountId): Promise<Amount>;
  transaction(transactionHash: string, signerId: AccountId): Promise<TransactionEvidence>;
  snapshotAt(blockHash: string): Promise<SnapshotView>;
}

export interface SandboxFixtureOptions {
  rpcUrl: string;
  contractId: AccountId;
  /** Lowercase hex SHA-256 digests of the independently reviewed local Wasm artifacts. */
  reviewedCodeHashes: { budgetbranch: string; receiver: string };
  callers: { owner: NearCallerSigner; agentA: NearCallerSigner; agentB: NearCallerSigner; child: NearCallerSigner };
  acceptingReceiver: AccountId;
  rejectingReceiver: AccountId;
  stranger: AccountId;
  receiverAdmins?: { accepting: AccountId; rejecting: AccountId };
  timeoutMs?: number;
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function sha256HexToBase58(hex: string): string {
  assert(/^[a-f0-9]{64}$/.test(hex) && hex.trim() === hex, 'Use lowercase hex SHA-256 of reviewed Wasm');
  assert(!/^0+$/.test(hex), 'The no-code hash cannot identify reviewed Wasm');
  const leadingZeros = (hex.match(/^(?:00)*/)?.[0].length ?? 0) / 2;
  let digest = BigInt(`0x${hex}`);
  let encoded = '';
  while (digest > 0n) {
    encoded = BASE58_ALPHABET.charAt(Number(digest % 58n)) + encoded;
    digest /= 58n;
  }
  return '1'.repeat(leadingZeros) + encoded;
}

export function verifyDeployment(
  accountId: AccountId,
  reviewedHex: string,
  accountView: unknown,
  accessKeyView: unknown,
): DeploymentProof {
  const account = object(accountView, 'Expected a finalized account view');
  const keys = object(accessKeyView, 'Expected a finalized access key list');
  const blockHash = text(account.block_hash, 'Expected the account view block hash');
  assert.equal(keys.block_hash, blockHash, 'Account and access keys must come from the same block');
  assert(account.global_contract_account_id == null, `${accountId} uses mutable global code`);
  const hashReference = account.global_contract_hash != null;
  const codeHash = text(hashReference ? account.global_contract_hash : account.code_hash, 'Expected a code hash');
  assert.equal(codeHash, sha256HexToBase58(reviewedHex), `${accountId} does not run the reviewed Wasm`);
  assert.equal(list(keys.keys, 'Expected access keys').length, 0, `${accountId} still has access keys`);
  assert(keys.last_key == null, `${accountId} access key list is incomplete`);
  return {
    accountId, codeHash, wasmSha256: reviewedHex, accessKeyCount: 0, blockHash,
    reference: hashReference ? 'global-by-hash' : 'local',
  };
}

export async function createSandboxFixture(options: SandboxFixtureOptions): Promise<ScriptedFixture> {
  const { contractId, acceptingReceiver, rejectingReceiver, stranger, reviewedCodeHashes } = options;
  const { owner, agentA, agentB, child } = options.callers;
  const accounts = [
    contractId, acceptingReceiver, rejectingReceiver, stranger,
    owner.accountId, agentA.accountId, agentB.accountId, child.accountId,
  ];
  assert(accounts.every(isAccountId), 'The fixture requires valid NEAR account IDs');
  assert.equal(new Set(accounts).size, accounts.length, 'The fixture requires distinct disposable accounts');
  const rpc = {
    rpcUrl: options.rpcUrl,
    timeoutMs: options.timeoutMs ?? 30_000,
  };
  const { rpcUrl, chainId } = await checkSandboxRpc(rpc);
  const rpcOptions = { ...rpc, rpcUrl };
  const reader = createNearRpcReader(rpcOptions);

  const base = object(await reader.viewAccount({ accountId: contractId }), 'Expected BudgetBranch account');
  const blockHash = text(base.block_hash, 'Expected finalized deployment block hash');
  const deployment = async (accountId: AccountId, reviewedHex: string, knownAccount?: unknown) => {
    const reference = { accountId, blockHash };
    const [account, keys] = await Promise.all([
      knownAccount ?? reader.viewAccount(reference), reader.viewAccessKeyList(reference),
    ]);
    return verifyDeployment(accountId, reviewedHex, account, keys);
  };
  const deployments = await Promise.all([
    deployment(contractId, reviewedCodeHashes.budgetbranch, base),
    deployment(acceptingReceiver, reviewedCodeHashes.receiver),
    deployment(rejectingReceiver, reviewedCodeHashes.receiver),
  ]);

  function caller(signer: NearCallerSigner): ScriptedCaller {
    const change = createSandboxChange({ ...rpcOptions, signer });
    return {
      accountId: signer.accountId,
      client: new BudgetBranchClient(contractId, createJsonRpcTransport({ ...rpcOptions, change })),
    };
  }

  async function receiver(accountId: AccountId, expectedBlock?: string): Promise<ReceiverReading> {
    const reference = { accountId, ...(expectedBlock === undefined ? {} : { blockHash: expectedBlock }) };
    const read = await reader.viewFunction({ ...reference, method: 'get_state', args: {} });
    assert(expectedBlock === undefined || read.blockHash === expectedBlock, 'Receiver state uses the requested block');
    const state = object(read.value, 'Expected receiver state');
    const adminId = text(state.admin_id, 'Expected receiver admin');
    assert(isAccountId(adminId), 'Expected a valid receiver admin');
    assert.equal(state.budgetbranch_id, contractId, 'Receiver authorizes this BudgetBranch deployment');
    assert(typeof state.accepting === 'boolean', 'Expected receiver acceptance mode');
    const account = object(await reader.viewAccount({ accountId, blockHash: read.blockHash }), 'Expected receiver account');
    assert.equal(account.block_hash, read.blockHash, 'Receiver state and balance are from the same block');
    return {
      state: {
        admin_id: adminId, budgetbranch_id: contractId, accepting: state.accepting,
        received: amount(state.received, 'Receiver received counter'),
      },
      balance: amount(account.amount, 'Receiver balance'),
      blockHash: read.blockHash,
    };
  }

  const [accept, reject] = await Promise.all([
    receiver(acceptingReceiver, blockHash),
    receiver(rejectingReceiver, blockHash),
  ]);
  assert.equal(accept.state.accepting, true, 'Accepting receiver mode');
  assert.equal(reject.state.accepting, false, 'Rejecting receiver mode');
  assert.equal(accept.state.admin_id, options.receiverAdmins?.accepting ?? owner.accountId, 'Accepting receiver admin');
  assert.equal(reject.state.admin_id, options.receiverAdmins?.rejecting ?? owner.accountId, 'Rejecting receiver admin');

  return {
    mode: 'NEAR_SANDBOX',
    chainId,
    contractId,
    callers: { owner: caller(owner), agentA: caller(agentA), agentB: caller(agentB), child: caller(child) },
    acceptingReceiver, rejectingReceiver, stranger, deployments,
    receiver,
    async balance(accountId) {
      const account = object(await reader.viewAccount({ accountId }), 'Expected a finalized account');
      return amount(account.amount, 'Account balance');
    },
    async transaction(transactionHash, signerId) {
      const raw = await reader.getTransaction({ transactionHash, senderId: signerId });
      return decodeTransactionEvidence(raw, { transactionHash, signerId, contractId });
    },
    snapshotAt(blockHash) {
      const readerAtBlock = new BudgetBranchClient(contractId, {
        async view({ method, args }) {
          const result = await reader.viewFunction({ accountId: contractId, blockHash, method, args });
          assert.equal(result.blockHash, blockHash, 'Historical snapshot must come from the requested block');
          return result.value;
        },
      });
      return readerAtBlock.get_snapshot();
    },
  };
}
