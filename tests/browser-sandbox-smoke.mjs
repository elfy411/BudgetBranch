import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const port = Number(process.env.BB_WEB_PORT ?? '5173');
assert(Number.isSafeInteger(port) && port >= 1024 && port <= 65535, 'Use the fixture BB_WEB_PORT');
const origin = `http://127.0.0.1:${port}`;
const url = `${origin}/?network=sandbox&contract=budget.test.near`;
const profile = await mkdtemp('/private/tmp/bb-chrome-');
const chrome = spawn(process.env.BB_CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless', '--disable-gpu', '--disable-background-networking', '--disable-default-apps',
  '--no-first-run', '--disable-component-update', '--disable-sync', '--no-default-browser-check',
  `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--window-size=1440,1000', 'about:blank',
], { stdio: 'ignore' });
const exited = new Promise(resolve => {
  chrome.once('error', () => resolve(null));
  chrome.once('exit', code => resolve(code));
});
let ws;
const log = value => console.log(JSON.stringify(value));

async function waitFor(check, label, deadlineMs = 30_000) {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    const result = await check();
    if (result) return result;
    await delay(150);
  }
  throw new Error(`Timed out: ${label}`);
}

try {
  const debugging = await waitFor(async () => {
    if (!chrome.pid || chrome.exitCode !== null || chrome.signalCode !== null) throw new Error('Chrome did not start');
    const raw = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '');
    return raw.split('\n')[0];
  }, 'isolated Chrome startup');
  const targets = await fetch(`http://127.0.0.1:${debugging}/json/list`).then(r => r.json());
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await once(ws, 'open');
  const requests = new Map();
  const exceptions = [];
  const version = await fetch(`http://127.0.0.1:${debugging}/json/version`).then(r => r.json());
  let seq = 0;
  ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.id) {
      const [resolve, reject] = requests.get(msg.id) ?? [];
      requests.delete(msg.id);
      if (msg.error) reject?.(new Error(msg.error.message));
      else resolve?.(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      exceptions.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    }
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    requests.set(id, [resolve, reject]);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const js = async (expression) => {
    const response = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error('DOM probe threw');
    return response.result.value;
  };
  const visible = text => waitFor(() => js(`document.body.innerText.includes(${JSON.stringify(text)})`), text);
  const source = () => js('document.body.innerText');
  const click = (scope, exact) => js(`(() => {
    const btn = [...document.querySelectorAll(${JSON.stringify(scope)})].find(b => b.textContent.trim() === ${JSON.stringify(exact)});
    if (!btn || btn.disabled) return false;
    btn.click(); return true;
  })()`);
  const grant = (account) => js(`(() => {
    const btn = [...document.querySelectorAll('.grant-row')].find(b => b.querySelector('strong')?.textContent === ${JSON.stringify(account)});
    if (!btn || btn.disabled) return false;
    btn.click(); return true;
  })()`);
  async function actor(role, account) {
    assert(await js(`(() => { const select = document.querySelector('.sandbox-actors select');
      if (!select || select.disabled) return false;
      select.value = ${JSON.stringify(role)};
      select.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`));
    await visible(`Signing as ${account}.`);
  }
  async function submit(action, fields, expected, rejected = false) {
    await waitFor(() => click('.owner-actions > .action-buttons button', action), `${action} is enabled`);
    assert(await js(`(() => {
      const form = document.querySelector('.action-form');
      if (!form) return false;
      for (const [name, value] of Object.entries(${JSON.stringify(fields)})) form.elements.namedItem(name).value = value;
      const submit = form.querySelector('button.button--primary');
      if (!submit || submit.disabled) return false;
      submit.click(); return true;
    })()`), `${action} submitted`);
    const receipt = await waitFor(() => js(`(() => {
      const entry = document.querySelector(${JSON.stringify(rejected ? '.action-failure[role=alert]' : '.action-receipt')});
      if (!entry?.innerText.includes(${JSON.stringify(expected)})) return null;
      return { message: entry.querySelector('p').innerText, tx: entry.querySelector('code')?.innerText };
    })()`), expected);
    assert.match(receipt.tx, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    log({ action, receipt });
    if (rejected) assert(await click('.action-form button', 'Close'));
  }

  await cdp('Runtime.enable');
  await cdp('Page.navigate', { url });
  await visible('Finalized block');
  await visible('Signing as owner.test.near.');
  assert(!(await source()).includes('MOCK · SCRIPTED'));
  assert.match(await js(`document.querySelector('.funded-amount').innerText`), /^0\s+NEAR$/,
    'Start the browser smoke on a fresh fixture');
  const chainId = await js('window.budgetBranchSigner.chainId');
  log({ mode: 'REAL NEAR SANDBOX', browser: version.Browser, url, chainId });

  const fixture = '/__budgetbranch_fixture';
  const headers = { 'Content-Type': 'application/json', 'Origin': origin };
  const foreign = await fetch(`${origin}${fixture}/session`, { method: 'POST', headers: { ...headers, Origin: 'https://foreign.invalid' }, body: '{}' });
  assert.equal(foreign.status, 403);
  const missingToken = await fetch(`${origin}${fixture}/change`, { method: 'POST', headers, body: '{}' });
  assert.equal(missingToken.status, 403);
  const noWriteProxy = await fetch(`${origin}/sandbox-rpc`, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: 'blocked', method: 'sandbox_patch_state', params: [] }) });
  assert.equal(noWriteProxy.status, 403);
  log({ boundary: { foreignOrigin: foreign.status, missingToken: missingToken.status, sandboxPatchViaReadProxy: noWriteProxy.status } });

  await submit('Fund budget', { amount: '10' }, 'Deposited 10 NEAR');
  await visible('10 NEAR');
  await submit('Delegate', { delegatee: 'agent-a.test.near', amount: '6' }, 'Grant #1 was created');
  await visible('agent-a.test.near');
  assert(await grant('owner.test.near'));
  await submit('Delegate', { delegatee: 'agent-b.test.near', amount: '4' }, 'Grant #2 was created');
  await visible('agent-b.test.near');
  await actor('agentA', 'agent-a.test.near');
  assert(await grant('agent-a.test.near'));
  await submit('Delegate', { delegatee: 'child.test.near', amount: '4' }, 'Grant #3 was created');
  await visible('child.test.near');
  await submit('Delegate', { delegatee: 'stranger.test.near', amount: '4' }, 'ERR_INSUFFICIENT_FREE', true);
  await actor('child', 'child.test.near');
  assert(await grant('child.test.near'));
  await submit('Spend', { receiver: 'stranger.test.near', amount: '1' }, 'ERR_RECIPIENT', true);
  await submit('Spend', { receiver: 'accept.test.near', amount: '1' }, 'Spend payment #1 was accepted');
  await visible('Succeeded');
  await submit('Spend', { receiver: 'reject.test.near', amount: '1' }, 'Spend payment #2 was accepted');
  await visible('ERR_RECEIVER_FAILED');
  await actor('owner', 'owner.test.near');
  assert(await grant('agent-a.test.near'));
  await submit('Revoke branch', {}, 'Revocation recorded for grant #1');
  assert(await grant('child.test.near'));
  await visible('Inherits revocation from grant #1.');
  await actor('child', 'child.test.near');
  assert(await js(`[...document.querySelectorAll('.owner-actions > .action-buttons button')].find(b => b.textContent==='Spend').disabled`));
  await actor('agentB', 'agent-b.test.near');
  assert(await grant('agent-b.test.near'));
  await submit('Spend', { receiver: 'accept.test.near', amount: '1' }, 'Spend payment #3 was accepted');
  await waitFor(() => js(`document.querySelector('.payment-list .payment-row')?.innerText.includes('Succeeded')`), 'B succeeded');
  await actor('owner', 'owner.test.near');
  assert(await grant('child.test.near'));
  await submit('Reclaim to parent', { amount: '3' }, 'Reclaimed 3 NEAR from grant #3');
  assert(await grant('agent-a.test.near'));
  await submit('Reclaim to parent', { amount: '5' }, 'Reclaimed 5 NEAR from grant #1');
  assert(await grant('owner.test.near'));
  await submit('Refund owner', { amount: '5' }, 'Refund payment #4 was accepted');
  await waitFor(() => js(`document.querySelector('.payment-list .payment-row')?.innerText.includes('Succeeded')`), 'owner native refund succeeded');
  const near = await js(`Object.fromEntries([...document.querySelectorAll('.budget-totals > div')].map(x=>[x.querySelector('dt').innerText,x.querySelector('dd').innerText]))`);
  assert.deepEqual(near, { 'Logical free': '3', Pending: '0', Spent: '2', Refunded: '5' });
  assert.deepEqual(exceptions, []);
  log({ result: 'PASS', mode: 'REAL NEAR SANDBOX browser and same-origin bridge', near });
} finally {
  ws?.close();
  chrome.kill('SIGTERM');
  const force = setTimeout(() => chrome.kill('SIGKILL'), 4000);
  force.unref();
  try { await exited; } finally { clearTimeout(force); }
  await rm(profile, { force: true, recursive: true });
}
