import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  BudgetBranchClient, BudgetBranchError, DEFAULT_GAS, ERROR_CODES, MAX_U128, MAX_U64,
  amountFromBigInt, canonicalRequest, checkSandboxRpc, createJsonRpcTransport, createNearRpcReader,
  createSandboxChange, decodeNearChangeReceipt, getContractErrorCode, isAccountId, nearToYocto,
  parseAmount, parseBudgetEvent, parseU64, requestFingerprint, u64FromBigInt, yoctoToNear,
} from '../dist/index.js';

const account = 'contract.test.near';
const signerId = 'alice.test.near';
const hash = '11111111111111111111111111111111';
const rpcUrl = 'http://127.0.0.1:3030';
const pending = {
  payment_id: '1', kind: 'spend', grant_id: '2', caller_id: signerId, request_id: 'pay-first',
  receiver_id: 'accept.test.near', amount: '1000000000000000000000000', status: 'pending',
  failure_code: null, created_at_ns: '18446744073709551613', settled_at_ns: null,
};
const spend = { grant_id: '2', receiver_id: 'accept.test.near', amount: pending.amount, request_id: pending.request_id };
const intent = { method: 'spend', args: spend };
const toBase64 = value => Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
const rpcResponse = (id, result) => Response.json({ jsonrpc: '2.0', id, result });
const classify = (kind, code = null, transactionHash = null) => error =>
  error instanceof BudgetBranchError && error.kind === kind && error.code === code
    && error.transaction_hash === transactionHash;

test('units preserve the last yoctoNEAR and the entire u64 range', () => {
  assert.equal(nearToYocto('0.000000000000000000000001'), '1');
  assert.equal(nearToYocto('10.000000000000000000000001'), '10000000000000000000000001');
  assert.equal(yoctoToNear(MAX_U128.toString()), '340282366920938.463463374607431768211455');
  assert.equal(nearToYocto(yoctoToNear(MAX_U128.toString())), MAX_U128.toString());
  assert.equal(parseAmount(amountFromBigInt(MAX_U128)), MAX_U128);
  assert.equal(parseU64(u64FromBigInt(MAX_U64)), MAX_U64);
});

test('invalid numeric formats and overflow fail at the boundary', () => {
  for (const value of ['', '+1', '-1', ' 1', '1\n', '01', '0x1', '1e6', '1.5', 1, '9'.repeat(200)]) {
    assert.throws(() => parseAmount(value), RangeError);
    assert.throws(() => parseU64(value), RangeError);
  }
  assert.throws(() => parseAmount((MAX_U128 + 1n).toString()), RangeError);
  assert.throws(() => nearToYocto('340282366920938.463463374607431768211456'), RangeError);
  assert.throws(() => nearToYocto('1.0000000000000000000000001'), RangeError);
  assert.throws(() => parseU64((MAX_U64 + 1n).toString()), RangeError);
  assert.throws(() => amountFromBigInt(10), RangeError);
});

test('account IDs use NEAR spelling and length limits', () => {
  for (const valid of ['aa', 'foo-bar.near', 'a_b.local', 'a'.repeat(64)]) assert.equal(isAccountId(valid), true);
  for (const invalid of ['a', '.bad', 'bad..id', 'bad-.id', 'CAPS', 'aa\n', 'a'.repeat(65)]) {
    assert.equal(isAccountId(invalid), false);
  }
});

const vectors = JSON.parse(await readFile(new URL('../fixtures/request-fingerprints.json', import.meta.url), 'utf8'));
for (const vector of vectors) {
  test(`shared canonical fingerprint vector for ${vector.method}`, async () => {
    const changedOrder = Object.fromEntries(Object.entries(vector.args).reverse());
    assert.equal(canonicalRequest({ method: vector.method, args: changedOrder }), vector.canonical);
    assert.equal(await requestFingerprint({
      method: vector.method, args: { ...changedOrder, request_id: 'a-different-id' },
    }), vector.sha256);
  });
}

test('fingerprint preserves validated allowlist order and refuses a noncanonical intent', () => {
  const [vector] = vectors;
  assert.throws(() => canonicalRequest({
    ...vector, args: { ...vector.args, allowed_receivers: [...vector.args.allowed_receivers].reverse() },
  }), classify('decode'));
  assert.throws(() => canonicalRequest({ ...intent, args: { ...spend, amount: '01' } }), classify('decode'));
});

test('error codes match the frozen union and exclude terminal payment failures', async () => {
  const abi = await readFile(new URL('../src/types.ts', import.meta.url), 'utf8');
  const union = abi.split('export type ErrorCode =')[1].split('export interface InitArgs')[0];
  assert.deepEqual(ERROR_CODES, [...union.matchAll(/"(ERR_[A-Z_]+)"/g)].map(match => match[1]));
  assert.equal(getContractErrorCode({ ActionError: { kind: { FunctionCallError: {
    ExecutionError: 'Smart contract panicked: BB:ERR_REVOKED',
  } } } }), 'ERR_REVOKED');
  for (const failure of ['ERR_REVOKED', 'BB:ERR_REVOKED_EXTRA', 'BB:ERR_RECEIVER_FAILED', 'BB:ERR_TRANSFER_FAILED']) {
    assert.equal(getContractErrorCode(failure), null);
  }
});

