import type { BudgetBranchTransport, ChangeCall } from './client.js';
import { accountId, changeArgs, invalid, record } from './decode.js';
import { BudgetBranchError } from './errors.js';
import { createRpcRequester, decodeNearChangeReceipt, sandboxRpcUrl } from './rpc.js';
import type { JsonRpcOptions } from './rpc.js';
import type { AccountId } from './types.js';

export interface NearCallerSigner {
  readonly accountId: AccountId;
  /**
   * Sign one direct FunctionCall transaction for the supplied call and return its precomputed hash.
   * Signing stays inside the caller's local key closure. This method does not broadcast.
   */
  sign(call: ChangeCall): Promise<{ transactionHash: string; signedTransactionBase64: string }>;
}

async function sandboxChainId(request: ReturnType<typeof createRpcRequester>): Promise<string> {
  const status = record(await request('status', []), 'Sandbox status');
  if (typeof status.chain_id !== 'string'
    || !/^(?:test-chain|sandbox|localnet)(?:-[A-Za-z0-9_-]+)?$/.test(status.chain_id)) {
    throw new BudgetBranchError('rpc', 'The loopback RPC did not identify a Sandbox chain');
  }
  return status.chain_id;
}

export async function checkSandboxRpc(options: JsonRpcOptions): Promise<{ rpcUrl: string; chainId: string }> {
  const rpcUrl = sandboxRpcUrl(options.rpcUrl);
  const chainId = await sandboxChainId(createRpcRequester({ ...options, rpcUrl }));
  return { rpcUrl, chainId };
}

/** Bind one disposable local caller to a direct Sandbox transaction transport. */
export function createSandboxChange(options: JsonRpcOptions & {
  signer: NearCallerSigner;
}): NonNullable<BudgetBranchTransport['change']> {
  const signer = options.signer;
  const signerId = accountId(signer.accountId, 'Sandbox signer account');
  const request = createRpcRequester({ ...options, rpcUrl: sandboxRpcUrl(options.rpcUrl) });

  return async function change(call) {
    if (!Object.hasOwn(changeArgs, call.method)) return invalid('Sandbox method', 'a public change method');
    await sandboxChainId(request);
    let signed: Awaited<ReturnType<NearCallerSigner['sign']>>;
    try {
      signed = await signer.sign(call);
    } catch {
      throw new BudgetBranchError('transaction', 'The local Sandbox caller could not sign the transaction');
    }
    if (!signed || typeof signed.transactionHash !== 'string'
      || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(signed.transactionHash)
      || typeof signed.signedTransactionBase64 !== 'string' || !signed.signedTransactionBase64
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(signed.signedTransactionBase64)) {
      return invalid('Signed Sandbox transaction', 'a base58 hash and base64 signed transaction');
    }
    const hash = signed.transactionHash;
    let outcome: unknown;
    try {
      outcome = await request('send_tx', {
        signed_tx_base64: signed.signedTransactionBase64,
        wait_until: 'EXECUTED',
      });
    } catch (error) {
      if (error instanceof BudgetBranchError) {
        throw new BudgetBranchError(error.kind, error.message, { code: error.code, transactionHash: hash });
      }
      throw error;
    }
    return decodeNearChangeReceipt(outcome, hash, { senderId: signerId, contractId: call.contractId });
  };
}
