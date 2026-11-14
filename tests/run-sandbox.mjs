import { AssertionError } from 'node:assert';
import { createSandboxFixture, runScriptedScenario } from '../agents/dist/index.js';
import { BudgetBranchError, yoctoToNear } from '../sdk/dist/index.js';
import { createFixtureOptions, FixtureError } from './sandbox-fixture.mjs';

const report = entry => console.log(JSON.stringify(entry));
try {
  const { options, runtime, setup, cleanup } = await createFixtureOptions();
  try {
    const fixture = await createSandboxFixture(options);
    report({ label: 'SCRIPTED DEMO (REAL NEAR SANDBOX)', runtime, setup, deployments: fixture.deployments });
    let steps = 0;
    let transactions = 0;
    let directRejections = 0;
    const snapshot = await runScriptedScenario(fixture, step => {
      steps++;
      transactions += step.transactions.length;
      if (step.rejection) directRejections++;
      report(step);
    });
    const { free, pending, spent, returned } = snapshot.budget;
    report({ result: 'PASS', mode: fixture.mode, steps, transactions, directRejections,
      near: { free: yoctoToNear(free), pending: yoctoToNear(pending), spent: yoctoToNear(spent), returned: yoctoToNear(returned) } });
  } finally {
    await cleanup();
  }
} catch (error) {
  const detail = error instanceof BudgetBranchError
    ? `${error.kind}: ${error.code ?? error.message}${error.transaction_hash ? ` (${error.transaction_hash})` : ''}`
    : error instanceof AssertionError || error instanceof FixtureError ? error.message
      : 'Unexpected fixture or scenario failure';
  console.error(`FAIL REAL NEAR SANDBOX: ${detail}`);
  process.exitCode = 1;
}
