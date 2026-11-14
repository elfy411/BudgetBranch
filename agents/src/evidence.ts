import { strict as assert } from 'node:assert';
import { getContractErrorCode, parseAmount } from '@budgetbranch/sdk';
import type { AccountId, Amount, ErrorCode, PaymentId } from '@budgetbranch/sdk';

export type ReceiptAction =
  | { kind: 'function_call'; method: string; amount: Amount; paymentId: PaymentId | null }
  | { kind: 'transfer'; amount: Amount };

export interface ReceiptEvidence {
  receiptId: string;
  blockHash: string;
  predecessorId: AccountId;
  executorId: AccountId;
  signerId: AccountId;
  action: ReceiptAction;
  status: 'succeeded' | 'failed';
  returnedPromise: boolean;
  errorCode: ErrorCode | null;
  tokensBurnt: Amount;
  logs: readonly string[];
}

export interface TransactionEvidence {
  transactionHash: string;
  signerId: AccountId;
  contractId: AccountId;
  transactionTokensBurnt: Amount;
  initial: ReceiptEvidence;
  related: readonly ReceiptEvidence[];
}

export function object(value: unknown, label: string): Record<string, unknown> {
  assert(typeof value === 'object' && value !== null && !Array.isArray(value), label);
  return value as Record<string, unknown>;
}

export function list(value: unknown, label: string): unknown[] {
  assert(Array.isArray(value), label);
  return value;
}

export function text(value: unknown, label: string): string {
  assert(typeof value === 'string' && value.length > 0, label);
  return value;
}

export function amount(value: unknown, label: string): Amount {
  const parsed = text(value, label);
  parseAmount(parsed);
  return parsed;
}

function decodeAction(actions: unknown): ReceiptAction {
  const entries = list(actions, 'Expected receipt actions');
  assert.equal(entries.length, 1, 'Each scripted receipt has one action');
  const action = object(entries[0], 'Expected a receipt action');
  if (action.Transfer !== undefined) {
    const data = object(action.Transfer, 'Expected a transfer');
    return { kind: 'transfer', amount: amount(data.deposit, 'Transfer deposit') };
  }
  const data = object(action.FunctionCall, 'Expected a function call');
  const method = text(data.method_name, 'Function call method');
  let paymentId = null;
  if (method === 'receive_payment' || method === 'on_payment_result') {
    const bytes = Buffer.from(text(data.args, 'Payment receipt arguments'), 'base64');
    const args = object(JSON.parse(bytes.toString('utf8')) as unknown, 'Expected payment arguments');
    paymentId = text(args.payment_id, 'Payment receipt ID');
  }
  return { kind: 'function_call', method, amount: amount(data.deposit, 'Function call deposit'), paymentId };
}

export function decodeTransactionEvidence(
  value: unknown,
  expected: { transactionHash: string; signerId: AccountId; contractId: AccountId },
): TransactionEvidence {
  const result = object(value, 'Expected a NEAR transaction outcome');
  assert.equal(result.final_execution_status, 'FINAL', 'Transaction and refund receipts must be finalized');
  const tx = object(result.transaction, 'Expected a NEAR transaction');
  assert.equal(tx.hash, expected.transactionHash, 'Transaction hash');
  assert.equal(tx.signer_id, expected.signerId, 'Transaction signer');
  assert.equal(tx.receiver_id, expected.contractId, 'Transaction destination');

  const txOutcome = object(object(result.transaction_outcome, 'Transaction outcome').outcome, 'Transaction execution');
  const initialId = text(object(txOutcome.status, 'Transaction status').SuccessReceiptId, 'Initial receipt ID');
  const byId = new Map(list(result.receipts, 'Expected finalized receipt actions').map(value => {
    const receipt = object(value, 'Expected a receipt');
    return [text(receipt.receipt_id, 'Expected receipt ID'), receipt] as const;
  }));

  const receipts = list(result.receipts_outcome, 'Expected finalized receipt outcomes').map(value => {
    const envelope = object(value, 'Expected an execution outcome');
    const receiptId = text(envelope.id, 'Expected execution receipt ID');
    const raw = byId.get(receiptId);
    assert(raw, `Missing finalized action for receipt ${receiptId}`);
    const action = object(object(raw.receipt, 'Expected receipt contents').Action, 'Expected an action receipt');
    const outcome = object(envelope.outcome, 'Expected receipt execution');
    const status = object(outcome.status, 'Expected an executed receipt status');
    const failed = Object.hasOwn(status, 'Failure');
    const returnedPromise = typeof status.SuccessReceiptId === 'string';
    assert(failed || returnedPromise || typeof status.SuccessValue === 'string', 'Receipt did not execute');
    const executorId = text(outcome.executor_id, 'Expected receipt executor');
    assert.equal(raw.receiver_id, executorId, 'Receipt executor matches its receiver');
    return {
      receiptId,
      blockHash: text(envelope.block_hash, 'Expected receipt block hash'),
      predecessorId: text(raw.predecessor_id, 'Expected receipt predecessor'),
      executorId,
      signerId: text(action.signer_id, 'Expected receipt signer'),
      action: decodeAction(action.actions),
      status: failed ? 'failed' : 'succeeded',
      returnedPromise,
      errorCode: failed ? getContractErrorCode(status.Failure) : null,
      tokensBurnt: amount(outcome.tokens_burnt, 'Receipt tokens burnt'),
      logs: list(outcome.logs, 'Expected receipt logs').map(log => {
        assert(typeof log === 'string', 'Expected a string log');
        return log;
      }),
    } satisfies ReceiptEvidence;
  });
  const initial = receipts.find(receipt => receipt.receiptId === initialId);
  assert(initial, 'Missing finalized initiating receipt');
  assert.equal(initial.predecessorId, expected.signerId, 'Initiating call is direct');
  assert.equal(initial.executorId, expected.contractId, 'Initiating call executes on BudgetBranch');
  assert.equal(initial.signerId, expected.signerId, 'Initiating receipt signer');
  return {
    ...expected,
    transactionTokensBurnt: amount(txOutcome.tokens_burnt, 'Transaction tokens burnt'),
    initial,
    related: receipts.filter(receipt => receipt !== initial),
  };
}
