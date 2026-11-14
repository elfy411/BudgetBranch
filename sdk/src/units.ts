import type { Amount, U64 } from './types.js';

export const YOCTO_PER_NEAR = 10n ** 24n;
export const MAX_U128 = (1n << 128n) - 1n;
export const MAX_U64 = (1n << 64n) - 1n;

function parseUnsigned(value: string, max: bigint, label: string): bigint {
  if (typeof value !== 'string' || value.length > max.toString().length
    || !/^(?:0|[1-9][0-9]*)$/.test(value) || value.trim() !== value) {
    throw new RangeError(`${label} must be a canonical decimal string`);
  }
  const parsed = BigInt(value);
  if (parsed > max) throw new RangeError(`${label} is out of range`);
  return parsed;
}

export function parseAmount(value: Amount): bigint {
  return parseUnsigned(value, MAX_U128, 'Amount');
}

export function parseU64(value: U64): bigint {
  return parseUnsigned(value, MAX_U64, 'U64');
}

export function amountFromBigInt(value: bigint): Amount {
  if (typeof value !== 'bigint' || value < 0n || value > MAX_U128) {
    throw new RangeError('Amount is out of range');
  }
  return value.toString();
}

export function u64FromBigInt(value: bigint): U64 {
  if (typeof value !== 'bigint' || value < 0n || value > MAX_U64) {
    throw new RangeError('U64 is out of range');
  }
  return value.toString();
}

export function nearToYocto(near: string): Amount {
  if (typeof near !== 'string' || !/^(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,24})?$/.test(near)
    || near.trim() !== near) {
    throw new RangeError('Use a decimal NEAR amount with up to 24 fractional digits');
  }
  const [whole, fraction = ''] = near.split('.') as [string, string?];
  return amountFromBigInt(BigInt(whole) * YOCTO_PER_NEAR + BigInt(fraction.padEnd(24, '0')));
}

export function yoctoToNear(yocto: Amount): string {
  const value = parseAmount(yocto);
  const fraction = (value % YOCTO_PER_NEAR).toString().padStart(24, '0').replace(/0+$/, '');
  const whole = (value / YOCTO_PER_NEAR).toString();
  return fraction ? `${whole}.${fraction}` : whole;
}
