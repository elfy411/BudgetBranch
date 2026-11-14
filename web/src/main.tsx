import { useState } from "react";
import type { FormEvent } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import { initialConnection } from "./connection";
import type { Connection, Network } from "./connection";
import { Budget, GrantLedger, GrantTree, Payments } from "./Ledger";
import { ChainTime } from "./format";
import { GrantActions } from "./GrantActions";
import type { ActionReceipt } from "./GrantActions";
import { useSnapshot } from "./snapshot";
import "./styles.css";

function ConnectionForm({ connection, connect }: {
  connection: Connection;
  connect: (next: Connection) => void;
}) {
  const [draft, setDraft] = useState(connection);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    connect({ ...draft, contractId: draft.contractId.trim(), testnetRpc: draft.testnetRpc.trim() });
  }

  return <form className="connection-form" onSubmit={submit}>
    <label>
      Source
      <select value={draft.network} onChange={(event) => setDraft({ ...draft, network: event.target.value as Network })}>
        <option value="mock">Mock example</option>
        <option value="sandbox">Sandbox</option>
        <option value="testnet">Testnet</option>
      </select>
    </label>
    {draft.network !== "mock" && <label>
      Contract account
      <input value={draft.contractId} onChange={(event) => setDraft({ ...draft, contractId: event.target.value })} autoCapitalize="none" autoComplete="off" spellCheck={false} required />
    </label>}
    {draft.network === "testnet" && <label>
      Public Testnet RPC
      <input type="url" value={draft.testnetRpc} onChange={(event) => setDraft({ ...draft, testnetRpc: event.target.value })} autoCapitalize="none" autoComplete="off" spellCheck={false} required />
    </label>}
    {draft.network === "sandbox" && <p className="muted">Reads use the local Sandbox RPC configured for this Vite process.</p>}
    {draft.network !== "mock" && <label className="scripted-setting">
      <input type="checkbox" checked={draft.scripted} onChange={(event) => setDraft({ ...draft, scripted: event.target.checked })} />
      Scripted scenario
    </label>}
    <button className="button button--primary">Apply connection</button>
  </form>;
}

function Wordmark() {
  return <div className="wordmark">
    <span className="brand-icon" aria-hidden="true"><i /><i /><i /></span>
    <span>BudgetBranch</span>
  </div>;
}

