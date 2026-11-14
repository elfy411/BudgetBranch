import { strict as assert } from 'node:assert';
import {
  BudgetBranchError, nearToYocto, parseAmount, parseBudgetEvent, parseU64,
} from '@budgetbranch/sdk';
import type {
  AccountId, BudgetEvent, ChangeReceipt, DelegateArgs, ErrorCode, GrantId, GrantLedger, GrantView,
  PaymentResult, PaymentView, RequestIntent, SnapshotView, SpendArgs,
} from '@budgetbranch/sdk';
import type { ReceiptEvidence, TransactionEvidence } from './evidence.js';
import type { ReceiverReading, ScriptedCaller, ScriptedFixture } from './fixture.js';

type Totals = readonly [free: string, pending: string, spent: string, returned: string];
type Counts = readonly [grants: number, spends: number, refunds: number, normal: number, recovery: number];

export interface ScriptedStep {
  mode: ScriptedFixture['mode'];
  action: string;
  snapshot: SnapshotView;
  transactions: readonly TransactionEvidence[];
  receivers: { accepting: ReceiverReading; rejecting: ReceiverReading };
  rejection?: ErrorCode;
  payment?: { pendingSnapshot: SnapshotView; settled: PaymentView };
}

const ZERO: Totals = ['0', '0', '0', '0'];
const FUNDED: Totals = ['10', '0', '0', '0'];

function grant(snapshot: SnapshotView, id: GrantId): GrantView {
  const found = snapshot.grants.find(grant => grant.grant_id === id);
  assert(found, `Grant ${id} must exist`);
  return found;
}

function checkGrant(snapshot: SnapshotView, id: GrantId, expected: Partial<GrantLedger>): void {
  const actual = grant(snapshot, id);
  for (const [field, near] of Object.entries(expected)) {
    assert.equal(actual[field as keyof GrantLedger], nearToYocto(near), `Grant ${id} ${field}`);
  }
}

export function assertConservation(snapshot: SnapshotView): void {
  const { budget, grants } = snapshot;
  const root = grant(snapshot, budget.root_id);
  const indexed = new Map(grants.map(node => [node.grant_id, node]));
  const childCommitments = new Map<GrantId, bigint>();
  assert.equal(indexed.size, grants.length, 'Grant IDs are unique');
  assert.equal(grants.length, budget.grant_count, 'Snapshot contains every grant');
  assert.equal(root.parent_id, null, 'Root has no parent');
  assert.equal(root.delegatee_id, budget.owner_id, 'Root belongs to the owner');
  let free = 0n;
  let pending = 0n;
  let spent = 0n;
  for (const node of grants) {
    const [allocation, localFree, childReserved, localPending, localSpent, returned] = [
      node.allocation, node.free, node.child_reserved, node.pending, node.spent, node.returned,
    ].map(parseAmount) as [bigint, bigint, bigint, bigint, bigint, bigint];
    assert.equal(allocation, localFree + childReserved + localPending + localSpent + returned,
      `Grant ${node.grant_id} conserves its allocation`);
    if (node.grant_id !== root.grant_id) {
      const parent = node.parent_id === null ? undefined : indexed.get(node.parent_id);
      assert(parent, `Grant ${node.grant_id} has a valid parent`);
      assert.equal(node.depth, parent.depth + 1, `Grant ${node.grant_id} has the correct depth`);
      childCommitments.set(parent.grant_id, (childCommitments.get(parent.grant_id) ?? 0n) + allocation - returned);
    }
    free += localFree;
    pending += localPending;
    spent += localSpent;
  }
  for (const node of grants) {
    assert.equal(parseAmount(node.child_reserved), childCommitments.get(node.grant_id) ?? 0n,
      `Grant ${node.grant_id} accounts for its direct children`);
  }
  const returned = parseAmount(root.returned);
  assert.equal(budget.funded, root.allocation, 'Root allocation matches funded principal');
  assert.equal(parseAmount(budget.funded), free + pending + spent + returned, 'Global funded principal is conserved');
  assert.deepEqual([budget.free, budget.pending, budget.spent, budget.returned],
    [free, pending, spent, returned].map(value => value.toString()), 'Global totals match local ledgers');
}

