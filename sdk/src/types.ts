/** BudgetBranch 0.1.0 — G0 APPROVED / FROZEN. Wire declarations; SDK implementation is separate. */
export type AccountId = string;
/** Canonical decimal strings; validated at the boundary, never JS number. */
export type Amount = string;
export type U64 = string;
export type GrantId = U64;
export type PaymentId = U64;
export type RequestId = string;
export type EmptyArgs = Record<string, never>;

export type ErrorCode =
  | "ERR_INIT" // Already initialized or invalid initialization context.
  | "ERR_AUTH" // Wrong account, indirect call or forbidden self identity.
  | "ERR_DEPOSIT" // Zero funding deposit or nonzero deposit on a nonpayable method.
  | "ERR_ZERO_AMOUNT"
  | "ERR_NOT_FOUND"
  | "ERR_REVOKED"
  | "ERR_EXPIRED"
  | "ERR_RECIPIENT"
  | "ERR_WIDENING" // Child allowlist, expiry or absolute ceiling expands authority.
  | "ERR_DEPTH"
  | "ERR_INSUFFICIENT_FREE"
  | "ERR_REQUEST_ID"
  | "ERR_REQUEST_CONFLICT"
  | "ERR_CAPACITY"
  | "ERR_OVERFLOW" // Checked arithmetic/counter overflow or inconsistent subtraction.
  | "ERR_STORAGE_RESERVE"
  | "ERR_LIQUIDITY"
  | "ERR_GAS"
  | "ERR_CALLBACK" // Wrong callback dependency context or missing payment.
  | "ERR_RECLAIM_ACTIVE"
  | "ERR_RECLAIM_ROOT"
  | "ERR_ALLOWLIST" // Empty, duplicate, unsorted or excessive list.
  | "ERR_ARGUMENT";

export interface InitArgs {
  owner_id: AccountId;
  allowed_receivers: AccountId[];
  expires_at_ns: U64;
}
export interface DelegateArgs {
  parent_id: GrantId;
  delegatee_id: AccountId;
  amount: Amount;
  allowed_receivers: AccountId[];
  expires_at_ns: U64;
  max_depth: number;
  request_id: RequestId;
}
export interface SpendArgs {
  grant_id: GrantId;
  receiver_id: AccountId;
  amount: Amount;
  request_id: RequestId;
}
export interface ReclaimArgs {
  grant_id: GrantId;
  amount: Amount;
  request_id: RequestId;
}
export interface RefundArgs { amount: Amount; request_id: RequestId }
export interface GrantResult { grant_id: GrantId }
export interface PaymentResult { payment_id: PaymentId }
export interface ReclaimResult { grant_id: GrantId; amount: Amount }
export interface PageArgs { from_index?: U64; limit?: number }

export interface GrantLedger {
  allocation: Amount;
  free: Amount;
  /** Direct child lifetime commitments; includes descendant spending. */
  child_reserved: Amount;
  pending: Amount;
  spent: Amount;
  /** Non-root: reclaimed to parent. Root: physically refunded to owner. */
  returned: Amount;
}
export type GrantStatus = "active" | "revoked" | "expired";
export interface GrantView extends GrantLedger {
  grant_id: GrantId;
  parent_id: GrantId | null;
  delegatee_id: AccountId;
  depth: number;
  max_depth: number;
  allowed_receivers: AccountId[];
  expires_at_ns: U64;
  revoked: boolean;
  effective_status: GrantStatus;
  blocked_by: GrantId | null;
}
export type PaymentKind = "spend" | "owner_refund";
export type PaymentStatus = "pending" | "succeeded" | "failed";
export type PaymentFailure = "ERR_RECEIVER_FAILED" | "ERR_TRANSFER_FAILED";
export interface PaymentView {
  payment_id: PaymentId;
  kind: PaymentKind;
  grant_id: GrantId;
  caller_id: AccountId;
  request_id: RequestId;
  receiver_id: AccountId;
  amount: Amount;
  status: PaymentStatus;
  failure_code: PaymentFailure | null;
  created_at_ns: U64;
  settled_at_ns: U64 | null;
}
export interface BudgetView {
  protocol_version: "0.1.0";
  owner_id: AccountId;
  root_id: "0";
  funded: Amount;
  /** Global sums of local ledgers; never include child_reserved. */
  free: Amount;
  pending: Amount;
  spent: Amount;
  returned: Amount;
  operational_funding: Amount;
  operational_buffer: Amount;
  storage_required: Amount;
  recovery_storage_reserved: Amount;
  physical_liquid: Amount;
  grant_count: number;
  payment_count: number;
  request_count: number;
  spend_count: number;
  owner_refund_count: number;
  normal_request_count: number;
  recovery_request_count: number;
}
type RequestBase = {
  caller_id: AccountId;
  request_id: RequestId;
  /** Lowercase SHA-256 of canonical semantic intent; not a signature. */
  fingerprint: string;
};
export type RequestView = RequestBase & (
  | { method: "delegate"; result: GrantResult }
  | { method: "spend"; result: PaymentResult }
  | { method: "reclaim"; result: ReclaimResult }
  | { method: "refund_owner"; result: PaymentResult }
);
export interface RequestArgs { caller_id: AccountId; request_id: RequestId }
export interface SnapshotView {
  block_height: U64;
  block_timestamp_ns: U64;
  budget: BudgetView;
  grants: GrantView[];
  /** Latest <=50 payments in ascending ID order. */
  payments: PaymentView[];
}

