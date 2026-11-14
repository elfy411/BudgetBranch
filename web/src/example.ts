import { nearToYocto } from "@budgetbranch/sdk";
import type { GrantView, PaymentView, SnapshotView } from "@budgetbranch/sdk";

const owner = "owner.sandbox";
const accept = "accept.sandbox";
const reject = "reject.sandbox";
const receivers = [accept, reject];
const amount = nearToYocto;
const expires = "1795089600000000000";

const baseGrant = {
  allowed_receivers: receivers,
  expires_at_ns: expires,
  pending: "0",
  spent: "0",
  returned: "0",
  revoked: false,
  effective_status: "active",
  blocked_by: null,
} satisfies Partial<GrantView>;

const grants: GrantView[] = [
  {
    ...baseGrant,
    grant_id: "0",
    parent_id: null,
    delegatee_id: owner,
    depth: 0,
    max_depth: 3,
    allocation: amount("10"),
    free: "0",
    child_reserved: amount("10"),
  },
  {
    ...baseGrant,
    grant_id: "1",
    parent_id: "0",
    delegatee_id: "agent-a.sandbox",
    depth: 1,
    max_depth: 2,
    allocation: amount("6"),
    free: amount("2"),
    child_reserved: amount("4"),
    revoked: true,
    effective_status: "revoked",
    blocked_by: "1",
  },
  {
    ...baseGrant,
    grant_id: "2",
    parent_id: "0",
    delegatee_id: "agent-b.sandbox",
    depth: 1,
    max_depth: 1,
    allowed_receivers: [accept],
    allocation: amount("4"),
    free: amount("3"),
    child_reserved: "0",
    pending: amount("1"),
  },
  {
    ...baseGrant,
    grant_id: "3",
    parent_id: "1",
    delegatee_id: "child-a.sandbox",
    depth: 2,
    max_depth: 2,
    allocation: amount("4"),
    free: amount("3"),
    child_reserved: "0",
    spent: amount("1"),
    effective_status: "revoked",
    blocked_by: "1",
  },
];

const basePayment = {
  kind: "spend",
  grant_id: "3",
  caller_id: "child-a.sandbox",
  amount: amount("1"),
  receiver_id: accept,
} satisfies Partial<PaymentView>;

export const exampleSnapshot: SnapshotView = {
  block_height: "0",
  block_timestamp_ns: "1794571200000000000",
  budget: {
    protocol_version: "0.1.0",
    owner_id: owner,
    root_id: "0",
    funded: amount("10"),
    free: amount("8"),
    pending: amount("1"),
    spent: amount("1"),
    returned: "0",
    operational_funding: amount("12"),
    operational_buffer: amount("0.1"),
    storage_required: amount("0.08"),
    recovery_storage_reserved: amount("9.5"),
    physical_liquid: amount("8"),
    grant_count: grants.length,
    payment_count: 3,
    request_count: 6,
    spend_count: 3,
    owner_refund_count: 0,
    normal_request_count: 6,
    recovery_request_count: 0,
  },
  grants,
  payments: [
    {
      ...basePayment,
      payment_id: "1",
      request_id: "mock-child-accept",
      status: "succeeded",
      failure_code: null,
      created_at_ns: "1794571020000000000",
      settled_at_ns: "1794571022000000000",
    },
    {
      ...basePayment,
      payment_id: "2",
      request_id: "mock-child-reject",
      receiver_id: reject,
      status: "failed",
      failure_code: "ERR_RECEIVER_FAILED",
      created_at_ns: "1794571120000000000",
      settled_at_ns: "1794571122000000000",
    },
    {
      ...basePayment,
      payment_id: "3",
      grant_id: "2",
      caller_id: "agent-b.sandbox",
      request_id: "mock-b-accept",
      status: "pending",
      failure_code: null,
      created_at_ns: "1794571199000000000",
      settled_at_ns: null,
    },
  ],
};
