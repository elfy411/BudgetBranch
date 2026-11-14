import assert from 'node:assert/strict';
import test from 'node:test';
import { nearToYocto } from '@budgetbranch/sdk';
import { assertConservation, runScriptedScenario } from '../dist/index.js';
import { decodeTransactionEvidence } from '../dist/evidence.js';
import { verifyDeployment } from '../dist/fixture.js';

const contractId = 'budget.test.near';
const signerId = 'child.test.near';
const receiverId = 'reject.test.near';
const blockHash = 'fixture-block';
const hexDigest = '00'.repeat(31) + '01';
const codeHash = '1'.repeat(31) + '2';
const unit = nearToYocto('1');

test('MOCK deployment proof checks finalized code reference and exact digest encodings', () => {
  const keys = { block_hash: blockHash, keys: [] };
  const account = { block_hash: blockHash, code_hash: codeHash };
  assert.deepEqual(verifyDeployment(contractId, hexDigest, account, keys), {
    accountId: contractId, reference: 'local', codeHash, wasmSha256: hexDigest, accessKeyCount: 0, blockHash,
  });
  assert.equal(verifyDeployment(contractId, hexDigest, {
    ...account, code_hash: '1'.repeat(32), global_contract_hash: codeHash,
  }, keys).reference, 'global-by-hash');
  assert.throws(() => verifyDeployment(contractId, codeHash, account, keys), /hex SHA-256/);
  assert.throws(() => verifyDeployment(contractId, hexDigest, {
    ...account, global_contract_account_id: 'publisher.test.near',
  }, keys), /mutable global code/);
  assert.throws(() => verifyDeployment(contractId, hexDigest, { ...account, code_hash: 'other' }, keys), /reviewed Wasm/);
  assert.throws(() => verifyDeployment(contractId, hexDigest, account, { ...keys, keys: [{}] }), /still has access keys/);
  assert.throws(() => verifyDeployment(contractId, hexDigest, account, { ...keys, last_key: 'next' }), /incomplete/);
  assert.throws(() => verifyDeployment(contractId, hexDigest, account, { ...keys, block_hash: 'different' }), /same block/);
});

function evidenceFixture() {
  const failure = { Failure: { ActionError: { kind: { FunctionCallError: { ExecutionError: 'Receiver rejected' } } } } };
  const success = { SuccessValue: '' };
  const outcome = (id, executor, status) => ({
    id, block_hash: `${id}-block`,
    outcome: { status, executor_id: executor, tokens_burnt: '1', logs: [] },
  });
  const receipt = (receipt_id, predecessor_id, receiver_id, signer_id, action) => ({
    receipt_id, predecessor_id, receiver_id, receipt: { Action: { signer_id, actions: [action] } },
  });
  const call = (method_name, deposit = '0') => ({
    FunctionCall: { method_name, deposit, args: Buffer.from('{"payment_id":"1"}').toString('base64') },
  });
  return {
    final_execution_status: 'FINAL',
    transaction: { hash: 'fixture-transaction', signer_id: signerId, receiver_id: contractId },
    transaction_outcome: { outcome: { tokens_burnt: '1', status: { SuccessReceiptId: 'start' } } },
    receipts_outcome: [
      outcome('start', contractId, success), outcome('receiver', receiverId, failure),
      outcome('callback', contractId, success), outcome('refund', contractId, success),
    ],
    receipts: [
      receipt('refund', 'system', contractId, 'system', { Transfer: { deposit: unit } }),
      receipt('callback', contractId, contractId, signerId, call('on_payment_result')),
      receipt('receiver', contractId, receiverId, signerId, call('receive_payment', unit)),
      receipt('start', signerId, contractId, signerId, call('spend')),
    ],
  };
}

const transaction = { transactionHash: 'fixture-transaction', signerId, contractId };

test('MOCK finalized receipt evidence preserves receiver failure, successful callback and actual refund action', () => {
  const tx = decodeTransactionEvidence(evidenceFixture(), transaction);
  assert.equal(tx.initial.status, 'succeeded');
  assert.equal(tx.initial.action.method, 'spend');
  assert.equal(tx.related[0].status, 'failed');
  assert.deepEqual(tx.related[0].action, { kind: 'function_call', method: 'receive_payment', amount: unit, paymentId: '1' });
  assert.equal(tx.related[1].status, 'succeeded');
  assert.deepEqual(tx.related[1].action, { kind: 'function_call', method: 'on_payment_result', amount: '0', paymentId: '1' });
  assert.equal(tx.related[2].status, 'succeeded');
  assert.equal(tx.related[2].predecessorId, 'system');
  assert.deepEqual(tx.related[2].action, { kind: 'transfer', amount: unit });
});

test('MOCK finalized receipt evidence rejects missing or premature receipts', () => {
  const fixture = evidenceFixture();
  assert.throws(() => decodeTransactionEvidence({ ...fixture, final_execution_status: 'EXECUTED' }, transaction),
    /must be finalized/);
  assert.throws(() => decodeTransactionEvidence({ ...fixture, receipts: fixture.receipts.slice(1) }, transaction),
    /Missing finalized action for receipt refund/);
  assert.throws(() => decodeTransactionEvidence(fixture, { ...transaction, signerId: receiverId }), /Transaction signer/);
});

function node(grant_id, parent_id, depth, amounts) {
  const [allocation, free, child_reserved, pending, spent, returned] = amounts.map(nearToYocto);
  return { grant_id, parent_id, depth, allocation, free, child_reserved, pending, spent, returned, delegatee_id: signerId };
}

test('unit conservation check detects double-counted reservations and root/child returns', () => {
  const grants = [
    node('0', null, 0, ['10', '0', '5', '0', '0', '5']),
    node('1', '0', 1, ['6', '0', '1', '0', '0', '5']),
    node('2', '0', 1, ['4', '3', '0', '0', '1', '0']),
    node('3', '1', 2, ['4', '0', '0', '0', '1', '3']),
  ];
  const snapshot = {
    grants,
    budget: {
      root_id: '0', owner_id: signerId, grant_count: 4, funded: nearToYocto('10'),
      free: nearToYocto('3'), pending: '0', spent: nearToYocto('2'), returned: nearToYocto('5'),
    },
  };
  assert.doesNotThrow(() => assertConservation(snapshot));
  assert.throws(() => assertConservation({
    ...snapshot, budget: { ...snapshot.budget, returned: nearToYocto('13') },
  }), /Global totals match local ledgers/);
  assert.throws(() => assertConservation({
    ...snapshot, grants: [{ ...grants[0], child_reserved: nearToYocto('6'), returned: nearToYocto('4') }, ...grants.slice(1)],
  }), /accounts for its direct children/);
});

test('MOCK scenario refuses to deposit against a previously used deployment', async () => {
  const owner = {
    accountId: signerId,
    client: {
      async get_snapshot() {
        return {
          budget: { root_id: '0', owner_id: signerId, grant_count: 1, funded: unit, free: unit, pending: '0', spent: '0', returned: '0' },
          grants: [node('0', null, 0, ['1', '1', '0', '0', '0', '0'])],
        };
      },
      async deposit() { assert.fail('Freshness checks must precede deposit'); },
    },
  };
  await assert.rejects(runScriptedScenario({
    mode: 'MOCK',
    callers: { owner },
    async receiver() { return {}; },
  }), error => error.code === 'ERR_ASSERTION' && error.actual[0] === unit);
});
