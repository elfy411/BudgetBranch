import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { DEFAULT_GAS, MAX_U64, nearToYocto } from '../sdk/dist/index.js';
import { createAccountActions, functionCall, lockContractActions, sandboxAccount } from './sandbox-transactions.mjs';

const SANDBOX_SHA256 = '8e0e1521372b0fce801b7464078c1e95e5a25a0f92ad4b4241451c33fe9e5a2a';
const SANDBOX_PROTOCOL = 88;
const SANDBOX_VERSION = '2.14.0';
const TIMEOUT_MS = 30_000;
const HOST = '127.0.0.1';
const root = fileURLToPath(new URL('../', import.meta.url));
const wasmDir = join(root, 'contracts/target/wasm32-unknown-unknown/release');
const noProcessOutput = { stdio: 'ignore', env: { TMPDIR: '/private/tmp', RUST_LOG: 'warn' } };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export class FixtureError extends Error {}

function watchProcess(child) {
  return new Promise(resolve => {
    child.once('exit', code => resolve(code));
    child.once('error', () => resolve(null));
  });
}

async function stopProcess(child, exited) {
  if (!child) return;
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 4000);
  timer.unref();
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}

async function listenForPort() {
  const server = createServer();
  server.listen(0, HOST);
  try {
    await once(server, 'listening');
  } catch (error) {
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      throw new FixtureError('Cannot bind Sandbox RPC on 127.0.0.1. Allow local loopback sockets and try again.');
    }
    throw error;
  }
  return { server, port: server.address().port };
}

async function reservePorts() {
  const rpc = await listenForPort();
  try {
    const network = await listenForPort();
    network.server.close();
    return { rpc: rpc.port, network: network.port };
  } finally {
    rpc.server.close();
  }
}

function localRpc(rpcUrl) {
  // Only the node this fixture starts is reachable through this helper. Scenario
  // methods use the public SDK transport; this codec is for setup and access-key nonces.
  let sequence = 0;
  return async (method, params, timeoutMs = TIMEOUT_MS) => {
    const id = `fixture-${++sequence}`;
    let envelope;
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST', headers: { 'content-type': 'application/json' }, redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs), body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      });
      if (!response.ok) throw new Error();
      envelope = await response.json();
    } catch {
      throw new FixtureError(`Sandbox RPC ${method} did not return a valid HTTP response`);
    }
    if (envelope.id !== id || envelope.jsonrpc !== '2.0' || !Object.hasOwn(envelope, 'result')) {
      const cause = envelope.error?.cause?.name;
      const label = typeof cause === 'string' && /^[A-Z_]{1,64}$/.test(cause) ? ` (${cause})` : '';
      throw new FixtureError(`Sandbox RPC ${method} failed${label}`);
    }
    return envelope.result;
  };
}

async function waitForRpc(request, chainId, child) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline && child.exitCode === null && child.signalCode === null) {
    const status = await request('status', [], 750).catch(() => null);
    if (status) {
      assert(status.chain_id === chainId, 'Unexpected local Sandbox chain identity');
      assert(status.protocol_version === SANDBOX_PROTOCOL, 'Unexpected Sandbox protocol');
      if (status.sync_info?.latest_block_height > 0) return;
    }
    await delay(150);
  }
  throw new FixtureError('Pinned Sandbox did not start producing blocks; check loopback socket permissions');
}

async function submitSetup(request, account, receiverId, actions, label) {
  const { transactionHash, signedTransactionBase64 } = await account.signActions(receiverId, actions);
  let outcome;
  try {
    outcome = await request('send_tx', { signed_tx_base64: signedTransactionBase64, wait_until: 'FINAL' });
  } catch (error) {
    throw new FixtureError(`${label} stopped after one submission (${transactionHash}): ${error.message}`);
  }
  assert(outcome.final_execution_status === 'FINAL', `${label} was not finalized (${transactionHash})`);
  assert(outcome.transaction?.hash === transactionHash
    && outcome.transaction?.signer_id === account.signer.accountId
    && outcome.transaction?.receiver_id === receiverId, `${label} has an unexpected transaction identity`);
  const id = outcome.transaction_outcome?.outcome?.status?.SuccessReceiptId;
  const receipt = outcome.receipts_outcome?.find(entry => entry.id === id);
  assert(receipt?.outcome?.executor_id === receiverId
    && typeof receipt.outcome.status?.SuccessValue === 'string', `${label} receipt failed (${transactionHash})`);
  return { transactionHash, receiptId: id, blockHash: receipt.block_hash, accountId: receiverId, action: label, finality: 'FINAL' };
}

async function readWasm(name) {
  const wasm = await readFile(join(wasmDir, name)).catch(() => {
    throw new FixtureError(`Missing ${name}; build both Wasm files from contracts/ first`);
  });
  assert(wasm.subarray(0, 4).equals(Buffer.from([0, 97, 115, 109])), `${name} is not Wasm`);
  return wasm;
}

