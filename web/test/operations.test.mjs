import assert from "node:assert/strict";
import test from "node:test";
import { BudgetBranchClient, BudgetBranchError } from "@budgetbranch/sdk";
import { exampleSnapshot } from "../src/example.ts";
import { executeOperation, prepareOperation } from "../src/operations.ts";

const root = exampleSnapshot.grants[0];
const hash = "mock-receipt-id";

function form(fields) {
  const data = new FormData();
  for (const [name, value] of fields) data.append(name, value);
  return data;
}

test("the MOCK snapshot conserves business funds at both ledger levels", () => {
  const { budget, grants } = exampleSnapshot;
  for (const grant of grants) {
    const local = ["free", "pending", "spent", "returned", "child_reserved"]
      .reduce((total, key) => total + BigInt(grant[key]), 0n);
    assert.equal(local, BigInt(grant.allocation));
    const commitments = grants.filter((child) => child.parent_id === grant.grant_id)
      .reduce((total, child) => total + BigInt(child.allocation) - BigInt(child.returned), 0n);
    assert.equal(commitments, BigInt(grant.child_reserved));
  }
  assert.equal(
    ["free", "pending", "spent", "returned"].reduce((total, key) => total + BigInt(budget[key]), 0n),
    BigInt(budget.funded),
  );
  for (const key of ["free", "pending", "spent"]) {
    assert.equal(grants.reduce((total, grant) => total + BigInt(grant[key]), 0n), BigInt(budget[key]));
  }
  assert.equal(root.returned, budget.returned);
});

test("delegation uses frozen names, exact amounts, sorted recipients and inherited expiry", () => {
  const { method, args } = prepareOperation("delegate", root, form([
    ["amount", "4.000000000000000000000001"],
    ["delegatee", "child.sandbox"],
    ["allowed", "reject.sandbox"],
    ["allowed", "accept.sandbox"],
    ["max_depth", "2"],
  ]));
  assert.equal(method, "delegate");
  assert.deepEqual({ ...args, request_id: null }, {
    parent_id: "0",
    delegatee_id: "child.sandbox",
    amount: "4000000000000000000000001",
    allowed_receivers: ["accept.sandbox", "reject.sandbox"],
    expires_at_ns: root.expires_at_ns,
    max_depth: 2,
    request_id: null,
  });
  assert.match(args.request_id, /^[A-Za-z0-9_-]{1,64}$/);
});

test("spend retries keep the same request and report receipt acceptance separately from settlement", async () => {
  const operation = prepareOperation("spend", root, form([
    ["amount", "1"], ["receiver", "outside-allowlist.sandbox"],
  ]));
  const calls = [];
  const client = new BudgetBranchClient("budgetbranch.sandbox", {
    view: () => assert.fail("The receipt path must not fabricate a view"),
    async change(call) {
      calls.push(call);
      if (calls.length === 1) throw new BudgetBranchError("timeout", "No receipt yet");
      return { result: { payment_id: "17" }, transactionHash: hash, logs: [] };
    },
  });
  await assert.rejects(() => executeOperation(client, operation), /No receipt yet/);
  const receipt = await executeOperation(client, operation);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[1].args.receiver_id, "outside-allowlist.sandbox");
  assert.equal(calls[1].attachedDeposit, "0");
  assert.match(receipt.message, /payment #17 was accepted/i);
  assert.equal(receipt.hash, hash);
});

test("deposit attaches principal and preserves a real adapter receipt boundary", async () => {
  const operation = prepareOperation("deposit", root, form([["amount", "10"]]));
  const client = new BudgetBranchClient("budgetbranch.sandbox", {
    view: () => assert.fail("The receipt path must not fabricate a view"),
    async change(call) {
      assert.equal(call.method, "deposit");
      assert.deepEqual(call.args, {});
      assert.equal(call.attachedDeposit, "10000000000000000000000000");
      return { result: exampleSnapshot.budget, transactionHash: hash, logs: ["EVENT_JSON:{"] };
    },
  });
  const receipt = await executeOperation(client, operation);
  assert.equal(receipt.hash, hash);
  assert.equal(receipt.invalidLogs, true);
  assert.deepEqual(receipt.events, []);
});
