import { isAccountId, nearToYocto, parseBudgetEvent, u64FromBigInt, yoctoToNear } from "@budgetbranch/sdk";
import type { Amount, BudgetBranchClient, BudgetEvent, ChangeMethods, ChangeReceipt, GrantView } from "@budgetbranch/sdk";

type Method = "deposit" | "delegate" | "spend" | "revoke" | "reclaim" | "refund_owner";
export type Operation =
  | { method: "deposit"; attachedDeposit: Amount }
  | { [M in Exclude<Method, "deposit">]: { method: M; args: ChangeMethods[M]["args"] } }[Exclude<Method, "deposit">];

export const actionLabels: Record<Method, string> = {
  deposit: "Fund budget",
  delegate: "Delegate",
  spend: "Spend",
  revoke: "Revoke branch",
  reclaim: "Reclaim to parent",
  refund_owner: "Refund owner",
};

function account(form: FormData, field: string) {
  const value = String(form.get(field) ?? "").trim();
  if (!isAccountId(value)) throw new Error("Enter a valid NEAR account ID.");
  return value;
}

export function prepareOperation(method: Method, grant: GrantView, form: FormData): Operation {
  if (method === "revoke") return { method, args: { grant_id: grant.grant_id } };

  const amount = nearToYocto(String(form.get("amount") ?? "").trim());
  if (amount === "0") throw new Error("Enter a positive amount.");
  if (method === "deposit") return { method, attachedDeposit: amount };

  const request_id = crypto.randomUUID();
  switch (method) {
    case "reclaim":
      return { method, args: { amount, grant_id: grant.grant_id, request_id } };
    case "refund_owner":
      return { method, args: { amount, request_id } };
    case "spend":
      return { method, args: { amount, grant_id: grant.grant_id, receiver_id: account(form, "receiver"), request_id } };
    case "delegate": {
      const receivers = form.getAll("allowed").map(String).sort();
      if (receivers.length === 0) throw new Error("Choose at least one allowed recipient.");
      const expiry = String(form.get("expiry") ?? "");
      // The input presents UTC at millisecond precision. The wire value remains an exact decimal U64.
      const expires_at_ns = expiry
        ? u64FromBigInt(BigInt(Date.parse(`${expiry}Z`)) * 1_000_000n)
        : grant.expires_at_ns;
      return { method, args: {
        parent_id: grant.grant_id,
        delegatee_id: account(form, "delegatee"),
        amount,
        allowed_receivers: receivers,
        expires_at_ns,
        max_depth: Number(form.get("max_depth")),
        request_id,
      } };
    }
  }
}

function recorded(message: string, change: ChangeReceipt<unknown>) {
  const events: BudgetEvent[] = [];
  let invalidLogs = false;
  for (const log of change.logs) {
    try {
      const entry = parseBudgetEvent(log);
      if (entry) events.push(entry);
    } catch {
      invalidLogs = true;
    }
  }
  return { message, hash: change.transactionHash, events, invalidLogs };
}

export async function executeOperation(client: BudgetBranchClient, operation: Operation) {
  switch (operation.method) {
    case "deposit": {
      const change = await client.deposit({}, { attachedDeposit: operation.attachedDeposit });
      return recorded(`Deposited ${yoctoToNear(operation.attachedDeposit)} NEAR.`, change);
    }
    case "delegate": {
      const change = await client.delegate(operation.args);
      return recorded(`Grant #${change.result.grant_id} was created.`, change);
    }
    case "spend": {
      const change = await client.spend(operation.args);
      return recorded(`Spend payment #${change.result.payment_id} was accepted. Follow its status in Recent payments.`, change);
    }
    case "revoke": {
      const change = await client.revoke(operation.args);
      return recorded(`Revocation recorded for grant #${change.result.grant_id}.`, change);
    }
    case "reclaim": {
      const change = await client.reclaim(operation.args);
      return recorded(`Reclaimed ${yoctoToNear(change.result.amount)} NEAR from grant #${change.result.grant_id}.`, change);
    }
    case "refund_owner": {
      const change = await client.refund_owner(operation.args);
      return recorded(`Refund payment #${change.result.payment_id} was accepted. Follow its status in Recent payments.`, change);
    }
  }
}
