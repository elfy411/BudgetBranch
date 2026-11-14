use borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::AccountId;
use serde::Serialize;

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug)]
pub struct Grant {
    pub id: u64,
    // Root uses itself as parent; the wire presents null.
    pub parent: u64,
    pub delegatee: AccountId,
    pub depth: u8,
    pub max_depth: u8,
    pub receivers: Vec<AccountId>,
    pub expires: u64,
    pub revoked: bool,
    pub allocation: u128,
    pub free: u128,
    pub child_reserved: u128,
    pub pending: u128,
    pub spent: u128,
    pub returned: u128,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum PaymentKind {
    Spend,
    OwnerRefund,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum PaymentStatus {
    Pending,
    Succeeded,
    Failed,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum FailureCode {
    None,
    ReceiverFailed,
    TransferFailed,
}

/// All mutable settlement fields have fixed Borsh widths: 1 + 1 + 8 bytes.
/// No Option or dynamic error string is ever stored in a payment.
#[derive(BorshDeserialize, BorshSerialize, Clone, Debug)]
pub struct Payment {
    pub id: u64,
    pub kind: PaymentKind,
    pub grant: u64,
    pub caller: AccountId,
    pub request: String,
    pub receiver: AccountId,
    pub amount: u128,
    pub status: PaymentStatus,
    pub failure: FailureCode,
    pub created: u64,
    pub settled: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug, PartialEq, Eq)]
pub enum Intent {
    Delegate {
        parent_id: u64,
        delegatee_id: AccountId,
        amount: u128,
        allowed_receivers: Vec<AccountId>,
        expires_at_ns: u64,
        max_depth: u8,
    },
    Spend {
        grant_id: u64,
        receiver_id: AccountId,
        amount: u128,
    },
    Reclaim {
        grant_id: u64,
        amount: u128,
    },
    RefundOwner {
        amount: u128,
    },
}

/// Store typed intent as well as the wire fingerprint: equality is not reliant
/// on an assumed collision resistance. Caller + request ID are in the key.
#[derive(BorshDeserialize, BorshSerialize, Clone, Debug)]
pub struct Request {
    pub intent: Intent,
    pub result_id: u64,
    pub fingerprint: [u8; 32],
}

#[derive(Serialize, Debug)]
pub struct GrantResult {
    pub grant_id: String,
}
#[derive(Serialize, Debug)]
pub struct PaymentResult {
    pub payment_id: String,
}
#[derive(Serialize, Debug)]
pub struct ReclaimResult {
    pub grant_id: String,
    pub amount: String,
}

#[derive(Serialize, Debug)]
pub struct GrantView {
    pub grant_id: String,
    pub parent_id: Option<String>,
    pub delegatee_id: AccountId,
    pub depth: u8,
    pub max_depth: u8,
    pub allowed_receivers: Vec<AccountId>,
    pub expires_at_ns: String,
    pub revoked: bool,
    pub effective_status: &'static str,
    pub blocked_by: Option<String>,
    pub allocation: String,
    pub free: String,
    pub child_reserved: String,
    pub pending: String,
    pub spent: String,
    pub returned: String,
}

#[derive(Serialize, Debug)]
pub struct PaymentView {
    pub payment_id: String,
    pub kind: &'static str,
    pub grant_id: String,
    pub caller_id: AccountId,
    pub request_id: String,
    pub receiver_id: AccountId,
    pub amount: String,
    pub status: &'static str,
    pub failure_code: Option<&'static str>,
    pub created_at_ns: String,
    pub settled_at_ns: Option<String>,
}

impl Payment {
    pub fn view(&self) -> PaymentView {
        PaymentView {
            payment_id: self.id.to_string(),
            kind: match self.kind {
                PaymentKind::Spend => "spend",
                PaymentKind::OwnerRefund => "owner_refund",
            },
            grant_id: self.grant.to_string(),
            caller_id: self.caller.clone(),
            request_id: self.request.clone(),
            receiver_id: self.receiver.clone(),
            amount: self.amount.to_string(),
            status: match self.status {
                PaymentStatus::Pending => "pending",
                PaymentStatus::Succeeded => "succeeded",
                PaymentStatus::Failed => "failed",
            },
            failure_code: match self.failure {
                FailureCode::None => None,
                FailureCode::ReceiverFailed => Some("ERR_RECEIVER_FAILED"),
                FailureCode::TransferFailed => Some("ERR_TRANSFER_FAILED"),
            },
            created_at_ns: self.created.to_string(),
            settled_at_ns: if self.status == PaymentStatus::Pending {
                None
            } else {
                Some(self.settled.to_string())
            },
        }
    }
}

#[derive(Serialize, Debug)]
pub struct BudgetView {
    pub protocol_version: &'static str,
    pub owner_id: AccountId,
    pub root_id: &'static str,
    pub funded: String,
    pub free: String,
    pub pending: String,
    pub spent: String,
    pub returned: String,
    pub operational_funding: String,
    pub operational_buffer: String,
    pub storage_required: String,
    pub recovery_storage_reserved: String,
    pub physical_liquid: String,
    pub grant_count: u32,
    pub payment_count: u32,
    pub request_count: u32,
    pub spend_count: u32,
    pub owner_refund_count: u32,
    pub normal_request_count: u32,
    pub recovery_request_count: u32,
}

#[derive(Serialize, Debug)]
pub struct SnapshotView {
    pub block_height: String,
    pub block_timestamp_ns: String,
    pub budget: BudgetView,
    pub grants: Vec<GrantView>,
    pub payments: Vec<PaymentView>,
}

#[derive(Serialize, Debug)]
pub struct RequestView {
    pub caller_id: AccountId,
    pub request_id: String,
    pub fingerprint: String,
    pub method: &'static str,
    pub result: serde_json::Value,
}