/** `attached_deposit` and gas are transport options, never additional JSON args. */
export interface ChangeMethods {
  new: { args: InitArgs; result: null };
  deposit: { args: EmptyArgs; result: BudgetView };
  fund_operations: { args: EmptyArgs; result: BudgetView };
  delegate: { args: DelegateArgs; result: GrantResult };
  spend: { args: SpendArgs; result: PaymentResult };
  revoke: { args: GrantResult; result: GrantResult };
  reclaim: { args: ReclaimArgs; result: ReclaimResult };
  refund_owner: { args: RefundArgs; result: PaymentResult };
}
export interface ViewMethods {
  get_budget: { args: EmptyArgs; result: BudgetView };
  get_grant: { args: GrantResult; result: GrantView | null };
  list_grants: { args: PageArgs; result: GrantView[] };
  get_payment: { args: PaymentResult; result: PaymentView | null };
  list_payments: { args: PageArgs; result: PaymentView[] };
  get_request: { args: RequestArgs; result: RequestView | null };
  get_snapshot: { args: EmptyArgs; result: SnapshotView };
}
/** Deliberately absent from the public change SDK. Runtime result is not JSON. */
export interface PrivateCallbacks {
  on_payment_result: { args: PaymentResult; result: PaymentView };
}
export interface ReceiverState {
  admin_id: AccountId;
  budgetbranch_id: AccountId;
  accepting: boolean;
  received: Amount;
}
export interface ReceiverMethods {
  new: { args: { admin_id: AccountId; budgetbranch_id: AccountId }; result: null };
  set_accepting: { args: { accepting: boolean }; result: null };
  receive_payment: { args: PaymentResult; result: null };
  get_state: { args: EmptyArgs; result: ReceiverState };
}

/** Transport/decoder failures are not terminal payment failures. */
export type ClientErrorKind = "rpc" | "transaction" | "contract" | "decode" | "timeout";
export interface ClientError {
  kind: ClientErrorKind;
  code: ErrorCode | null;
  message: string;
  transaction_hash: string | null;
}

export interface EventPayloads {
  budget_deposited: { owner_id: AccountId; amount: Amount; funded: Amount };
  operations_funded: { owner_id: AccountId; amount: Amount; operational_funding: Amount };
  grant_created: { caller_id: AccountId; request_id: RequestId; grant: GrantView };
  grant_revoked: { caller_id: AccountId; grant_id: GrantId };
  grant_reclaimed: { caller_id: AccountId; request_id: RequestId; grant_id: GrantId; parent_id: GrantId; amount: Amount };
  payment_pending: PaymentView;
  payment_succeeded: PaymentView;
  payment_failed: PaymentView;
}
export type BudgetEvent = {
  [Name in keyof EventPayloads]: {
    standard: "budgetbranch";
    version: "0.1.0";
    event: Name;
    data: [EventPayloads[Name]];
  }
}[keyof EventPayloads];
