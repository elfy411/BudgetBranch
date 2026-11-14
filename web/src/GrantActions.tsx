import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { BudgetBranchError, yoctoToNear } from "@budgetbranch/sdk";
import type { BudgetView, GrantView } from "@budgetbranch/sdk";
import { connectionUrl, createClient, describeError, getSigner, verifyChain } from "./connection";
import type { Connection } from "./connection";
import { actionLabels, executeOperation, prepareOperation } from "./operations";
import type { Operation } from "./operations";

type Action = Operation["method"];
type Intent = { operation: Operation; accountId: string };
export type ActionReceipt = Awaited<ReturnType<typeof executeOperation>>;

const descriptions: Record<Action, string> = {
  deposit: "Attach a new test NEAR deposit to the root budget.",
  delegate: "Allocate part of this grant’s free funds and set the child’s limits.",
  spend: "Request payment from this grant. The contract checks the recipient and available funds.",
  revoke: "Permanently block new delegation and spending throughout this branch. Pending payments continue to settle.",
  reclaim: "Move this grant’s local free funds to its immediate parent.",
  refund_owner: "Transfer root free funds to the owner. The contract reports settlement separately.",
};

function ActionFields({ action, grant, locked }: { action: Action; grant: GrantView; locked: boolean }) {
  if (action === "revoke") return null;
  const defaultAmount = action === "reclaim" || action === "refund_owner" ? yoctoToNear(grant.free) : "";
  return <fieldset disabled={locked} className="action-fields">
    {action === "delegate" && <label>
      Delegatee account
      <input name="delegatee" autoCapitalize="none" spellCheck={false} required />
    </label>}
    {action === "spend" && <label>
      Recipient account
      <input name="receiver" list="spend-recipients" autoCapitalize="none" spellCheck={false} required />
      <datalist id="spend-recipients">{grant.allowed_receivers.map((account) => <option key={account} value={account} />)}</datalist>
    </label>}
    <label>
      Amount in NEAR
      <input name="amount" inputMode="decimal" defaultValue={defaultAmount} required />
    </label>
    {action === "delegate" && <>
      <fieldset className="allowlist-fields">
        <legend>Allowed recipients</legend>
        {grant.allowed_receivers.map((account) => <label key={account}>
          <input type="checkbox" name="allowed" value={account} defaultChecked /> <code>{account}</code>
        </label>)}
      </fieldset>
      <div className="constraint-fields">
        <label>
          Earlier expiry (UTC, optional)
          <input type="datetime-local" name="expiry" step="1" />
        </label>
        <label>
          Depth ceiling
          <select name="max_depth" defaultValue={grant.max_depth}>
            {Array.from({ length: Math.max(0, grant.max_depth - grant.depth) }, (_, index) => {
              const depth = grant.depth + 1 + index;
              return <option key={depth} value={depth}>{depth}</option>;
            })}
          </select>
        </label>
      </div>
    </>}
  </fieldset>;
}