function checkSnapshot(snapshot: SnapshotView, totals: Totals, counts: Counts): void {
  assertConservation(snapshot);
  const budget = snapshot.budget;
  const [grants, spends, refunds, normal, recovery] = counts;
  assert.deepEqual([budget.free, budget.pending, budget.spent, budget.returned], totals.map(nearToYocto));
  assert.deepEqual([
    budget.grant_count, budget.spend_count, budget.owner_refund_count, budget.normal_request_count,
    budget.recovery_request_count, budget.payment_count, budget.request_count, snapshot.payments.length,
  ], [grants, spends, refunds, normal, recovery, spends + refunds, normal + recovery, spends + refunds]);
}

function events(receipt: ReceiptEvidence): BudgetEvent[] {
  return receipt.logs.map(parseBudgetEvent).filter(event => event !== null);
}

function checkEvents(tx: TransactionEvidence, expected: readonly BudgetEvent['event'][]): BudgetEvent[] {
  const result = [tx.initial, ...tx.related].flatMap(events);
  assert.deepEqual(result.map(event => event.event), expected, 'BudgetBranch event names and counts');
  return result;
}

function onlyReceipt(tx: TransactionEvidence, filter: (receipt: ReceiptEvidence) => boolean, label: string): ReceiptEvidence {
  const matches = tx.related.filter(filter);
  assert.equal(matches.length, 1, `Expected exactly one ${label} receipt`);
  return matches[0]!;
}

function checkReceiver(
  before: ReceiverReading, after: ReceiverReading, principal: string, allowedGasReward: bigint,
): void {
  assert.equal(after.state.admin_id, before.state.admin_id, 'Receiver admin');
  assert.equal(after.state.budgetbranch_id, before.state.budgetbranch_id, 'Receiver contract binding');
  assert.equal(after.state.accepting, before.state.accepting, 'Receiver acceptance mode');
  const expected = parseAmount(nearToYocto(principal));
  assert.equal(parseAmount(after.state.received) - parseAmount(before.state.received), expected,
    'Receiver recorded exactly the accepted principal');
  const balanceChange = parseAmount(after.balance) - parseAmount(before.balance);
  assert(balanceChange >= expected && balanceChange <= expected + allowedGasReward,
    'Receiver balance reflects principal plus at most the observed receipt fee');
}

