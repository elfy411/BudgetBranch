import { BudgetBranchError } from './errors.js';
import { parseAmount, parseU64 } from './units.js';
import type {
  BudgetView, ChangeMethods, EventPayloads, GrantView, PaymentView, RequestView,
  SnapshotView, ViewMethods,
} from './types.js';

export type Decoder<T> = (value: unknown, path: string) => T;

export function invalid(path: string, expected: string): never {
  throw new BudgetBranchError('decode', `${path} must be ${expected}`);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function record(value: unknown, path: string): Record<string, unknown> {
  return isRecord(value) ? value : invalid(path, 'an object');
}

export const string: Decoder<string> = (value, path) =>
  typeof value === 'string' ? value : invalid(path, 'a string');

export const boolean: Decoder<boolean> = (value, path) =>
  typeof value === 'boolean' ? value : invalid(path, 'a boolean');

const integer: Decoder<number> = (value, path) =>
  typeof value === 'number' && Number.isSafeInteger(value)
    ? value : invalid(path, 'a safe integer');

const counter: Decoder<number> = (value, path) => {
  const parsed = integer(value, path);
  return parsed >= 0 ? parsed : invalid(path, 'a nonnegative count');
};

const depth: Decoder<number> = (value, path) => {
  const parsed = counter(value, path);
  return parsed <= 3 ? parsed : invalid(path, 'an integer from 0 to 3');
};

function matchString(pattern: RegExp, expected: string): Decoder<string> {
  return (value, path) => {
    const parsed = string(value, path);
    return pattern.test(parsed) && parsed.trim() === parsed ? parsed : invalid(path, expected);
  };
}

export const accountId = matchString(/^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/, 'a NEAR account ID');
const requestId = matchString(/^[A-Za-z0-9_-]{1,64}$/, 'a request ID');
const fingerprint = matchString(/^[a-f0-9]{64}$/, 'a lowercase SHA-256 hex digest');

function checkedDecimal(parse: (value: string) => bigint, expected: string): Decoder<string> {
  return (value, path) => {
    const parsed = string(value, path);
    try {
      parse(parsed);
    } catch {
      invalid(path, expected);
    }
    return parsed;
  };
}

export const amount = checkedDecimal(parseAmount, 'a canonical u128 decimal string');
export const u64 = checkedDecimal(parseU64, 'a canonical u64 decimal string');

export function array<T>(decode: Decoder<T>): Decoder<T[]> {
  return (value, path) => {
    if (!Array.isArray(value)) invalid(path, 'an array');
    return Array.from(value, (item, index) => decode(item, `${path}[${index}]`));
  };
}

function oneOf<const T extends string>(...values: T[]): Decoder<T> {
  return (value, path) => {
    const parsed = string(value, path);
    const match = values.find(item => item === parsed);
    return match ?? invalid(path, values.join(' or '));
  };
}

function nullable<T>(decode: Decoder<T>): Decoder<T | null> {
  return (value, path) => value === null ? null : decode(value, path);
}

function shape<T>(fields: { [K in keyof T]-?: Decoder<T[K]> }): Decoder<T> {
  return (value, path) => {
    const input = record(value, path);
    const entries = Object.entries<Decoder<unknown>>(fields);
    if (Object.keys(input).length !== entries.length) invalid(path, 'an object with the frozen wire fields');
    return Object.fromEntries(entries.map(([key, decode]) => [
      key, decode(input[key], `${path}.${key}`),
    ])) as T;
  };
}

const empty: Decoder<Record<string, never>> = shape({});
const nil: Decoder<null> = (value, path) => value === null ? null : invalid(path, 'null');
const grantRef = shape<{ grant_id: string }>({ grant_id: u64 });
const paymentRef = shape<{ payment_id: string }>({ payment_id: u64 });
const reclaimResult = shape<{ grant_id: string; amount: string }>({ grant_id: u64, amount });

const requestArgs = shape<{ caller_id: string; request_id: string }>({
  caller_id: accountId,
  request_id: requestId,
});

const pageArgs: Decoder<ViewMethods['list_grants']['args']> = (value, path) => {
  const input = record(value, path);
  if (Object.keys(input).some(key => key !== 'from_index' && key !== 'limit')) {
    invalid(path, 'an object with only from_index and limit');
  }
  return {
    ...(input.from_index === undefined ? {} : { from_index: u64(input.from_index, `${path}.from_index`) }),
    ...(input.limit === undefined ? {} : { limit: integer(input.limit, `${path}.limit`) }),
  };
};

const receivers = array(accountId);

const grant = shape<GrantView>({
  grant_id: u64, parent_id: nullable(u64), delegatee_id: accountId, depth, max_depth: depth,
  allowed_receivers: receivers, expires_at_ns: u64, revoked: boolean,
  effective_status: oneOf('active', 'revoked', 'expired'), blocked_by: nullable(u64),
  allocation: amount, free: amount, child_reserved: amount, pending: amount,
  spent: amount, returned: amount,
});

const paymentFields = shape<PaymentView>({
  payment_id: u64, kind: oneOf('spend', 'owner_refund'), grant_id: u64, caller_id: accountId,
  request_id: requestId, receiver_id: accountId, amount, status: oneOf('pending', 'succeeded', 'failed'),
  failure_code: nullable(oneOf('ERR_RECEIVER_FAILED', 'ERR_TRANSFER_FAILED')),
  created_at_ns: u64, settled_at_ns: nullable(u64),
});

const payment: Decoder<PaymentView> = (value, path) => {
  const result = paymentFields(value, path);
  const expectedFailure = result.kind === 'spend' ? 'ERR_RECEIVER_FAILED' : 'ERR_TRANSFER_FAILED';
  const isPending = result.status === 'pending';
  const hasSettlement = result.settled_at_ns !== null;
  if (isPending === hasSettlement
    || result.failure_code !== (result.status === 'failed' ? expectedFailure : null)) {
    invalid(path, 'a payment with fields consistent with its status');
  }
  return result;
};

const budget = shape<BudgetView>({
  protocol_version: oneOf('0.1.0'), owner_id: accountId, root_id: oneOf('0'),
  funded: amount, free: amount, pending: amount, spent: amount, returned: amount,
  operational_funding: amount, operational_buffer: amount, storage_required: amount,
  recovery_storage_reserved: amount, physical_liquid: amount, grant_count: counter,
  payment_count: counter, request_count: counter, spend_count: counter, owner_refund_count: counter,
  normal_request_count: counter, recovery_request_count: counter,
});

const snapshot = shape<SnapshotView>({
  block_height: u64, block_timestamp_ns: u64, budget, grants: array(grant), payments: array(payment),
});

const requestFields = {
  caller_id: accountId, request_id: requestId, fingerprint,
};
const requestDecoders: { [M in RequestView['method']]: Decoder<Extract<RequestView, { method: M }>> } = {
  delegate: shape({ ...requestFields, method: oneOf('delegate'), result: grantRef }),
  spend: shape({ ...requestFields, method: oneOf('spend'), result: paymentRef }),
  reclaim: shape({ ...requestFields, method: oneOf('reclaim'), result: reclaimResult }),
  refund_owner: shape({ ...requestFields, method: oneOf('refund_owner'), result: paymentRef }),
};

export const requestMethod = oneOf('delegate', 'spend', 'reclaim', 'refund_owner');
const request: Decoder<RequestView> = (value, path) => {
  const method = requestMethod(record(value, path).method, `${path}.method`);
  return requestDecoders[method](value, path);
};

export const viewArgs: { [M in keyof ViewMethods]: Decoder<ViewMethods[M]['args']> } = {
  get_budget: empty, get_grant: grantRef, list_grants: pageArgs, get_payment: paymentRef,
  list_payments: pageArgs, get_request: requestArgs, get_snapshot: empty,
};

export const viewResults: { [M in keyof ViewMethods]: Decoder<ViewMethods[M]['result']> } = {
  get_budget: budget, get_grant: nullable(grant), list_grants: array(grant),
  get_payment: nullable(payment), list_payments: array(payment), get_request: nullable(request),
  get_snapshot: snapshot,
};

export const changeArgs: { [M in keyof ChangeMethods]: Decoder<ChangeMethods[M]['args']> } = {
  new: shape({ owner_id: accountId, allowed_receivers: receivers, expires_at_ns: u64 }),
  deposit: empty,
  fund_operations: empty,
  delegate: shape({
    parent_id: u64, delegatee_id: accountId, amount, allowed_receivers: receivers,
    expires_at_ns: u64, max_depth: integer, request_id: requestId,
  }),
  spend: shape({ grant_id: u64, receiver_id: accountId, amount, request_id: requestId }),
  revoke: grantRef,
  reclaim: shape({ grant_id: u64, amount, request_id: requestId }),
  refund_owner: shape({ amount, request_id: requestId }),
};

export const changeResults: { [M in keyof ChangeMethods]: Decoder<ChangeMethods[M]['result']> } = {
  new: nil, deposit: budget, fund_operations: budget, delegate: grantRef, spend: paymentRef,
  revoke: grantRef, reclaim: reclaimResult, refund_owner: paymentRef,
};

export const eventPayloads: { [Name in keyof EventPayloads]: Decoder<EventPayloads[Name]> } = {
  budget_deposited: shape({ owner_id: accountId, amount, funded: amount }),
  operations_funded: shape({ owner_id: accountId, amount, operational_funding: amount }),
  grant_created: shape({ caller_id: accountId, request_id: requestId, grant }),
  grant_revoked: shape({ caller_id: accountId, grant_id: u64 }),
  grant_reclaimed: shape({ caller_id: accountId, request_id: requestId, grant_id: u64, parent_id: u64, amount }),
  payment_pending: payment,
  payment_succeeded: payment,
  payment_failed: payment,
};
