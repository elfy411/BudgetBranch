import { changeArgs, invalid, requestMethod } from './decode.js';
import type { ChangeMethods, RequestView } from './types.js';

export type RequestMethod = RequestView['method'];
export type RequestIntent = {
  [M in RequestMethod]: { method: M; args: ChangeMethods[M]['args'] };
}[RequestMethod];

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const fields = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : Number(a > b)));
    return `{${fields.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function delegateIntent(value: unknown): ChangeMethods['delegate']['args'] {
  const args = changeArgs.delegate(value, 'delegate.args');
  const allowlist = args.allowed_receivers;
  if (allowlist.length < 1 || allowlist.length > 8
    || allowlist.slice(1).some((receiver, index) => receiver <= allowlist[index]!)) {
    return invalid('delegate.args.allowed_receivers', 'a sorted, unique allowlist of 1 to 8 accounts');
  }
  return args;
}

export function canonicalRequest(intent: RequestIntent): string {
  const method = requestMethod(intent.method, 'Request method');
  const decoded = method === 'delegate' ? delegateIntent(intent.args) : changeArgs[method](intent.args, `${method}.args`);
  const { request_id: _requestId, ...args } = decoded;
  return canonicalJson({ method, args });
}

export async function requestFingerprint(intent: RequestIntent): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest(intent)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