test('budget event decoder checks status and distinguishes other standards', () => {
  const log = (event, value) => `EVENT_JSON:${JSON.stringify({
    standard: 'budgetbranch', version: '0.1.0', event, data: [value],
  })}`;
  assert.equal(parseBudgetEvent('receiver text'), null);
  assert.equal(parseBudgetEvent('EVENT_JSON:{"standard":"demo_receiver"}'), null);
  assert.deepEqual(parseBudgetEvent(log('payment_pending', pending)).data, [pending]);
  const failed = { ...pending, status: 'failed', failure_code: 'ERR_RECEIVER_FAILED', settled_at_ns: '18446744073709551614' };
  assert.deepEqual(parseBudgetEvent(log('payment_failed', failed)).data, [failed]);
  assert.throws(() => parseBudgetEvent(log('payment_succeeded', pending)), classify('decode'));
  assert.throws(() => parseBudgetEvent(log('payment_failed', { ...failed, failure_code: 'ERR_TRANSFER_FAILED' })), classify('decode'));
  assert.throws(() => parseBudgetEvent(log('payment_pending', { ...pending, amount: 1 })), classify('decode'));
});

test('MOCK transport receives exact args, gas and deposit without payment inference', async () => {
  const calls = [];
  const client = new BudgetBranchClient(account, {
    async change(call) {
      calls.push(call);
      return { result: { payment_id: '1' }, transactionHash: hash, logs: [] };
    },
    async view(call) {
      calls.push(call);
      return pending;
    },
  });
  assert.equal('on_payment_result' in client, false);
  assert.deepEqual(await client.spend(spend), { result: { payment_id: '1' }, transactionHash: hash, logs: [] });
  assert.deepEqual(await client.get_payment({ payment_id: '1' }), pending);
  assert.deepEqual(calls, [
    { contractId: account, method: 'spend', args: spend, gas: DEFAULT_GAS.spend, attachedDeposit: '0' },
    { contractId: account, method: 'get_payment', args: { payment_id: '1' } },
  ]);
  await assert.rejects(client.spend(spend, { attachedDeposit: '1' }), classify('decode'));
  await assert.rejects(client.deposit({}, { attachedDeposit: '0' }), classify('decode'));
  assert.equal(calls.length, 2);
});

test('MOCK request resolution distinguishes missing, exact and conflicting IDs without writes', async () => {
  let record = null;
  const client = new BudgetBranchClient(account, {
    async view(call) {
      assert.deepEqual(call, { contractId: account, method: 'get_request', args: { caller_id: signerId, request_id: spend.request_id } });
      return record;
    },
  });
  assert.deepEqual(await client.resolveRequest(signerId, intent), { status: 'missing', request: null });
  record = {
    caller_id: signerId, request_id: spend.request_id, method: 'spend', result: { payment_id: '1' },
    fingerprint: await requestFingerprint(intent),
  };
  assert.deepEqual(await client.resolveRequest(signerId, intent), { status: 'matched', request: record });
  assert.deepEqual(await client.resolveRequest(signerId, { method: 'spend', args: { ...spend, amount: '9' } }),
    { status: 'conflict', request: record });
  await assert.rejects(client.spend(spend), classify('transaction'));
});

test('MOCK response decoding rejects unsafe amounts and retains the hash of an accepted write', async () => {
  const client = new BudgetBranchClient(account, {
    async view() { return { ...pending, amount: Number(pending.amount) }; },
    async change() { return { transactionHash: hash, result: { payment_id: 1 }, logs: [] }; },
  });
  await assert.rejects(client.get_payment({ payment_id: '1' }), classify('decode'));
  await assert.rejects(client.spend(spend), classify('decode', null, hash));
});

test('MOCK NEAR read uses finalized JSON-RPC and canonical base64 arguments', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    assert.equal(url, `${rpcUrl}/`);
    assert.equal(init.credentials, 'omit');
    assert.equal(init.redirect, 'error');
    assert(init.signal instanceof AbortSignal);
    const envelope = JSON.parse(init.body);
    calls.push(envelope);
    const result = Array.from(Buffer.from(JSON.stringify(pending), 'utf8'));
    return rpcResponse(envelope.id, { block_hash: hash, result });
  };
  const client = new BudgetBranchClient(account, createJsonRpcTransport({ rpcUrl, fetch }));
  assert.deepEqual(await client.get_payment({ payment_id: '1' }), pending);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'query');
  assert.deepEqual(calls[0].params, {
    request_type: 'call_function', finality: 'final', account_id: account, method_name: 'get_payment',
    args_base64: toBase64({ payment_id: '1' }),
  });
});

