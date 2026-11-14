import type { BudgetBranchTransport, ChangeReceipt } from './client.js';
import { array, invalid, isRecord, record, string } from './decode.js';
import { BudgetBranchError, getContractErrorCode } from './errors.js';
import type { AccountId } from './types.js';

export interface JsonRpcOptions {
  rpcUrl: string;
  fetch?: typeof fetch | undefined;
  timeoutMs?: number | undefined;
}

export interface JsonRpcTransportOptions extends JsonRpcOptions {
  change?: NonNullable<BudgetBranchTransport['change']> | undefined;
}

const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);

function resolveRpcUrl(value: string): URL {
  let url: URL;
  try {
    url = value.startsWith('/') && !value.startsWith('//')
      ? new URL(value, globalThis.location?.origin) : new URL(value);
  } catch {
    throw new BudgetBranchError('rpc', 'Use a valid Sandbox or Testnet RPC URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.search) {
    throw new BudgetBranchError('rpc', 'Use an HTTP or HTTPS RPC URL without credentials, a query or a fragment');
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host.split('.').includes('mainnet') || host === 'rpc.near.org' || host === 'near.lava.build'
    || host === 'near.blockpi.network' || host === 'rpc.fastnear.com') {
    throw new BudgetBranchError('rpc', 'Use a Sandbox or Testnet RPC endpoint');
  }
  return url;
}

export function sandboxRpcUrl(value: string): string {
  const url = resolveRpcUrl(value);
  if (!loopback.has(url.hostname)) {
    throw new BudgetBranchError('rpc', 'The Sandbox signer requires a loopback RPC URL');
  }
  return url.href;
}

/** Shared JSON-RPC codec. Calls are sent once and remote error bodies are kept out of messages. */
export function createRpcRequester(options: JsonRpcOptions) {
  const url = resolveRpcUrl(options.rpcUrl).href;
  const fetchRpc = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
    throw new RangeError('RPC timeout must be a positive integer in milliseconds');
  }
  let nextId = 0;

  return async function request(method: string, params: unknown): Promise<unknown> {
    const id = `budgetbranch-${++nextId}`;
    const signal = AbortSignal.timeout(timeoutMs);
    let payload: unknown;
    try {
      const response = await fetchRpc(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'omit',
        redirect: 'error',
        signal,
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      });
      if (!response.ok) throw new BudgetBranchError('rpc', `NEAR RPC returned HTTP ${response.status}`);
      payload = await response.json() as unknown;
    } catch (error) {
      if (error instanceof BudgetBranchError) throw error;
      if (signal.aborted) throw new BudgetBranchError('timeout', 'NEAR RPC timed out');
      if (error instanceof SyntaxError) throw new BudgetBranchError('decode', 'NEAR RPC response is not valid JSON');
      throw new BudgetBranchError('rpc', 'Could not read a response from NEAR RPC');
    }
    const envelope = record(payload, 'NEAR RPC response');
    if (envelope.id !== id || envelope.jsonrpc !== '2.0') {
      return invalid('NEAR RPC response', 'a matching JSON-RPC 2.0 envelope');
    }
    if (Object.hasOwn(envelope, 'error')) {
      const error = envelope.error;
      const cause = isRecord(error) && isRecord(error.cause) ? error.cause.name : undefined;
      if (cause === 'TIMEOUT_ERROR' || cause === 'TIMEOUT') {
        throw new BudgetBranchError('timeout', 'NEAR RPC timed out');
      }
      if (cause === 'CONTRACT_EXECUTION_ERROR') {
        throw new BudgetBranchError('contract', 'NEAR view execution failed', { code: getContractErrorCode(error) });
      }
      throw new BudgetBranchError('rpc', `NEAR RPC rejected the ${method} request`);
    }
    if (!Object.hasOwn(envelope, 'result')) return invalid('NEAR RPC response', 'a result');
    return envelope.result;
  };
}

function encodeArgs(args: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(args));
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
}

function decodeJson(bytes: Uint8Array, path: string): unknown {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return invalid(path, 'UTF-8 encoded JSON');
  }
}

interface FinalizedReference { accountId: AccountId; blockHash?: string }
interface NearFunctionQuery extends FinalizedReference { method: string; args: object }
export interface NearTransactionQuery { transactionHash: string; senderId: AccountId }

