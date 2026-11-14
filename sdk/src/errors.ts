import type { ClientError, ClientErrorKind, ErrorCode } from './types.js';

export const ERROR_CODES = Object.freeze([
  'ERR_INIT', 'ERR_AUTH', 'ERR_DEPOSIT', 'ERR_ZERO_AMOUNT', 'ERR_NOT_FOUND',
  'ERR_REVOKED', 'ERR_EXPIRED', 'ERR_RECIPIENT', 'ERR_WIDENING', 'ERR_DEPTH',
  'ERR_INSUFFICIENT_FREE', 'ERR_REQUEST_ID', 'ERR_REQUEST_CONFLICT', 'ERR_CAPACITY',
  'ERR_OVERFLOW', 'ERR_STORAGE_RESERVE', 'ERR_LIQUIDITY', 'ERR_GAS', 'ERR_CALLBACK',
  'ERR_RECLAIM_ACTIVE', 'ERR_RECLAIM_ROOT', 'ERR_ALLOWLIST', 'ERR_ARGUMENT',
] as const satisfies readonly ErrorCode[]);

const codes: ReadonlySet<string> = new Set(ERROR_CODES);

export class BudgetBranchError extends Error implements ClientError {
  override readonly name = 'BudgetBranchError';
  readonly kind: ClientErrorKind;
  readonly code: ErrorCode | null;
  readonly transaction_hash: string | null;

  constructor(kind: ClientErrorKind, message: string, options: {
    code?: ErrorCode | null;
    transactionHash?: string | null;
  } = {}) {
    super(message);
    this.kind = kind;
    this.code = options.code ?? null;
    this.transaction_hash = options.transactionHash ?? null;
  }
}

export function getContractErrorCode(failure: unknown): ErrorCode | null {
  const detail = typeof failure === 'string' ? failure : JSON.stringify(failure);
  const match = detail?.match(/\bBB:(ERR_[A-Z0-9_]+)\b/);
  const code = match?.[1];
  return code && codes.has(code) ? code as ErrorCode : null;
}