function Console({ connection, connect, blockedDeposit, onBlockedDeposit }: {
  connection: Connection;
  connect: (next: Connection) => void;
  blockedDeposit: (chainId: string | null) => string | null;
  onBlockedDeposit: (chainId: string | null, hash: string) => void;
}) {
  const [connectionOpen, setConnectionOpen] = useState(connection.network !== "mock" && !connection.contractId);
  const [selected, setSelected] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [receipts, setReceipts] = useState<ActionReceipt[]>([]);
  const { snapshot, chainId, error, loading, refresh } = useSnapshot(connection);
  const mock = connection.network === "mock";
  const rootGrantId = snapshot?.budget.root_id;
  const grant = snapshot?.grants.find((entry) => entry.grant_id === (selected ?? rootGrantId))
    ?? snapshot?.grants.find((entry) => entry.grant_id === rootGrantId);

  return <>
    <header className="topbar">
      <div className="topbar-inner">
        <Wordmark />
        <div className="topbar-actions">
          <span className={`network network--${connection.network}`}>{connection.network.toUpperCase()}</span>
          <button
            className="button connection-button"
            aria-expanded={connectionOpen}
            aria-controls="connection-panel"
            disabled={signing}
            onClick={() => setConnectionOpen(!connectionOpen)}
          >Connection <span className="chevron" aria-hidden="true" /></button>
        </div>
      </div>
    </header>
    <main>
      <div className="page-heading">
        <div>
          <h1>Delegation console</h1>
          <p>Inspect how agents share, spend, and return a funded NEAR budget.</p>
        </div>
        {!mock && <button className="button refresh-button" disabled={loading || !connection.contractId} onClick={refresh}>Refresh snapshot</button>}
      </div>
      <div className={`connection-panel ${connectionOpen ? "is-open" : ""}`} id="connection-panel" hidden={!connectionOpen || signing}>
        {connectionOpen && <ConnectionForm connection={connection} connect={connect} />}
      </div>
      {mock
        ? <div className="mock-strip"><strong>MOCK · SCRIPTED</strong><span>Illustrative data. Signing and on-chain reads are disabled.</span></div>
        : <div className="snapshot-strip">
          {connection.scripted && <strong className="scripted-badge">SCRIPTED</strong>}
          {connection.contractId && <code>{connection.contractId}</code>}
          {snapshot && <span>Finalized block <b>{BigInt(snapshot.block_height).toLocaleString("en-US")}</b> · <ChainTime timestamp={snapshot.block_timestamp_ns} /></span>}
          {chainId && <span>Chain <code>{chainId}</code></span>}
          {loading && !snapshot && <span role="status">Loading finalized snapshot…</span>}
        </div>}
      {error && <div className="load-error" role="alert">
        <strong>{snapshot ? "Snapshot refresh failed. Showing the last loaded block." : "Could not load a finalized snapshot."}</strong>
        <p>{error}</p>
      </div>}
      {!snapshot && !loading && !error && <p className="empty-connection card">Choose a contract account in Connection to read its budget.</p>}
      {snapshot && <>
        <Budget budget={snapshot.budget} />
        {grant && <div className="workspace">
          <GrantTree grants={snapshot.grants} selected={grant.grant_id} select={(entry) => setSelected(entry.grant_id)} disabled={signing} />
          <section className="card grant-card" aria-labelledby="grant-title">
            <GrantLedger grant={grant} />
            <GrantActions
              key={grant.grant_id}
              connection={connection}
              chainId={chainId}
              budget={snapshot.budget}
              grant={grant}
              stale={Boolean(error)}
              refresh={refresh}
              onBusy={setSigning}
              onReceipt={(receipt) => setReceipts((previous) => [receipt, ...previous.filter((entry) => entry.hash !== receipt.hash)].slice(0, 20))}
              blockedDeposit={blockedDeposit(chainId)}
              onBlockedDeposit={(hash) => onBlockedDeposit(chainId, hash)}
            />
          </section>
        </div>}
        <Payments snapshot={snapshot} />
        {receipts.length > 0 && <details className="card receipt-history">
          <summary>Transaction receipts from this session</summary>
          <ol>
            {receipts.map((receipt) => <li key={receipt.hash}>
              <p>{receipt.message}</p>
              <code>{receipt.hash}</code>
              {receipt.events.length > 0 && <ul>{receipt.events.map((entry, index) => <li key={index}><code>{entry.event}</code></li>)}</ul>}
              {receipt.invalidLogs && <p className="muted">Some receipt events could not be decoded.</p>}
            </li>)}
          </ol>
        </details>}
      </>}
      <footer>
        <span>BudgetBranch</span>
        <span>NEAR · Protocol {snapshot?.budget.protocol_version ?? "0.1.0"}</span>
      </footer>
    </main>
  </>;
}

function App() {
  const [current, setCurrent] = useState(() => ({ connection: initialConnection(), revision: 0 }));
  const [unresolvedDeposits, setUnresolvedDeposits] = useState<Record<string, string>>({});
  const depositKey = (chainId: string | null) => `${current.connection.network}/${chainId}/${current.connection.contractId}`;
  return <Console
    key={current.revision}
    connection={current.connection}
    connect={(next) => setCurrent({ connection: next, revision: current.revision + 1 })}
    blockedDeposit={(chainId) => unresolvedDeposits[depositKey(chainId)] ?? null}
    onBlockedDeposit={(chainId, hash) => setUnresolvedDeposits((previous) => ({ ...previous, [depositKey(chainId)]: hash }))}
  />;
}

createRoot(document.getElementById("root")!).render(<App />);
