import { BudgetBranchError } from '@budgetbranch/sdk';

const path = '/__budgetbranch_fixture';

async function post(route, body, token) {
  try {
    const response = await fetch(`${path}/${route}`, {
      method: 'POST', headers: {
        'Content-Type': 'application/json', ...(token ? { 'X-BudgetBranch-Fixture': token } : {}),
      },
      body: JSON.stringify(body), credentials: 'omit', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
    });
    const message = await response.json();
    if (message.error) {
      const error = message.error;
      throw new BudgetBranchError(error.kind, error.message, {
        code: error.code, transactionHash: error.transactionHash,
      });
    }
    if (response.ok) return message.result;
  } catch (error) {
    if (error instanceof BudgetBranchError) throw error;
  }
  throw new BudgetBranchError('rpc', 'The local Sandbox signer did not confirm the request');
}

async function connect() {
  const { chainId, contractId, actors, token } = await post('session', {});
  const controls = document.createElement('form');
  controls.className = 'sandbox-actors';
  controls.addEventListener('submit', event => event.preventDefault());
  const label = document.createElement('label');
  label.textContent = 'Local Sandbox signer: ';
  const select = document.createElement('select');
  for (const [role, accountId] of Object.entries(actors)) {
    const option = document.createElement('option');
    option.value = role;
    option.textContent = `${{ owner: 'Owner', agentA: 'Agent A', agentB: 'Agent B', child: 'Child' }[role]} · ${accountId}`;
    select.append(option);
  }
  function selectSigner() {
    const role = select.value;
    window.budgetBranchSigner = {
      network: 'sandbox', chainId, contractId, accountId: actors[role],
      async change(call) {
        select.disabled = true;
        try {
          return await post('change', { role, call }, token);
        } finally {
          select.disabled = false;
        }
      },
    };
    window.dispatchEvent(new Event('budgetbranch:signerchange'));
  }
  select.addEventListener('change', selectSigner);
  label.append(select);
  controls.append(label);
  document.body.prepend(controls);
  selectSigner();
}

connect().catch(() => {
  const message = document.createElement('p');
  message.className = 'sandbox-actors';
  message.textContent = 'Local Sandbox signer unavailable. You can still inspect the ledger.';
  document.body.prepend(message);
});
