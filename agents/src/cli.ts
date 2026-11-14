import { AssertionError } from 'node:assert';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BudgetBranchError } from '@budgetbranch/sdk';
import { createSandboxFixture } from './fixture.js';
import type { SandboxFixtureOptions } from './fixture.js';
import { runScriptedScenario } from './scenario.js';

interface FixtureModule {
  createFixtureOptions(): Promise<{ options: SandboxFixtureOptions; cleanup?(): Promise<void> }>;
}

async function main(): Promise<void> {
  const [file, ...extra] = process.argv.slice(2);
  if (file === '--help') {
    console.log('Usage: npm --prefix agents run demo -- /absolute/path/to/sandbox-fixture.mjs');
    return;
  }
  if (!file || extra.length > 0) {
    throw new AssertionError({ message: 'Provide one local Sandbox fixture module path. Use --help for usage.' });
  }
  const path = pathToFileURL(resolve(process.env.INIT_CWD ?? process.cwd(), file));
  const fixtureModule = await import(path.href) as Partial<FixtureModule>;
  if (typeof fixtureModule.createFixtureOptions !== 'function') {
    throw new AssertionError({ message: 'The fixture module must export createFixtureOptions.' });
  }
  const { options, cleanup } = await fixtureModule.createFixtureOptions();
  try {
    const fixture = await createSandboxFixture(options);
    console.log(JSON.stringify({
      label: 'SCRIPTED DEMO (NEAR SANDBOX)', chainId: fixture.chainId, deployments: fixture.deployments,
    }));
    await runScriptedScenario(fixture, step => console.log(JSON.stringify(step)));
  } finally {
    await cleanup?.();
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof AssertionError) {
    console.error(`SCRIPTED DEMO stopped: ${error.message}`);
  } else if (error instanceof BudgetBranchError) {
    console.error(`SCRIPTED DEMO stopped: ${error.kind} ${error.code ?? ''} ${error.transaction_hash ?? ''}`.trim());
  } else {
    console.error('SCRIPTED DEMO stopped while loading or using the local Sandbox fixture');
  }
  process.exitCode = 1;
}