export async function runScriptedScenario(
  fixture: ScriptedFixture,
  report: (step: ScriptedStep) => void = () => {},
): Promise<SnapshotView> {
  const { owner, agentA, agentB, child } = fixture.callers;
  const view = owner.client;
  const { acceptingReceiver, rejectingReceiver, stranger } = fixture;
  const allowlist = [acceptingReceiver, rejectingReceiver].sort();

  async function readReceivers() {
    const [accepting, rejecting] = await Promise.all([
      fixture.receiver(acceptingReceiver), fixture.receiver(rejectingReceiver),
    ]);
    return { accepting, rejecting };
  }

  let snapshot = await view.get_snapshot();
  checkSnapshot(snapshot, ZERO, [1, 0, 0, 0, 0]);
  let receivers = await readReceivers();
  let budgetBalance = parseAmount(await fixture.balance(fixture.contractId));
  assert.equal(snapshot.budget.owner_id, owner.accountId);
  const root = grant(snapshot, '0');
  assert.equal(root.effective_status, 'active');
  assert.equal(root.max_depth, 3);
  assert(parseU64(root.expires_at_ns) > parseU64(snapshot.block_timestamp_ns), 'Root has time remaining');
  assert.deepEqual(root.allowed_receivers, allowlist, 'Root allows exactly the reviewed receivers');
  assert.equal(receivers.accepting.state.accepting, true);
  assert.equal(receivers.rejecting.state.accepting, false);
  assert.equal(receivers.accepting.state.received, '0');
  assert.equal(receivers.rejecting.state.received, '0');
  const operations = snapshot.budget.operational_funding;
  report({ mode: fixture.mode, action: 'Check the fresh fixture', snapshot, receivers, transactions: [] });

  async function step(
    action: string, totals: Totals, counts: Counts, tx: TransactionEvidence,
    verify: (next: SnapshotView) => void | Promise<void> = () => {},
    outcome: Pick<ScriptedStep, 'rejection' | 'payment'> = {},
    receiverEffect?: { target: 'accepting' | 'rejecting'; principal: string; gasRewardMax: bigint },
    budgetChange = 0n,
  ): Promise<void> {
    const next = await view.get_snapshot();
    checkSnapshot(next, totals, counts);
    assert.equal(next.budget.funded, nearToYocto('10'), 'Business principal remains 10 NEAR');
    assert.equal(next.budget.operational_funding, operations, 'Business principal did not fund operations');
    assert(parseAmount(next.budget.physical_liquid) >= parseAmount(next.budget.free),
      'After finalized receipts, physical liquidity covers the remaining free budget');
    await verify(next);
    const readings = await readReceivers();
    for (const target of ['accepting', 'rejecting'] as const) {
      const effect = receiverEffect?.target === target ? receiverEffect : undefined;
      checkReceiver(receivers[target], readings[target], effect?.principal ?? '0', effect?.gasRewardMax ?? 0n);
    }
    const balance = parseAmount(await fixture.balance(fixture.contractId));
    const contractFee = [tx.initial, ...tx.related].reduce((sum, receipt) => (
      receipt.executorId === fixture.contractId ? sum + parseAmount(receipt.tokensBurnt) : sum
    ), 0n);
    const change = balance - budgetBalance;
    assert(change >= budgetChange && change <= budgetChange + contractFee,
      'BudgetBranch balance reflects principal plus at most the observed receipt fees');
    snapshot = next;
    receivers = readings;
    budgetBalance = balance;
    report({ mode: fixture.mode, action, snapshot, receivers, transactions: [tx], ...outcome });
  }

  async function accepted(
    caller: ScriptedCaller, receipt: ChangeReceipt<unknown>, method: string, deposit = '0',
  ): Promise<TransactionEvidence> {
    const tx = await fixture.transaction(receipt.transactionHash, caller.accountId);
    assert.equal(tx.initial.status, 'succeeded', `${method} initiating receipt succeeded`);
    assert.equal(tx.initial.returnedPromise, false, `${method} returned its own result`);
    assert.deepEqual(tx.initial.action, {
      kind: 'function_call', method, amount: nearToYocto(deposit), paymentId: null,
    });
    return tx;
  }

  async function requestMatches(caller: ScriptedCaller, intent: RequestIntent, result: unknown): Promise<void> {
    const resolution = await view.resolveRequest(caller.accountId, intent);
    assert.equal(resolution.status, 'matched', 'Finalized request fingerprint matches the intent');
    assert.deepEqual(resolution.request?.result, result, 'Request result identifies the accepted effect');
  }

  async function reject(
    caller: ScriptedCaller, call: () => Promise<unknown>, intent: RequestIntent, code: ErrorCode,
    action: string, totals: Totals, counts: Counts,
  ): Promise<void> {
    const before = snapshot;
    let hash: string | null = null;
    await assert.rejects(call, error => {
      if (!(error instanceof BudgetBranchError)) return false;
      hash = error.transaction_hash;
      return error.kind === 'contract' && error.code === code && !!hash;
    });
    assert(hash, 'Rejected call must have a transaction hash');
    const tx = await fixture.transaction(hash, caller.accountId);
    assert.deepEqual(tx.initial.action, {
      kind: 'function_call', method: intent.method, amount: '0', paymentId: null,
    });
    assert.equal(tx.initial.status, 'failed');
    assert.equal(tx.initial.errorCode, code);
    assert.equal(tx.related.some(receipt => receipt.predecessorId !== 'system'), false, 'Rejection scheduled no work');
    checkEvents(tx, []);
    assert.equal(await view.get_request({
      caller_id: caller.accountId, request_id: intent.args.request_id,
    }), null, 'Rejected call consumed no request ID');
    await step(action, totals, counts, tx, next => {
      assert.deepEqual(next.grants, before.grants, 'Rejected call leaves every raw grant unchanged');
      assert.deepEqual(next.payments, before.payments, 'Rejected call creates no payment');
    }, { rejection: code });
  }

  const deposit = await owner.client.deposit({}, { attachedDeposit: nearToYocto('10') });
  const depositTx = await accepted(owner, deposit, 'deposit', '10');
  assert.deepEqual(checkEvents(depositTx, ['budget_deposited'])[0]?.data[0], {
    owner_id: owner.accountId, amount: nearToYocto('10'), funded: nearToYocto('10'),
  });
  await step('Owner deposits 10 NEAR', FUNDED, [1, 0, 0, 0, 0], depositTx, next => {
    checkGrant(next, '0', { allocation: '10', free: '10', child_reserved: '0' });
  }, {}, undefined, parseAmount(nearToYocto('10')));

  function delegateArgs(
    parent: GrantId, account: AccountId, amount: string, requestId: string, receivers = allowlist,
  ): DelegateArgs {
    return {
      parent_id: parent, delegatee_id: account, amount: nearToYocto(amount), request_id: requestId,
      allowed_receivers: receivers, expires_at_ns: root.expires_at_ns, max_depth: root.max_depth,
    };
  }

  async function delegate(
    caller: ScriptedCaller, args: DelegateArgs, action: string, counts: Counts,
    verifyParent: (next: SnapshotView) => void,
  ): Promise<GrantId> {
    const receipt = await caller.client.delegate(args);
    const tx = await accepted(caller, receipt, 'delegate');
    const [event] = checkEvents(tx, ['grant_created']);
    await requestMatches(caller, { method: 'delegate', args }, receipt.result);
    const id = receipt.result.grant_id;
    await step(action, FUNDED, counts, tx, next => {
      const node = grant(next, id);
      assert.equal(node.parent_id, args.parent_id);
      assert.equal(node.delegatee_id, args.delegatee_id);
      assert.deepEqual(node.allowed_receivers, args.allowed_receivers);
      assert.equal(node.expires_at_ns, args.expires_at_ns);
      assert.equal(node.max_depth, args.max_depth);
      assert.equal(node.effective_status, 'active');
      assert.equal(node.allocation, args.amount);
      assert.equal(node.free, args.amount);
      checkGrant(next, id, { child_reserved: '0', pending: '0', spent: '0', returned: '0' });
      assert.deepEqual(event?.data[0], { caller_id: caller.accountId, request_id: args.request_id, grant: node });
      verifyParent(next);
    });
    return id;
  }

  const grantA = await delegate(owner, delegateArgs('0', agentA.accountId, '6', 'demo-root-a'),
    'Owner delegates 6 NEAR to A', [2, 0, 0, 1, 0], next => checkGrant(next, '0', { free: '4', child_reserved: '6' }));
  const grantB = await delegate(owner, delegateArgs('0', agentB.accountId, '4', 'demo-root-b', [acceptingReceiver]),
    'Owner delegates 4 NEAR to B', [3, 0, 0, 2, 0], next => checkGrant(next, '0', { free: '0', child_reserved: '10' }));
  const childGrant = await delegate(agentA, delegateArgs(grantA, child.accountId, '4', 'demo-a-child'),
    'A delegates 4 NEAR to its child', [4, 0, 0, 3, 0], next => checkGrant(next, grantA, { free: '2', child_reserved: '4' }));

  const overspend = delegateArgs(grantA, stranger, '4', 'demo-a-overallocate');
  await reject(agentA, () => agentA.client.delegate(overspend), { method: 'delegate', args: overspend },
    'ERR_INSUFFICIENT_FREE', 'A cannot delegate a second 4 NEAR', FUNDED, [4, 0, 0, 3, 0]);

  function spendArgs(grantId: GrantId, receiverId: AccountId, requestId: string): SpendArgs {
    return { grant_id: grantId, receiver_id: receiverId, request_id: requestId, amount: nearToYocto('1') };
  }

  async function payment(config: {
    caller: ScriptedCaller;
    receipt: ChangeReceipt<PaymentResult>;
    intent: Extract<RequestIntent, { method: 'spend' | 'refund_owner' }>;
    action: string;
    pending: Totals;
    settled: Totals;
    counts: Counts;
    verify: (next: SnapshotView) => void | Promise<void>;
  }): Promise<void> {
    const { caller, receipt, intent, action, counts } = config;
    const before = snapshot;
    const tx = await accepted(caller, receipt, intent.method);
    const id = receipt.result.payment_id;
    await requestMatches(caller, intent, receipt.result);
    const expectedKind = intent.method === 'spend' ? 'spend' : 'owner_refund';
    const source = intent.method === 'spend' ? intent.args.grant_id : '0';
    const receiver = intent.method === 'spend' ? intent.args.receiver_id : owner.accountId;
    const rejected = receiver === rejectingReceiver;
    const terminal = rejected ? 'failed' : 'succeeded';
    const [pendingEvent, settledEvent] = checkEvents(tx, ['payment_pending', rejected ? 'payment_failed' : 'payment_succeeded']);
    assert.equal(events(tx.initial).length, 1, 'The initiating receipt logs the pending payment');

    const callback = onlyReceipt(tx, receipt => receipt.action.kind === 'function_call'
      && receipt.action.method === 'on_payment_result', 'callback');
    assert.equal(callback.predecessorId, fixture.contractId);
    assert.equal(callback.executorId, fixture.contractId);
    assert.equal(callback.status, 'succeeded');
    assert.equal(callback.returnedPromise, false);
    assert.deepEqual(callback.action, { kind: 'function_call', method: 'on_payment_result', amount: '0', paymentId: id });
    assert.deepEqual(events(callback), [settledEvent], 'Settlement event comes from the callback receipt');

    const transfer = onlyReceipt(tx, receipt => receipt.predecessorId === fixture.contractId
      && receipt.executorId === receiver, 'payment delivery');
    const expectedAction = intent.method === 'spend'
      ? { kind: 'function_call', method: 'receive_payment', amount: intent.args.amount, paymentId: id }
      : { kind: 'transfer', amount: intent.args.amount };
    assert.deepEqual(transfer.action, expectedAction);
    assert.equal(transfer.status, terminal);
    assert.equal(transfer.returnedPromise, false, 'The reviewed receiver completes synchronously');

    if (rejected) {
      const refund = onlyReceipt(tx, receipt => receipt.predecessorId === 'system' && receipt.signerId === 'system'
        && receipt.executorId === fixture.contractId && receipt.action.kind === 'transfer'
        && receipt.action.amount === intent.args.amount, 'failed deposit refund');
      assert.equal(refund.status, 'succeeded', 'The original attached deposit returned in a finalized receipt');
    }

    const pendingSnapshot = await fixture.snapshotAt(tx.initial.blockHash);
    checkSnapshot(pendingSnapshot, config.pending, counts);
    const pending = pendingSnapshot.payments.find(entry => entry.payment_id === id);
    assert(pending, 'Pending payment exists in the initiating receipt block');
    assert.deepEqual(pendingEvent?.data[0], pending, 'Pending event matches the historical contract view');
    assert.deepEqual(pending, {
      payment_id: id, kind: expectedKind, grant_id: source, caller_id: caller.accountId,
      request_id: intent.args.request_id, receiver_id: receiver, amount: intent.args.amount,
      status: 'pending', failure_code: null, created_at_ns: pending.created_at_ns, settled_at_ns: null,
    });
    assert.equal(parseAmount(grant(pendingSnapshot, source).pending), parseAmount(intent.args.amount),
      'The source grant reserves the payment in the initiating receipt block');

    const settled = await view.get_payment({ payment_id: id });
    assert(settled, 'Finalized payment view');
    assert(settled.settled_at_ns !== null, 'Callback records the settlement timestamp');
    assert.deepEqual(settled, {
      ...pending, status: terminal, failure_code: rejected ? 'ERR_RECEIVER_FAILED' : null,
      settled_at_ns: settled.settled_at_ns,
    });
    assert.deepEqual(settledEvent?.data[0], settled, 'Settlement event matches the authoritative contract view');

    await step(action, config.settled, counts, tx, async next => {
      assert.deepEqual(next.payments.find(entry => entry.payment_id === id), settled);
      if (rejected) {
        const previous = parseAmount(before.budget.physical_liquid);
        assert(parseAmount(next.budget.physical_liquid) >= previous, 'Physical liquidity restored after the finalized deposit refund');
      }
      await config.verify(next);
    }, { payment: { pendingSnapshot, settled } }, intent.method === 'spend' ? {
      target: rejected ? 'rejecting' : 'accepting',
      principal: rejected ? '0' : '1',
      gasRewardMax: parseAmount(transfer.tokensBurnt),
    } : undefined, rejected ? 0n : -parseAmount(intent.args.amount));
  }

  const approved = spendArgs(childGrant, acceptingReceiver, 'demo-child-accept');
  const approvedReceipt = await child.client.spend(approved);
  await payment({
    caller: child, receipt: approvedReceipt, intent: { method: 'spend', args: approved },
    action: 'Child pays the accepting receiver 1 NEAR', pending: ['9', '1', '0', '0'],
    settled: ['9', '0', '1', '0'], counts: [4, 1, 0, 4, 0],
    verify: next => checkGrant(next, childGrant, { free: '3', spent: '1', pending: '0' }),
  });

  const forbidden = spendArgs(childGrant, stranger, 'demo-child-stranger');
  await reject(child, () => child.client.spend(forbidden), { method: 'spend', args: forbidden },
    'ERR_RECIPIENT', 'Child cannot pay an unlisted recipient', ['9', '0', '1', '0'], [4, 1, 0, 4, 0]);

  const failed = spendArgs(childGrant, rejectingReceiver, 'demo-child-reject');
  await payment({
    caller: child, receipt: await child.client.spend(failed), intent: { method: 'spend', args: failed },
    action: 'Receiver rejects the child payment and the deposit returns', pending: ['8', '1', '1', '0'],
    settled: ['9', '0', '1', '0'], counts: [4, 2, 0, 5, 0],
    verify: next => checkGrant(next, childGrant, { free: '3', spent: '1', pending: '0' }),
  });

  const beforeRevoke = snapshot;
  const revokeReceipt = await owner.client.revoke({ grant_id: grantA });
  const revokeTx = await accepted(owner, revokeReceipt, 'revoke');
  assert.deepEqual(checkEvents(revokeTx, ['grant_revoked'])[0]?.data[0], { caller_id: owner.accountId, grant_id: grantA });
  const revokedTotals: Totals = ['9', '0', '1', '0'];
  const revokedCounts: Counts = [4, 2, 0, 5, 0];
  await step('Owner revokes A and blocks its child', revokedTotals, revokedCounts, revokeTx, next => {
    assert.deepEqual(next.payments, beforeRevoke.payments, 'Revocation leaves prior payments intact');
    assert.deepEqual(next.grants, beforeRevoke.grants.map(node => {
      if (node.grant_id === grantA || node.grant_id === childGrant) {
        return { ...node, revoked: node.grant_id === grantA, effective_status: 'revoked', blocked_by: grantA };
      }
      return node;
    }));
  });

  for (const [caller, id, name] of [[agentA, grantA, 'A'], [child, childGrant, 'child']] as const) {
    const blockedSpend = spendArgs(id, acceptingReceiver, `demo-${name}-blocked-spend`);
    await reject(caller, () => caller.client.spend(blockedSpend), { method: 'spend', args: blockedSpend },
      'ERR_REVOKED', `Revoked branch blocks new spending by ${name}`, revokedTotals, revokedCounts);
    const blockedDelegate = delegateArgs(id, stranger, '1', `demo-${name}-blocked-delegate`);
    await reject(caller, () => caller.client.delegate(blockedDelegate), { method: 'delegate', args: blockedDelegate },
      'ERR_REVOKED', `Revoked branch blocks new delegation by ${name}`, revokedTotals, revokedCounts);
  }

  const replay = await child.client.spend(approved);
  assert.deepEqual(replay.result, approvedReceipt.result, 'Retry after revocation returns the original payment ID');
  const replayTx = await accepted(child, replay, 'spend');
  checkEvents(replayTx, []);
  assert.equal(replayTx.related.some(receipt => receipt.predecessorId !== 'system'), false, 'Replay schedules no work');
  await step('Child retries the original request after revocation', revokedTotals, revokedCounts, replayTx);

  const sibling = spendArgs(grantB, acceptingReceiver, 'demo-b-accept');
  await payment({
    caller: agentB, receipt: await agentB.client.spend(sibling), intent: { method: 'spend', args: sibling },
    action: 'B still pays the accepting receiver 1 NEAR', pending: ['8', '1', '1', '0'],
    settled: ['8', '0', '2', '0'], counts: [4, 3, 0, 6, 0],
    verify: next => {
      assert.equal(grant(next, grantB).effective_status, 'active');
      checkGrant(next, grantB, { free: '3', spent: '1', pending: '0' });
    },
  });

  async function reclaim(id: GrantId, principal: string, requestId: string, counts: Counts, verify: (next: SnapshotView) => void) {
    const args = { grant_id: id, amount: nearToYocto(principal), request_id: requestId };
    const parentId = grant(snapshot, id).parent_id;
    const receipt = await owner.client.reclaim(args);
    const tx = await accepted(owner, receipt, 'reclaim');
    assert.deepEqual(receipt.result, { grant_id: id, amount: args.amount });
    await requestMatches(owner, { method: 'reclaim', args }, receipt.result);
    assert.deepEqual(checkEvents(tx, ['grant_reclaimed'])[0]?.data[0], {
      caller_id: owner.accountId, request_id: requestId, grant_id: id, parent_id: parentId, amount: args.amount,
    });
    assert.equal(tx.related.some(receipt => receipt.predecessorId !== 'system'), false, 'Reclaim moves only logical principal');
    await step(`Owner reclaims ${principal} NEAR from grant ${id}`, ['8', '0', '2', '0'], counts, tx, verify);
  }

  await reclaim(childGrant, '3', 'demo-reclaim-child', [4, 3, 0, 6, 1], next => {
    checkGrant(next, childGrant, { free: '0', spent: '1', returned: '3' });
    checkGrant(next, grantA, { free: '5', child_reserved: '1', returned: '0' });
  });
  await reclaim(grantA, '5', 'demo-reclaim-a', [4, 3, 0, 6, 2], next => {
    checkGrant(next, grantA, { free: '0', child_reserved: '1', returned: '5' });
    checkGrant(next, '0', { free: '5', child_reserved: '5', returned: '0' });
  });

  const refund = { amount: nearToYocto('5'), request_id: 'demo-refund-owner' };
  const ownerBeforeRefund = parseAmount(await fixture.balance(owner.accountId));
  await payment({
    caller: owner, receipt: await owner.client.refund_owner(refund), intent: { method: 'refund_owner', args: refund },
    action: 'Owner receives the 5 NEAR native refund', pending: ['3', '5', '2', '0'],
    settled: ['3', '0', '2', '5'], counts: [4, 3, 1, 6, 3],
    verify: async next => {
      checkGrant(next, '0', { free: '0', child_reserved: '5', pending: '0', returned: '5' });
      const ownerIncrease = parseAmount(await fixture.balance(owner.accountId)) - ownerBeforeRefund;
      assert(ownerIncrease > 0n && ownerIncrease <= parseAmount(refund.amount),
        'Owner balance increased after the transfer, with signer fees paid separately');
    },
  });
  return snapshot;
}
