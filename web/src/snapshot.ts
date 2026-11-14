import { useEffect, useRef, useState } from "react";
import type { SnapshotView } from "@budgetbranch/sdk";
import { connectionUrl, createClient, describeError, verifyChain } from "./connection";
import type { Connection } from "./connection";
import { exampleSnapshot } from "./example";

export function useSnapshot(connection: Connection) {
  const mock = connection.network === "mock";
  const [snapshot, setSnapshot] = useState<SnapshotView | null>(mock ? exampleSnapshot : null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!mock && Boolean(connection.contractId));
  const [refreshCount, setRefreshCount] = useState(0);
  const lastRead = useRef<{ chainId: string; height: bigint } | null>(null);
  const { network, contractId } = connection;

  useEffect(() => {
    if (network === "mock" || !contractId) return;
    let active = true;
    let timer = 0;

    async function load() {
      if (network === "mock") return;
      setLoading(true);
      let delay = 12_000;
      try {
        const rpcUrl = connectionUrl(connection);
        const verifiedChain = await verifyChain(network, rpcUrl);
        if (!active) return;
        if (lastRead.current && verifiedChain !== lastRead.current.chainId) {
          throw new Error("The RPC chain changed. Apply the connection again to read the new chain.");
        }
        const next = await createClient(contractId, rpcUrl).get_snapshot();
        if (!active) return;
        const height = BigInt(next.block_height);
        if (lastRead.current && height < lastRead.current.height) {
          throw new Error("The RPC returned an older finalized block.");
        }
        lastRead.current = { chainId: verifiedChain, height };
        setSnapshot(next);
        setChainId(verifiedChain);
        setError(null);
        if (next.budget.pending !== "0") delay = 2500;
      } catch (cause) {
        if (active) setError(describeError(cause).message);
      } finally {
        if (active) {
          setLoading(false);
          timer = window.setTimeout(poll, delay);
        }
      }
    }

    function poll() {
      if (document.hidden) {
        timer = window.setTimeout(poll, 12_000);
      } else {
        void load();
      }
    }

    void load();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [connection, contractId, network, refreshCount]);

  return {
    snapshot, chainId, error, loading,
    refresh: () => setRefreshCount((count) => count + 1),
  };
}
