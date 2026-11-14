import { createRequire } from 'node:module';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSandboxFixture } from '../agents/dist/index.js';
import { BudgetBranchError, DEFAULT_GAS, nearToYocto, parseAmount } from '../sdk/dist/index.js';
import { createFixtureOptions, FixtureError } from '../tests/sandbox-fixture.mjs';

const methods = new Set(['deposit', 'delegate', 'spend', 'revoke', 'reclaim', 'refund_owner']);
const prefix = '/__budgetbranch_fixture';
const moduleId = 'virtual:budgetbranch-fixture-signer';
const resolvedModule = `\0${moduleId}`;
const webRoot = fileURLToPath(new URL('../web/', import.meta.url));
const host = '127.0.0.1';
const portArgument = process.env.BB_WEB_PORT ?? '5173';
const port = Number(portArgument);
const origin = `http://${host}:${port}`;

function json(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Cross-Origin-Resource-Policy': 'same-origin', 'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

function problem(response, status, message) {
  json(response, status, { error: { kind: 'transaction', message } });
}

async function readJson(request) {
  const limit = 4096;
  const length = Number(request.headers['content-length']);
  if (!Number.isSafeInteger(length) || length < 2 || length > limit) throw new Error();
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error();
    chunks.push(chunk);
  }
  if (size !== length) throw new Error();
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function signerPlugin(fixture, clientCode) {
  const token = randomBytes(32).toString('base64url');
  const actors = Object.fromEntries(Object.entries(fixture.callers).map(([role, caller]) => [role, caller.accountId]));
  let busy = false;
  let fundingUnresolved = false;

  async function handle(request, response) {
    if (request.headers.host !== `${host}:${port}` || request.headers.origin !== origin
      || request.method !== 'POST' || request.headers['content-type'] !== 'application/json') {
      problem(response, 403, 'The fixture accepts only local same-origin JSON requests');
      return;
    }
    const route = request.url;
    if (route !== '/session' && route !== '/change') return problem(response, 404, 'Unknown fixture route');
    if (route === '/change') {
      const actual = request.headers['x-budgetbranch-fixture'];
      if (typeof actual !== 'string' || actual.length !== token.length || Buffer.byteLength(actual) !== token.length
        || !timingSafeEqual(Buffer.from(actual), Buffer.from(token))) {
        return problem(response, 403, 'Reload the fixture to connect its local signer');
      }
    }
    let input;
    try { input = await readJson(request); }
    catch { return problem(response, 400, 'Invalid fixture request'); }
    if (route === '/session') {
      return json(response, 200, { result: { chainId: fixture.chainId, contractId: fixture.contractId, actors, token } });
    }

    const { role, call } = input ?? {};
    if (typeof role !== 'string' || !Object.hasOwn(fixture.callers, role) || call?.contractId !== fixture.contractId
      || !methods.has(call.method) || call.gas !== DEFAULT_GAS[call.method]) {
      return problem(response, 400, 'Unsupported local fixture call');
    }
    const funding = call.method === 'deposit';
    try {
      const deposit = parseAmount(call.attachedDeposit);
      if (funding ? role !== 'owner' || deposit === 0n || deposit > parseAmount(nearToYocto('10')) : deposit !== 0n) {
        return problem(response, 400, 'Only the fixture owner may attach a test deposit of up to 10 NEAR');
      }
    } catch {
      return problem(response, 400, 'Invalid attached deposit');
    }
    if (funding && fundingUnresolved) {
      return problem(response, 409, 'A prior deposit is unresolved. Verify its transaction before restarting the fixture');
    }
    if (busy) return problem(response, 409, 'Wait for the current Sandbox transaction');
    busy = true;
    try {
      // Reuse the verified agents fixture's SDK clients. They validate the ABI,
      // sign for this specific role, and broadcast exactly once to loopback.
      const result = await fixture.callers[role].client[call.method](call.args, {
        attachedDeposit: call.attachedDeposit, gas: call.gas,
      });
      json(response, 200, { result });
    } catch (error) {
      if (error instanceof BudgetBranchError) {
        if (funding && error.kind !== 'contract' && (error.transaction_hash || error.kind !== 'decode')) {
          fundingUnresolved = true;
        }
        json(response, 422, { error: {
          kind: error.kind, code: error.code, message: error.message, transactionHash: error.transaction_hash,
        } });
      } else {
        if (funding) fundingUnresolved = true;
        problem(response, 500, 'The local signer did not confirm the transaction');
      }
    } finally {
      busy = false;
    }
  }

  return {
    name: 'budgetbranch-local-fixture-signer',
    configureServer(server) {
      server.middlewares.use(prefix, (request, response) => {
        void handle(request, response).catch(() => {
          if (!response.headersSent) problem(response, 500, 'The fixture could not handle this request');
          else response.end();
        });
      });
    },
    resolveId(id) { if (id === moduleId) return resolvedModule; },
    load(id) { if (id === resolvedModule) return clientCode; },
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [
          { tag: 'script', attrs: { type: 'module' }, children: `import '${moduleId}';`, injectTo: 'body' },
          { tag: 'style', children: '.sandbox-actors{padding:.55rem 1rem;background:#e7eee1;font:14px system-ui,sans-serif}.sandbox-actors select{font:inherit}', injectTo: 'head' },
        ];
      },
    },
  };
}

