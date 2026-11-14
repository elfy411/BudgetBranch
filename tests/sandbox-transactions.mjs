import { strict as assert } from 'node:assert';
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto';

// Minimal Borsh subset for this pinned, disposable NEAR Sandbox fixture.
// See nearcore 2.14.0: core/primitives/src/{transaction.rs,action/mod.rs}.
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ED25519 = Buffer.from([0]);
const ED25519_SEED_HEADER = Buffer.from('302e020100300506032b657004220420', 'hex');

function base58Encode(bytes) {
  let value = BigInt(`0x${bytes.toString('hex')}`);
  let result = '';
  while (value > 0n) {
    result = BASE58[Number(value % 58n)] + result;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    result = '1' + result;
  }
  return result;
}

function base58Decode(input, length) {
  assert(typeof input === 'string' && input.length > 0 && input.length <= Math.ceil(length * 1.38), 'Invalid base58 input');
  let value = 0n;
  for (const char of input) {
    const digit = BASE58.indexOf(char);
    assert(digit >= 0, 'Invalid base58 input');
    value = value * 58n + BigInt(digit);
  }
  const hex = value === 0n ? '' : value.toString(16);
  const body = Buffer.from(hex.length % 2 ? `0${hex}` : hex, 'hex');
  const leading = /^1*/.exec(input)[0].length;
  assert(leading + body.length === length, 'Invalid decoded base58 length');
  return Buffer.concat([Buffer.alloc(leading), body]);
}

function littleEndian(value, width) {
  let integer = BigInt(value);
  assert(integer >= 0n && integer < 1n << BigInt(8 * width), 'Invalid transaction integer');
  const bytes = Buffer.alloc(width);
  for (let i = 0; i < width; i++, integer >>= 8n) bytes[i] = Number(integer & 255n);
  return bytes;
}

function sized(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  return Buffer.concat([littleEndian(bytes.length, 4), bytes]);
}

function action(tag, ...fields) {
  return Buffer.concat([Buffer.from([tag]), ...fields]);
}

export function functionCall(method, args, gas, deposit = '0') {
  return action(2, sized(method), sized(JSON.stringify(args)), littleEndian(gas, 8), littleEndian(deposit, 16));
}

export function createAccountActions(publicKey, funds) {
  return [
    action(0), // CreateAccount
    action(5, publicKey, littleEndian(0n, 8), Buffer.from([1])), // AddKey, FullAccess
    action(3, littleEndian(funds, 16)), // Transfer
  ];
}

export function lockContractActions(wasm, init, publicKey) {
  return [action(1, sized(wasm)), init, action(6, publicKey)]; // Deploy, initialize, DeleteKey
}

export function sandboxAccount(accountId, request, validatorKey) {
  const privateKey = validatorKey ? importValidatorKey(validatorKey) : generateKeyPairSync('ed25519').privateKey;
  const publicKeyBytes = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(-32);
  const publicKey = Buffer.concat([ED25519, publicKeyBytes]);
  const rpcPublicKey = `ed25519:${base58Encode(publicKeyBytes)}`;
  if (validatorKey) assert(validatorKey.public_key === rpcPublicKey, 'Sandbox validator key mismatch');

  let lastNonce = 0n;
  let nextSign = Promise.resolve();
  function signActions(receiverId, actions) {
    const pending = nextSign.then(async () => {
      const accessKey = await request('query', {
        request_type: 'view_access_key', finality: 'optimistic', account_id: accountId, public_key: rpcPublicKey,
      });
      // RPC nonce is a JSON number. Refuse any height beyond exact JS representation.
      assert(Number.isSafeInteger(accessKey.nonce) && accessKey.nonce >= 0, 'Unsafe access key nonce');
      const chainNonce = BigInt(accessKey.nonce);
      lastNonce = (lastNonce > chainNonce ? lastNonce : chainNonce) + 1n;
      const tx = Buffer.concat([
        sized(accountId), publicKey, littleEndian(lastNonce, 8), sized(receiverId),
        base58Decode(accessKey.block_hash, 32), littleEndian(actions.length, 4), ...actions,
      ]);
      const hash = createHash('sha256').update(tx).digest();
      const signature = sign(null, hash, privateKey);
      return {
        transactionHash: base58Encode(hash),
        signedTransactionBase64: Buffer.concat([tx, ED25519, signature]).toString('base64'),
      };
    });
    nextSign = pending.then(() => {}, () => {});
    return pending;
  }

  return {
    publicKey,
    signActions,
    signer: Object.freeze({
      accountId,
      sign(call) {
        return signActions(call.contractId, [functionCall(call.method, call.args, call.gas, call.attachedDeposit)]);
      },
    }),
  };
}

function importValidatorKey(record) {
  // near-sandbox generates this development key as part of its private temporary home.
  const value = record.secret_key;
  assert(typeof value === 'string' && value.startsWith('ed25519:'), 'Expected a local Sandbox Ed25519 validator');
  const decoded = base58Decode(value.slice('ed25519:'.length), 64);
  const pkcs8 = Buffer.concat([ED25519_SEED_HEADER, decoded.subarray(0, 32)]);
  try {
    return createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  } finally {
    decoded.fill(0);
    pkcs8.fill(0);
  }
}
