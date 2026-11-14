import type { BudgetView, GrantView, PaymentView, SnapshotView } from "@budgetbranch/sdk";
import { ChainTime, NearAmount, Status } from "./format";

const totals = [
  ["free", "Logical free"],
  ["pending", "Pending"],
  ["spent", "Spent"],
  ["returned", "Refunded"],
] as const;

export function Budget({ budget }: { budget: BudgetView }) {
  const funded = BigInt(budget.funded);
  return <div className="overview">
    <section className="card budget-card" aria-labelledby="budget-title">
      <div className="section-heading">
        <h2 id="budget-title">Funded budget</h2>
        <span className="quiet-label">Global ledger</span>
      </div>
      <p className="funded-amount"><NearAmount amount={budget.funded} /></p>
      {funded > 0n && <div className="budget-bar" aria-hidden="true">
        {totals.map(([key]) => {
          const basisPoints = Number(BigInt(budget[key]) * 10_000n / funded);
          return <span key={key} className={`budget-color--${key}`} style={{ width: `${basisPoints / 100}%` }} />;
        })}
      </div>}
      <dl className="budget-totals">
        {totals.map(([key, label]) => <div key={key}>
          <dt><span className={`legend-dot budget-color--${key}`} aria-hidden="true" />{label}</dt>
          <dd><NearAmount amount={budget[key]} unit={false} /></dd>
        </div>)}
      </dl>
    </section>
    <section className="card liquidity-card" aria-labelledby="liquidity-title">
      <h2 id="liquidity-title">Physical liquidity</h2>
      <p className="liquidity-amount"><NearAmount amount={budget.physical_liquid} maxFractionDigits={6} /></p>
      <p className="muted">On-chain balance above protected operating funds. It can lag behind logical free when NEAR refunds a failed payment.</p>
      <details className="operations">
        <summary>Operating funds</summary>
        <dl className="detail-list">
          <div><dt>Funding</dt><dd><NearAmount amount={budget.operational_funding} /></dd></div>
          <div><dt>Storage in use</dt><dd><NearAmount amount={budget.storage_required} /></dd></div>
          <div><dt>Reserved recovery storage</dt><dd><NearAmount amount={budget.recovery_storage_reserved} /></dd></div>
          <div><dt>Liquid buffer</dt><dd><NearAmount amount={budget.operational_buffer} /></dd></div>
        </dl>
      </details>
    </section>
  </div>;
}

export function GrantTree({ grants, selected, select, disabled }: {
  grants: GrantView[];
  selected: string;
  select: (grant: GrantView) => void;
  disabled: boolean;
}) {
  const children = new Map<string | null, GrantView[]>();
  for (const grant of grants) {
    const siblings = children.get(grant.parent_id) ?? [];
    siblings.push(grant);
    children.set(grant.parent_id, siblings);
  }

  function renderBranch(parent: string | null) {
    const branch = children.get(parent);
    if (!branch?.length) return null;
    return <ul className="grant-list">{branch.map((grant) => <li key={grant.grant_id}>
      <button
        type="button"
        className="grant-row"
        aria-pressed={selected === grant.grant_id}
        disabled={disabled}
        onClick={() => select(grant)}
      >
        <span className="grant-account">
          <span className={`node-icon ${parent === null ? "node-icon--root" : ""}`} aria-hidden="true" />
          <span>
            <strong>{grant.delegatee_id}</strong>
            <small>{parent === null ? "Root grant" : `Grant #${grant.grant_id}`}</small>
          </span>
        </span>
        <span className="grant-free"><NearAmount amount={grant.free} /> <small>free</small></span>
        <Status value={grant.effective_status} />
      </button>
      {renderBranch(grant.grant_id)}
    </li>)}</ul>;
  }

  return <section className="card tree-card" aria-labelledby="tree-title">
    <div className="section-heading">
      <h2 id="tree-title">Grant tree</h2>
      <span className="quiet-label">{grants.length} {grants.length === 1 ? "grant" : "grants"}</span>
    </div>
    {renderBranch(null)}
  </section>;
}