async function main() {
  if (!/^[0-9]{4,5}$/.test(portArgument) || port < 1024 || port > 65535) {
    throw new FixtureError('Set BB_WEB_PORT to a decimal integer from 1024 through 65535.');
  }
  const resolve = createRequire(new URL('../web/package.json', import.meta.url)).resolve;
  const [{ createServer }, clientCode] = await Promise.all([
    import(pathToFileURL(resolve('vite')).href), readFile(new URL('./sandbox-browser-signer.mjs', import.meta.url), 'utf8'),
  ]);
  const { options, cleanup } = await createFixtureOptions();
  let server;
  try {
    const fixture = await createSandboxFixture(options);
    process.env.BB_SANDBOX_PORT = new URL(options.rpcUrl).port;
    server = await createServer({
      root: webRoot, configFile: fileURLToPath(new URL('../web/vite.config.mjs', import.meta.url)),
      clearScreen: false,
      server: {
        host, port, strictPort: true, cors: false, hmr: false,
        fs: { allow: [webRoot] },
        headers: { 'Content-Security-Policy': "frame-ancestors 'none'", 'X-Frame-Options': 'DENY' },
      },
      plugins: [signerPlugin(fixture, clientCode)],
    });
    try {
      await server.listen();
    } catch (error) {
      if (error.code === 'EADDRINUSE' || error.message === `Port ${port} is already in use`) {
        throw new FixtureError(`Port ${port} is already in use. Set BB_WEB_PORT to a free loopback port.`);
      }
      throw error;
    }
    const page = `${origin}/?network=sandbox&contract=${encodeURIComponent(fixture.contractId)}`;
    console.log(`REAL NEAR SANDBOX: ${page}`);
    console.log(`Chain ${fixture.chainId}; read-only browser RPC ${origin}/sandbox-rpc`);
    console.log(`Accepting receiver ${options.acceptingReceiver}; rejecting receiver ${options.rejectingReceiver}`);
    console.log(`Unlisted recipient ${options.stranger}. Press Ctrl-C to stop the fixture.`);
    for (const caller of Object.values(fixture.callers)) console.log(`Disposable signer: ${caller.accountId}`);
  } catch (error) {
    try {
      await server?.close();
    } finally {
      await cleanup();
    }
    throw error;
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof FixtureError) console.error(`Local Sandbox console stopped: ${error.message}`);
  else console.error('Local Sandbox console stopped. Check the web dependencies and local port availability.');
  process.exitCode = 1;
}