export function GrantActions({ connection, chainId, budget, grant, stale, refresh, onBusy, onReceipt, blockedDeposit, onBlockedDeposit }: {
  connection: Connection;
  chainId: string | null;
  budget: BudgetView;
  grant: GrantView;
  stale: boolean;
  refresh: () => void;
  onBusy: (busy: boolean) => void;
  onReceipt: (receipt: ActionReceipt) => void;
  blockedDeposit: string | null;
  onBlockedDeposit: (hash: string) => void;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ReturnType<typeof describeError> | null>(null);
  const [receipt, setReceipt] = useState<ActionReceipt | null>(null);
  const [attempt, setAttempt] = useState<Intent | null>(null);
  const [, setAdapterRevision] = useState(0);
  const inFlight = useRef(false);
  useEffect(() => {
    const onChange = () => setAdapterRevision((revision) => revision + 1);
    window.addEventListener("budgetbranch:signerchange", onChange);
    return () => window.removeEventListener("budgetbranch:signerchange", onChange);
  }, []);
  const signer = getSigner(connection, chainId);
  const isOwner = signer?.accountId === budget.owner_id;
  const isDelegatee = signer?.accountId === grant.delegatee_id;
  const isRoot = grant.parent_id === null;
  const active = grant.effective_status === "active";
  const unavailable = busy || stale || !signer;
  const signerNeeded = !signer ? "Controls need a matching signing adapter."
    : stale ? "Refresh the snapshot before signing."
    : `Signing as ${signer.accountId}.`;
  const maySign = action === "delegate" || action === "spend" ? isDelegatee : isOwner;
  const sameSigner = !attempt || attempt.accountId === signer?.accountId;
  const canResubmit = sameSigner && (action !== "deposit" || !blockedDeposit);

  function choose(next: Action) {
    setAction(next);
    setFailure(null);
    setReceipt(null);
    setAttempt(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || !signer || !maySign || unavailable || inFlight.current
      || !canResubmit || connection.network === "mock") return;

    inFlight.current = true;
    setBusy(true);
    onBusy(true);
    setFailure(null);
    let submitted = false;
    let operation: Operation | undefined;
    try {
      operation = attempt?.operation ?? prepareOperation(action, grant, new FormData(event.currentTarget));
      const rpcUrl = connectionUrl(connection);
      const verifiedChain = await verifyChain(connection.network, rpcUrl);
      if (verifiedChain !== signer.chainId || getSigner(connection, verifiedChain) !== signer) {
        throw new Error("The verified chain or signing adapter changed.");
      }
      setAttempt({ operation, accountId: signer.accountId });
      submitted = true;
      const result = await executeOperation(createClient(connection.contractId, rpcUrl, signer), operation);
      setReceipt(result);
      onReceipt(result);
      setAction(null);
      setAttempt(null);
    } catch (cause) {
      const problem = describeError(cause);
      const rejected = cause instanceof BudgetBranchError && cause.kind === "contract" && cause.transaction_hash;
      if (rejected) setAttempt(null);
      if (submitted && operation?.method === "deposit" && !rejected) {
        onBlockedDeposit(problem.transactionHash ?? "unavailable");
      }
      setFailure(problem);
    } finally {
      inFlight.current = false;
      setBusy(false);
      onBusy(false);
      if (submitted) refresh();
    }
  }

  return <div className="owner-actions">
    <h3>Grant actions</h3>
    <p className="muted">{signerNeeded}</p>
    <div className="action-buttons">
      <button type="button" className="button" disabled={unavailable || !isDelegatee || !active || grant.depth >= grant.max_depth || Boolean(attempt)} onClick={() => choose("delegate")}>Delegate</button>
      <button type="button" className="button" disabled={unavailable || !isDelegatee || !active || Boolean(attempt)} onClick={() => choose("spend")}>Spend</button>
      <button type="button" className="button button--danger" disabled={unavailable || !isOwner || grant.revoked || Boolean(attempt)} onClick={() => choose("revoke")}>Revoke branch</button>
      {isRoot
        ? <>
          <button type="button" className="button" disabled={unavailable || !isOwner || !active || Boolean(attempt) || Boolean(blockedDeposit)} onClick={() => choose("deposit")}>Fund budget</button>
          <button type="button" className="button" disabled={unavailable || !isOwner || grant.free === "0" || Boolean(attempt)} onClick={() => choose("refund_owner")}>Refund owner</button>
        </>
        : <button type="button" className="button" disabled={unavailable || !isOwner || active || grant.free === "0" || Boolean(attempt)} onClick={() => choose("reclaim")}>Reclaim to parent</button>}
    </div>
    {isRoot && blockedDeposit && <p className="action-failure">Deposit outcome is unresolved. Verify the transaction with your signing adapter before funding again.
      {blockedDeposit !== "unavailable" && <> <code>{blockedDeposit}</code></>}
    </p>}
    {action && <form className="action-form" onSubmit={submit}>
      <p>{descriptions[action]}</p>
      <ActionFields key={action} action={action} grant={grant} locked={busy || Boolean(attempt)} />
      {attempt && "args" in attempt.operation && "request_id" in attempt.operation.args
        && <p className="muted">Retry keeps request ID <code>{attempt.operation.args.request_id}</code>.</p>}
      {!sameSigner && <p className="muted">Restore signer {attempt?.accountId} to retry this action.</p>}
      {failure && <div role="alert" className="action-failure">
        <p>{failure.message}</p>
        {failure.transactionHash && <code>{failure.transactionHash}</code>}
      </div>}
      <div className="action-buttons">
        <button className="button button--primary" disabled={unavailable || !maySign || !canResubmit}>
          {busy ? "Waiting for signer…" : attempt ? "Retry same action" : actionLabels[action]}
        </button>
        <button className="button" type="button" disabled={busy} onClick={() => { setAction(null); setFailure(null); setAttempt(null); }}>Close</button>
      </div>
    </form>}
    {receipt && <div className="action-receipt" role="status">
      <p>{receipt.message}</p>
      <p>Transaction <code>{receipt.hash}</code></p>
    </div>}
  </div>;
}
