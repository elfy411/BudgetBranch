import {
  BudgetBranchClient,
  BudgetBranchError,
  createJsonRpcTransport,
  isAccountId,
} from "@budgetbranch/sdk";
import type { BudgetBranchTransport } from "@budgetbranch/sdk";

export type Network = "mock" | "sandbox" | "testnet";
export type LiveNetwork = Exclude<Network, "mock">;

export interface Connection {
  network: Network;
  contractId: string;
  testnetRpc: string;
  scripted: boolean;
}

export interface SigningAdapter {
  network: LiveNetwork;
  chainId: string;
  contractId: string;
  accountId: string;
  change: NonNullable<BudgetBranchTransport["change"]>;
}

declare global {
  interface Window {
    budgetBranchSigner?: SigningAdapter;
  }
}

const PUBLIC_TESTNET_RPC = "https://test.rpc.fastnear.com";

export function initialConnection(): Connection {
  const query = new URLSearchParams(window.location.search);
  const network = query.get("network");
  return {
    network: network === "sandbox" || network === "testnet" ? network : "mock",
    contractId: query.get("contract") ?? "",
    testnetRpc: PUBLIC_TESTNET_RPC,
    scripted: query.get("scripted") === "1",
  };
}

export function connectionUrl(connection: Connection): string {
  if (!isAccountId(connection.contractId)) {
    throw new Error("Enter a valid NEAR contract account ID.");
  }
  if (connection.network === "sandbox") return "/sandbox-rpc";

  let url: URL;
  try {
    url = new URL(connection.testnetRpc);
  } catch {
    throw new Error("Enter a public HTTPS Testnet RPC URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Enter a public HTTPS Testnet RPC URL without credentials or parameters.");
  }
  if (/(^|[.-])mainnet([.-]|$)/i.test(url.hostname)) {
    throw new Error("This console supports Sandbox and Testnet.");
  }
  return url.href;
}

export async function verifyChain(network: LiveNetwork, rpcUrl: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "budgetbranch-status", method: "status", params: [] }),
      signal: AbortSignal.timeout(10_000),
      credentials: "omit",
      redirect: "error",
    });
  } catch {
    throw new Error("Unable to reach the RPC status endpoint.");
  }
  if (!response.ok) throw new Error(`RPC status returned HTTP ${response.status}.`);
  const status = await response.json();
  const chainId: unknown = status?.result?.chain_id;
  if (status?.jsonrpc !== "2.0" || status.id !== "budgetbranch-status" || typeof chainId !== "string" || chainId === "") {
    throw new Error("RPC status did not report a chain ID.");
  }

  const matches = network === "testnet"
    ? chainId === "testnet"
    : /^(?:localnet|sandbox|test-chain-[a-z0-9]+)$/i.test(chainId);
  if (!matches) {
    throw new Error(`RPC reported chain "${chainId}" for ${network.toUpperCase()} mode.`);
  }
  return chainId;
}

export function createClient(contractId: string, rpcUrl: string, signer?: SigningAdapter) {
  return new BudgetBranchClient(contractId, createJsonRpcTransport({
    rpcUrl,
    change: signer ? (call) => signer.change(call) : undefined,
  }));
}

export function getSigner(connection: Connection, chainId: string | null): SigningAdapter | undefined {
  const signer = window.budgetBranchSigner;
  if (chainId
    && signer?.network === connection.network
    && signer.chainId === chainId
    && signer.contractId === connection.contractId
    && isAccountId(signer.accountId)
    && typeof signer.change === "function") return signer;
}

export function describeError(error: unknown): { message: string; transactionHash?: string } {
  if (error instanceof BudgetBranchError) {
    return {
      message: error.code ? `${error.code} · ${error.message}` : error.message,
      transactionHash: error.transaction_hash ?? undefined,
    };
  }
  return { message: error instanceof Error ? error.message : "The request failed." };
}