test('MOCK NEAR read distinguishes execution, RPC, decode and timeout errors', async () => {
  const cases = [
    [async (_url, { body }) => rpcResponse(JSON.parse(body).id, { error: 'panicked: BB:ERR_ARGUMENT' }), 'contract', 'ERR_ARGUMENT'],
    [async (_url, { body }) => Response.json({ jsonrpc: '2.0', id: JSON.parse(body).id, error: { message: 'node error' } }), 'rpc'],
    [async (_url, { body }) => rpcResponse(JSON.parse(body).id, { result: [255], block_hash: hash }), 'decode'],
    [async () => rpcResponse('wrong-id', { result: [] }), 'decode'],
    [async (_url, { signal }) => new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('test failed to receive abort')), 100);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
    }), 'timeout'],
  ];
  for (const [fetch, kind, code] of cases) {
    const client = new BudgetBranchClient(account, createJsonRpcTransport({ rpcUrl, fetch, timeoutMs: 5 }));
    await assert.rejects(client.get_snapshot(), classify(kind, code));
  }
});

function transaction(initialStatus, otherStatus = { SuccessValue: '' }) {
  return {
    transaction: { hash, signer_id: signerId, receiver_id: account },
    transaction_outcome: { outcome: { status: { SuccessReceiptId: 'initial' } } },
    receipts_outcome: [
      { id: 'callback', outcome: { status: otherStatus, logs: ['callback'], executor_id: account } },
      { id: 'initial', outcome: { status: initialStatus, logs: ['initial'], executor_id: account } },
    ],
    status: { Failure: 'Example untrusted top-level status' },
  };
}

test('MOCK write decoding follows the initiating receipt and ignores later failures', () => {
  const expected = { senderId: signerId, contractId: account };
  const result = decodeNearChangeReceipt(transaction({ SuccessValue: toBase64({ payment_id: '1' }) },
    { Failure: 'receiver panic' }), hash, expected);
  assert.deepEqual(result, { result: { payment_id: '1' }, transactionHash: hash, logs: ['callback', 'initial'] });
  assert.throws(() => decodeNearChangeReceipt(transaction({ Failure: 'panic: BB:ERR_REVOKED' }), hash, expected),
    classify('contract', 'ERR_REVOKED', hash));
  assert.throws(() => decodeNearChangeReceipt(transaction({ SuccessReceiptId: 'different-result' }), hash, expected),
    classify('decode', null, hash));
  assert.deepEqual(decodeNearChangeReceipt(transaction({ SuccessValue: '' }), hash, expected).result, null);
});

test('MOCK Sandbox adapter signs and broadcasts a funding intent once and retains an ambiguous hash', async () => {
  const rpcCalls = [];
  const signs = [];
  const fetch = async (_url, { body }) => {
    const request = JSON.parse(body);
    rpcCalls.push(request);
    if (request.method === 'status') return rpcResponse(request.id, { chain_id: 'test-chain-abc' });
    if (request.method === 'tx_status') return rpcResponse(request.id, { final_execution_status: 'FINAL' });
    throw new Error('Lost response after submission');
  };
  const signer = {
    accountId: signerId,
    async sign(call) {
      signs.push(call);
      return { transactionHash: hash, signedTransactionBase64: 'c2lnbmVk' };
    },
  };
  const options = { rpcUrl, fetch };
  const change = createSandboxChange({ ...options, signer });
  const client = new BudgetBranchClient(account, createJsonRpcTransport({ ...options, change }));
  await assert.rejects(client.deposit({}, { attachedDeposit: pending.amount }), classify('rpc', null, hash));
  assert.equal(signs.length, 1);
  assert.equal(signs[0].attachedDeposit, pending.amount);
  assert.deepEqual(rpcCalls.map(call => call.method), ['status', 'send_tx']);
  assert.deepEqual(rpcCalls[1].params, { signed_tx_base64: 'c2lnbmVk', wait_until: 'EXECUTED' });
  assert.deepEqual(await createNearRpcReader(options).getTransaction({ transactionHash: hash, senderId: signerId }),
    { final_execution_status: 'FINAL' });
  assert.deepEqual(rpcCalls[2].params, { tx_hash: hash, sender_account_id: signerId, wait_until: 'FINAL' });
});

test('MOCK Sandbox adapter refuses remote and mainnet identities before signing', async () => {
  assert.throws(() => createSandboxChange({ rpcUrl: 'https://test.rpc.fastnear.com', signer: { accountId: signerId } }),
    classify('rpc'));
  assert.throws(() => createJsonRpcTransport({ rpcUrl: 'https://rpc.mainnet.near.org' }), classify('rpc'));
  const fetch = async (_url, { body }) => rpcResponse(JSON.parse(body).id, { chain_id: 'mainnet' });
  await assert.rejects(checkSandboxRpc({ rpcUrl, fetch }), classify('rpc'));
  const change = createSandboxChange({
    rpcUrl, fetch, signer: { accountId: signerId, async sign() { assert.fail('Must check chain ID first'); } },
  });
  const client = new BudgetBranchClient(account, createJsonRpcTransport({ rpcUrl, fetch, change }));
  await assert.rejects(client.spend(spend), classify('rpc'));
});