/** Read contract state or resolve a previously submitted hash, including finalized refund receipts. */
export function createNearRpcReader(options: JsonRpcOptions) {
  const request = createRpcRequester(options);
  function query(type: string, { accountId, blockHash }: FinalizedReference, args: object = {}) {
    const block = blockHash === undefined ? { finality: 'final' } : { block_id: blockHash };
    return request('query', { request_type: type, account_id: accountId, ...block, ...args });
  }
  return {
    async viewFunction(call: NearFunctionQuery): Promise<{ value: unknown; blockHash: string }> {
      const value = await query('call_function', call, { method_name: call.method, args_base64: encodeArgs(call.args) });
      const result = record(value, 'NEAR call_function result');
      if (Object.hasOwn(result, 'error')) {
        throw new BudgetBranchError('contract', 'NEAR view execution failed', { code: getContractErrorCode(result.error) });
      }
      const bytes = result.result;
      if (!Array.isArray(bytes) || bytes.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
        return invalid('NEAR call_function result', 'a byte array');
      }
      return {
        value: decodeJson(Uint8Array.from(bytes), 'NEAR call_function result'),
        blockHash: string(result.block_hash, 'NEAR call_function block hash'),
      };
    },
    viewAccount(reference: FinalizedReference): Promise<unknown> {
      return query('view_account', reference);
    },
    viewAccessKeyList(reference: FinalizedReference): Promise<unknown> {
      return query('view_access_key_list', reference);
    },
    getTransaction({ transactionHash, senderId }: NearTransactionQuery): Promise<unknown> {
      return request('tx_status', {
        tx_hash: transactionHash, sender_account_id: senderId, wait_until: 'FINAL',
      });
    },
  };
}

export function createJsonRpcTransport(options: JsonRpcTransportOptions): BudgetBranchTransport {
  const reader = createNearRpcReader(options);
  return {
    async view({ contractId, method, args }) {
      return (await reader.viewFunction({ accountId: contractId, method, args })).value;
    },
    ...(options.change ? { change: options.change } : {}),
  };
}

function decodeSuccess(value: string): unknown {
  // NEAR methods with no return bytes, including deployment initialization, use an empty SuccessValue.
  if (value === '') return null;
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(value), char => char.charCodeAt(0));
  } catch {
    return invalid('Transaction return value', 'base64');
  }
  return decodeJson(bytes, 'Transaction return value');
}

function executionError(failure: unknown, transactionHash: string, initiated: boolean): never {
  const code = initiated ? getContractErrorCode(failure) : null;
  throw new BudgetBranchError(
    initiated ? 'contract' : 'transaction',
    code ? `Contract rejected the request (${code})` : 'NEAR transaction execution failed',
    { code, transactionHash },
  );
}

/** Decode the initiating call receipt. A later receipt may fail after this call succeeded. */
export function decodeNearChangeReceipt(
  outcome: unknown,
  transactionHash: string,
  expectedCall?: { senderId: AccountId; contractId: AccountId },
): ChangeReceipt<unknown> {
  try {
    const tx = record(outcome, 'NEAR transaction outcome');
    const transaction = record(tx.transaction, 'NEAR transaction');
    if (transaction.hash !== transactionHash
      || (expectedCall && (transaction.signer_id !== expectedCall.senderId
        || transaction.receiver_id !== expectedCall.contractId))) {
      return invalid('NEAR transaction outcome', 'the requested hash and accounts');
    }
    const transactionOutcome = record(record(tx.transaction_outcome, 'Transaction outcome').outcome, 'Transaction execution');
    const transactionStatus = record(transactionOutcome.status, 'Transaction status');
    if (Object.hasOwn(transactionStatus, 'Failure')) {
      return executionError(transactionStatus.Failure, transactionHash, false);
    }
    const initialReceiptId = string(transactionStatus.SuccessReceiptId, 'Initial receipt ID');
    const receipts = array(record)(tx.receipts_outcome, 'Receipt outcomes');
    const initial = receipts.find(receipt => receipt.id === initialReceiptId);
    if (!initial) throw new BudgetBranchError('timeout', 'The initiating receipt has no execution outcome', { transactionHash });
    const initialOutcome = record(initial.outcome, 'Initial receipt outcome');
    if (expectedCall && initialOutcome.executor_id !== expectedCall.contractId) {
      return invalid('Initial receipt executor', 'the requested contract');
    }
    const initialStatus = record(initialOutcome.status, 'Initial receipt status');
    if (Object.hasOwn(initialStatus, 'Failure')) {
      return executionError(initialStatus.Failure, transactionHash, true);
    }
    return {
      result: decodeSuccess(string(initialStatus.SuccessValue, 'Initial receipt return value')),
      transactionHash,
      logs: receipts.flatMap(receipt => array(string)(
        record(receipt.outcome, 'Receipt outcome').logs, 'Receipt logs',
      )),
    };
  } catch (error) {
    if (error instanceof BudgetBranchError && error.transaction_hash === null) {
      throw new BudgetBranchError(error.kind, error.message, { code: error.code, transactionHash });
    }
    throw error;
  }
}