const localAmounts = [
  ["allocation", "Allocation"],
  ["free", "Local free"],
  ["child_reserved", "Child commitments"],
  ["pending", "Pending"],
  ["spent", "Spent"],
] as const;

export function GrantLedger({ grant }: { grant: GrantView }) {
  const blockedByAncestor = grant.blocked_by !== null && grant.blocked_by !== grant.grant_id;
  return <>
    <div className="section-heading">
      <h2 id="grant-title">Grant #{grant.grant_id}</h2>
      <Status value={grant.effective_status} />
    </div>
    <p className="account-heading">{grant.delegatee_id}</p>
    {blockedByAncestor && <p className="inherited-status">Inherits {grant.effective_status === "revoked" ? "revocation" : "expiry"} from grant #{grant.blocked_by}.</p>}
    <dl className="local-totals">
      {localAmounts.map(([key, label]) => <div key={key}>
        <dt title={key === "child_reserved" ? "Lifetime commitments to direct children, including what their branches have spent." : undefined}>{label}</dt>
        <dd><NearAmount amount={grant[key]} /></dd>
      </div>)}
      <div>
        <dt>{grant.parent_id === null ? "Owner refunded" : "Reclaimed to parent"}</dt>
        <dd><NearAmount amount={grant.returned} /></dd>
      </div>
    </dl>
    <p className="commitment-caption">Child commitments include lifetime spending in those branches.</p>
    <dl className="constraints">
      <div>
        <dt>Allowed recipients</dt>
        <dd className="receiver-list">{grant.allowed_receivers.map((account) => <code key={account}>{account}</code>)}</dd>
      </div>
      <div>
        <dt>Expires</dt>
        <dd><ChainTime timestamp={grant.expires_at_ns} /></dd>
      </div>
      <div>
        <dt>Depth / ceiling</dt>
        <dd>{grant.depth} / {grant.max_depth}</dd>
      </div>
    </dl>
  </>;
}

function PaymentRow({ payment }: { payment: PaymentView }) {
  return <li className="payment-row">
    <div><strong>#{payment.payment_id}</strong> <span>{payment.kind === "owner_refund" ? "Owner refund" : "Spend"}</span>
      <small>Grant #{payment.grant_id} · <span className="account">{payment.caller_id}</span></small>
    </div>
    <div className="payment-receiver"><span className="mobile-label">Recipient</span><code>{payment.receiver_id}</code></div>
    <div className="payment-amount"><span className="mobile-label">Amount</span><NearAmount amount={payment.amount} /></div>
    <div><Status value={payment.status} />
      {payment.failure_code && <small className="failure-code">{payment.failure_code}</small>}
    </div>
  </li>;
}

export function Payments({ snapshot }: { snapshot: SnapshotView }) {
  const count = snapshot.budget.payment_count;
  const payments = snapshot.payments.slice().reverse();
  return <section className="card payments-card" aria-labelledby="payments-title">
    <div className="section-heading">
      <h2 id="payments-title">Recent payments</h2>
      <span className="quiet-label">{payments.length < count ? `${payments.length} of ${count}` : `${count} ${count === 1 ? "payment" : "payments"}`}</span>
    </div>
    {snapshot.budget.pending !== "0" && <p className="muted settlement-note">Pending funds remain reserved until the contract callback settles them.</p>}
    {payments.length ? <>
      <div className="payment-row payment-header" aria-hidden="true">
        <span>Payment</span><span>Recipient</span><span>Amount</span><span>Status</span>
      </div>
      <ul className="payment-list">{payments.map((payment) => <PaymentRow key={payment.payment_id} payment={payment} />)}</ul>
    </> : <p className="empty-payment muted">No payment records at this block.</p>}
  </section>;
}