export async function createFixtureOptions() {
  let stage = 'verify the pinned native binary and local Wasm';
  let home;
  let child;
  let exited;
  let cleanupPromise;
  function cleanup() {
    cleanupPromise ??= (async () => {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', interrupt);
      await stopProcess(child, exited);
      if (home) await rm(home, { recursive: true, force: true });
    })();
    return cleanupPromise;
  }
  function interrupt(signal) {
    void cleanup().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  }

  try {
    const binary = process.env.NEAR_SANDBOX_BIN_PATH ?? join(root, `.local/sandbox/${SANDBOX_VERSION}/near-sandbox`);
    const [binaryBytes, budgetWasm, receiverWasm, checkpoint] = await Promise.all([
      readFile(binary), readWasm('budgetbranch.wasm'), readWasm('demo_receiver.wasm'),
      readFile(new URL('./portable-wasm.json', import.meta.url), 'utf8').then(JSON.parse),
    ]);
    assert(sha256(binaryBytes) === SANDBOX_SHA256, 'Native Sandbox checksum does not match the Darwin ARM64 pin');
    await Promise.all(Object.entries(checkpoint.source_sha256).map(async ([path, expected]) => {
      assert(sha256(await readFile(join(root, 'contracts', path))) === expected, `Contract source differs from portable pin: ${path}`);
    }));
    const reviewedCodeHashes = {
      budgetbranch: checkpoint.wasm_sha256['budgetbranch.wasm'],
      receiver: checkpoint.wasm_sha256['demo_receiver.wasm'],
    };
    assert(sha256(budgetWasm) === reviewedCodeHashes.budgetbranch, 'BudgetBranch Wasm differs from the portable pin');
    assert(sha256(receiverWasm) === reviewedCodeHashes.receiver, 'Receiver Wasm differs from the portable pin');

    stage = 'initialize an isolated Sandbox';
    const chainId = `test-chain-bb${randomBytes(8).toString('hex')}`;
    home = await mkdtemp('/private/tmp/bb-near-');
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    child = spawn(binary, ['--home', home, 'init', '--fast', '--chain-id', chainId], noProcessOutput);
    exited = watchProcess(child);
    assert(await exited === 0, 'Sandbox init failed');
    const configPath = join(home, 'config.json');
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    config.network.boot_nodes = '';
    config.network.trusted_stun_servers = [];
    config.network.tier1.enable_inbound = false;
    config.network.tier1.enable_outbound = false;
    config.telemetry.endpoints = [];
    config.rpc.cors_allowed_origins = [];
    await writeFile(configPath, JSON.stringify(config));

    stage = 'start native Sandbox RPC on loopback';
    const ports = await reservePorts();
    const rpcUrl = `http://${HOST}:${ports.rpc}`;
    const request = localRpc(rpcUrl);
    child = spawn(binary, [
      '--home', home, 'run', '--rpc-addr', `${HOST}:${ports.rpc}`, '--network-addr', `${HOST}:${ports.network}`,
    ], noProcessOutput);
    exited = watchProcess(child);
    await waitForRpc(request, chainId, child);

    stage = 'provision disposable accounts and deploy locked Wasm';
    const validatorKey = JSON.parse(await readFile(join(home, 'validator_key.json'), 'utf8'));
    assert(validatorKey.account_id === 'test.near', 'Unexpected genesis funding account');
    const validator = sandboxAccount('test.near', request, validatorKey);
    delete validatorKey.secret_key;
    const [owner, agentA, agentB, childCaller, stranger, budget, accepting, rejecting] =
      ['owner', 'agent-a', 'agent-b', 'child', 'stranger', 'budget', 'accept', 'reject']
        .map(name => sandboxAccount(`${name}.test.near`, request));
    const contractId = budget.signer.accountId;
    const acceptingReceiver = accepting.signer.accountId;
    const rejectingReceiver = rejecting.signer.accountId;
    const deployFunding = '25'; // Covers storage and the separate recovery reserve; not business principal.
    const setup = [];
    for (const account of [owner, agentA, agentB, childCaller, stranger, budget, accepting, rejecting]) {
      const funds = account === budget ? deployFunding : account === owner ? '30' : '5';
      setup.push(await submitSetup(request, validator, account.signer.accountId,
        createAccountActions(account.publicKey, nearToYocto(funds)), 'create disposable account'));
    }
    const budgetInit = functionCall('new', {
      owner_id: owner.signer.accountId,
      allowed_receivers: [acceptingReceiver, rejectingReceiver].sort(),
      expires_at_ns: MAX_U64.toString(),
    }, DEFAULT_GAS.new);
    setup.push(await submitSetup(request, budget, contractId,
      lockContractActions(budgetWasm, budgetInit, budget.publicKey), 'deploy, initialize and lock BudgetBranch'));
    for (const receiver of [accepting, rejecting]) {
      const receiverInit = functionCall('new', { admin_id: owner.signer.accountId, budgetbranch_id: contractId }, DEFAULT_GAS.new);
      setup.push(await submitSetup(request, receiver, receiver.signer.accountId,
        lockContractActions(receiverWasm, receiverInit, receiver.publicKey), 'deploy, initialize and lock receiver'));
    }
    setup.push(await submitSetup(request, owner, rejectingReceiver,
      [functionCall('set_accepting', { accepting: false }, '30000000000000')], 'configure rejecting receiver'));

    return {
      options: {
        rpcUrl, contractId, reviewedCodeHashes, acceptingReceiver, rejectingReceiver,
        stranger: stranger.signer.accountId, callers: {
          owner: owner.signer, agentA: agentA.signer, agentB: agentB.signer, child: childCaller.signer,
        },
      },
      runtime: {
        version: SANDBOX_VERSION, protocol: SANDBOX_PROTOCOL, binarySha256: SANDBOX_SHA256, chainId,
        node: process.version, platform: `${process.platform}-${process.arch}`, contractSource: checkpoint.contract_source_commit,
      },
      setup,
      cleanup,
    };
  } catch (error) {
    await cleanup();
    if (error instanceof FixtureError) throw error;
    const detail = error instanceof assert.AssertionError ? error.message : '';
    throw new FixtureError(`Could not ${stage}${detail ? `: ${detail}` : ''}`);
  }
}
