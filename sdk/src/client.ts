import { accountId, changeArgs, changeResults, invalid, viewArgs, viewResults } from './decode.js';
import { BudgetBranchError } from './errors.js';
import { requestFingerprint } from './fingerprint.js';
import type { RequestIntent } from './fingerprint.js';
import { parseAmount, parseU64 } from './units.js';
import type {
  AccountId, Amount, ChangeMethods, ClientErrorKind, DelegateArgs, EmptyArgs, GrantResult, InitArgs,
  PageArgs, PaymentResult, ReclaimArgs, RefundArgs, RequestArgs, RequestView, SpendArgs, U64, ViewMethods,
} from './types.js';

export type ViewCall = {
  [M in keyof ViewMethods]: { contractId: AccountId; method: M; args: ViewMethods[M]['args'] };
}[keyof ViewMethods];

export type ChangeCall = {
  [M in keyof ChangeMethods]: {
    contractId: AccountId;
    method: M;
    args: ChangeMethods[M]['args'];
    gas: U64;
    attachedDeposit: Amount;
  };
}[keyof ChangeMethods];

export interface ChangeReceipt<T> {
  result: T;
  transactionHash: string;
  /** Raw logs observed by the transport. Query payment state for the settlement result. */
  logs: readonly string[];
}

export interface BudgetBranchTransport {
  view(call: ViewCall): Promise<unknown>;
  change?(call: ChangeCall): Promise<ChangeReceipt<unknown>>;
}

export interface ChangeOptions { gas?: U64; attachedDeposit?: Amount }
export interface FundingOptions extends ChangeOptions { attachedDeposit: Amount }

export type RequestResolution =
  | { status: 'missing'; request: null }
  | { status: 'matched' | 'conflict'; request: RequestView };

export const DEFAULT_GAS = Object.freeze({
  new: '50000000000000',
  deposit: '50000000000000',
  fund_operations: '50000000000000',
  delegate: '50000000000000',
  spend: '100000000000000',
  revoke: '50000000000000',
  reclaim: '50000000000000',
  refund_owner: '60000000000000',
} as const satisfies Record<keyof ChangeMethods, U64>);

export function isAccountId(value: unknown): value is AccountId {
  try {
    accountId(value, 'Account ID');
    return true;
  } catch {
    return false;
  }
}

function transportError(error: unknown, kind: ClientErrorKind): never {
  if (error instanceof BudgetBranchError) throw error;
  throw new BudgetBranchError(kind, 'The injected transport did not return a confirmed result');
}

export class BudgetBranchClient {
  readonly contractId: AccountId;
  readonly #transport: BudgetBranchTransport;

  constructor(contractId: AccountId, transport: BudgetBranchTransport) {
    this.contractId = accountId(contractId, 'Contract ID');
    this.#transport = transport;
  }

  async #view<M extends keyof ViewMethods>(
    method: M, args: ViewMethods[M]['args'],
  ): Promise<ViewMethods[M]['result']> {
    const call = { contractId: this.contractId, method, args: viewArgs[method](args, `${method}.args`) } as ViewCall;
    let result: unknown;
    try {
      result = await this.#transport.view(call);
    } catch (error) {
      transportError(error, 'rpc');
    }
    return viewResults[method](result, `${method}.result`);
  }

  async #write<M extends keyof ChangeMethods>(
    method: M, args: ChangeMethods[M]['args'], options: ChangeOptions = {},
  ): Promise<ChangeReceipt<ChangeMethods[M]['result']>> {
    if (!this.#transport.change) {
      throw new BudgetBranchError('transaction', 'This transport has no authorized signer');
    }
    const gas = options.gas ?? DEFAULT_GAS[method];
    const attachedDeposit = options.attachedDeposit ?? '0';
    let deposit: bigint;
    try {
      parseU64(gas);
      deposit = parseAmount(attachedDeposit);
    } catch {
      return invalid(`${method} gas and attached deposit`, 'canonical decimal strings in range');
    }
    const payable = method === 'deposit' || method === 'fund_operations';
    if (payable !== (deposit > 0n)) {
      return invalid(`${method} attached deposit`, payable ? 'positive' : 'zero');
    }
    const call = {
      contractId: this.contractId,
      method,
      args: changeArgs[method](args, `${method}.args`),
      gas,
      attachedDeposit,
    } as ChangeCall;

    let receipt: ChangeReceipt<unknown>;
    try {
      receipt = await this.#transport.change(call);
    } catch (error) {
      transportError(error, 'transaction');
    }
    if (!receipt || typeof receipt.transactionHash !== 'string' || !receipt.transactionHash
      || !Array.isArray(receipt.logs) || receipt.logs.some(log => typeof log !== 'string')) {
      return invalid(`${method} receipt`, 'a transaction hash, result and string logs');
    }
    try {
      return {
        transactionHash: receipt.transactionHash,
        logs: receipt.logs,
        result: changeResults[method](receipt.result, `${method}.result`),
      };
    } catch (error) {
      if (error instanceof BudgetBranchError) {
        throw new BudgetBranchError(error.kind, error.message, { transactionHash: receipt.transactionHash });
      }
      throw error;
    }
  }

  new(args: InitArgs, options?: ChangeOptions) { return this.#write('new', args, options); }
  deposit(args: EmptyArgs, options: FundingOptions) { return this.#write('deposit', args, options); }
  fund_operations(args: EmptyArgs, options: FundingOptions) { return this.#write('fund_operations', args, options); }
  delegate(args: DelegateArgs, options?: ChangeOptions) { return this.#write('delegate', args, options); }
  spend(args: SpendArgs, options?: ChangeOptions) { return this.#write('spend', args, options); }
  revoke(args: GrantResult, options?: ChangeOptions) { return this.#write('revoke', args, options); }
  reclaim(args: ReclaimArgs, options?: ChangeOptions) { return this.#write('reclaim', args, options); }
  refund_owner(args: RefundArgs, options?: ChangeOptions) { return this.#write('refund_owner', args, options); }

  get_budget() { return this.#view('get_budget', {}); }
  get_grant(args: GrantResult) { return this.#view('get_grant', args); }
  list_grants(args: PageArgs = {}) { return this.#view('list_grants', args); }
  get_payment(args: PaymentResult) { return this.#view('get_payment', args); }
  list_payments(args: PageArgs = {}) { return this.#view('list_payments', args); }
  get_request(args: RequestArgs) { return this.#view('get_request', args); }
  get_snapshot() { return this.#view('get_snapshot', {}); }

  /** Resolve an ambiguous write via a finalized read without submitting anything. */
  async resolveRequest(callerId: AccountId, intent: RequestIntent): Promise<RequestResolution> {
    const { method, args: { request_id: requestId } } = intent;
    const fingerprint = await requestFingerprint(intent);
    const request = await this.get_request({ caller_id: callerId, request_id: requestId });
    if (!request) return { status: 'missing', request: null };
    if (request.caller_id !== callerId || request.request_id !== requestId) {
      return invalid('get_request.result', 'the requested caller and request ID');
    }
    const matches = request.method === method && request.fingerprint === fingerprint;
    return { status: matches ? 'matched' : 'conflict', request };
  }
}
