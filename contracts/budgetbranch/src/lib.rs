//! BudgetBranch frozen v0.1.0. Sandbox/Testnet prototype, synchronous receivers only.
//! Raw storage writes are immediate. The root is explicitly persisted before
//! measuring storage; there are no lazy collection flushes or growing indexes.
#[cfg(all(target_arch = "wasm32", not(near)))]
compile_error!("Missing --cfg near: run Cargo from contracts/ to load .cargo/config.toml");
mod model;
pub use model::*;

use borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::{
    AccountId, Gas, GasWeight, NearToken, PanicOnDefault, Promise, PromiseError, env, near_bindgen,
};
use serde::Serialize;
use serde_json::{Value, json};

pub const OPERATIONAL_BUFFER: u128 = 100_000_000_000_000_000_000_000;
pub const MAX_GRANTS: u32 = 128;
pub const MAX_SPENDS: u32 = 512;
pub const MAX_NORMAL_REQUESTS: u32 = 1024;
pub const MAX_REFUNDS: u32 = 1024;
pub const MAX_RECOVERY_REQUESTS: u32 = 4096;
pub const MIN_SPEND_GAS: Gas = Gas::from_tgas(100);
pub const MIN_REFUND_GAS: Gas = Gas::from_tgas(60);
pub const RECEIVER_GAS: Gas = Gas::from_tgas(30);
pub const CALLBACK_GAS: Gas = Gas::from_tgas(30);

// Exact schema upper bounds; tests serialize maximum-width fixtures and measure
// key/value/record overhead. No per-record index exists. Root width never grows.
pub const STORAGE_RECORD_OVERHEAD: u64 = 40;
pub const MAX_PAYMENT_VALUE_BYTES: u64 = 255;
pub const MAX_RECOVERY_REQUEST_VALUE_BYTES: u64 = 65;
pub const MAX_PAYMENT_STORAGE_BYTES: u64 = 9 + MAX_PAYMENT_VALUE_BYTES + STORAGE_RECORD_OVERHEAD;
pub const MAX_RECOVERY_REQUEST_STORAGE_BYTES: u64 =
    137 + MAX_RECOVERY_REQUEST_VALUE_BYTES + STORAGE_RECORD_OVERHEAD;

#[near_bindgen(contract_state)]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct BudgetBranch {
    owner_id: AccountId,
    operational_funding: u128,
    grant_count: u32,
    payment_count: u32,
    request_count: u32,
    spend_count: u32,
    owner_refund_count: u32,
    normal_request_count: u32,
    recovery_request_count: u32,
}

fn fail(code: &str) -> ! {
    env::panic_str(&format!("BB:{code}"))
}
fn require(ok: bool, code: &str) {
    if !ok {
        fail(code);
    }
}
fn add(a: u128, b: u128) -> u128 {
    a.checked_add(b).unwrap_or_else(|| fail("ERR_OVERFLOW"))
}
fn sub(a: u128, b: u128) -> u128 {
    a.checked_sub(b).unwrap_or_else(|| fail("ERR_OVERFLOW"))
}
fn count(n: u32) -> u32 {
    n.checked_add(1).unwrap_or_else(|| fail("ERR_OVERFLOW"))
}
fn amount(input: &str) -> u128 {
    require(
        !input.is_empty()
            && input.len() <= 39
            && input.bytes().all(|b| b.is_ascii_digit())
            && (input == "0" || !input.starts_with('0')),
        "ERR_ARGUMENT",
    );
    input.parse().unwrap_or_else(|_| fail("ERR_ARGUMENT"))
}
fn number(input: &str) -> u64 {
    require(input.len() <= 20, "ERR_ARGUMENT");
    u64::try_from(amount(input)).unwrap_or_else(|_| fail("ERR_ARGUMENT"))
}
fn positive(n: u128) {
    require(n > 0, "ERR_ZERO_AMOUNT");
}
fn no_deposit() {
    require(env::attached_deposit().is_zero(), "ERR_DEPOSIT");
}
fn caller() -> AccountId {
    no_deposit();
    let who = env::predecessor_account_id();
    require(who == env::signer_account_id(), "ERR_AUTH");
    who
}
fn valid_request(id: &str) {
    require(
        !id.is_empty()
            && id.len() <= 64
            && id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-'),
        "ERR_REQUEST_ID",
    );
}
fn valid_receivers(ids: &[AccountId]) {
    require(
        !ids.is_empty() && ids.len() <= 8 && ids.windows(2).all(|w| w[0] < w[1]),
        "ERR_ALLOWLIST",
    );
}
fn record_key(prefix: u8, id: u64) -> Vec<u8> {
    let mut key = vec![prefix];
    key.extend_from_slice(&id.to_le_bytes());
    key
}
fn request_key(who: &AccountId, request: &str) -> Vec<u8> {
    let mut key = vec![b'r'];
    key.extend(borsh::to_vec(&(who, request)).unwrap_or_else(|_| fail("ERR_ARGUMENT")));
    key
}
fn read<T: BorshDeserialize>(key: &[u8]) -> Option<T> {
    env::storage_read(key)
        .map(|bytes| T::try_from_slice(&bytes).unwrap_or_else(|_| fail("ERR_ARGUMENT")))
}
fn write<T: BorshSerialize>(key: &[u8], value: &T) {
    env::storage_write(
        key,
        &borsh::to_vec(value).unwrap_or_else(|_| fail("ERR_ARGUMENT")),
    );
}
fn grant(id: u64) -> Grant {
    let g: Grant = read(&record_key(b'g', id)).unwrap_or_else(|| fail("ERR_NOT_FOUND"));
    require(g.id == id, "ERR_ARGUMENT");
    g
}
fn save_grant(g: &Grant) {
    require(
        g.allocation
            == add(
                add(add(add(g.free, g.child_reserved), g.pending), g.spent),
                g.returned,
            ),
        "ERR_OVERFLOW",
    );
    write(&record_key(b'g', g.id), g);
}
fn event(name: &str, payload: &impl Serialize) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        json!({ "standard": "budgetbranch", "version": "0.1.0", "event": name, "data": [payload] })
    ));
}

/// Explicit recursive lexical ordering because near-sdk enables serde_json's
/// preserve_order feature. Hashing never depends on map insertion order.
fn canonical(value: Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut entries: Vec<_> = map.into_iter().collect();
            entries.sort_by(|a, b| a.0.cmp(&b.0));
            Value::Object(
                entries
                    .into_iter()
                    .map(|(k, v)| (k, canonical(v)))
                    .collect(),
            )
        }
        Value::Array(items) => Value::Array(items.into_iter().map(canonical).collect()),
        other => other,
    }
}
impl Intent {
    fn method(&self) -> &'static str {
        match self {
            Self::Delegate { .. } => "delegate",
            Self::Spend { .. } => "spend",
            Self::Reclaim { .. } => "reclaim",
            Self::RefundOwner { .. } => "refund_owner",
        }
    }
    fn canonical_json(&self) -> String {
        let args = match self {
            Self::Delegate {
                parent_id,
                delegatee_id,
                amount,
                allowed_receivers,
                expires_at_ns,
                max_depth,
            } => {
                json!({ "parent_id": parent_id.to_string(), "delegatee_id": delegatee_id, "amount": amount.to_string(),
                    "allowed_receivers": allowed_receivers, "expires_at_ns": expires_at_ns.to_string(), "max_depth": max_depth })
            }
            Self::Spend {
                grant_id,
                receiver_id,
                amount,
            } => {
                json!({ "grant_id": grant_id.to_string(), "receiver_id": receiver_id, "amount": amount.to_string() })
            }
            Self::Reclaim { grant_id, amount } => {
                json!({ "grant_id": grant_id.to_string(), "amount": amount.to_string() })
            }
            Self::RefundOwner { amount } => json!({ "amount": amount.to_string() }),
        };
        canonical(json!({"method": self.method(), "args": args})).to_string()
    }
}

impl BudgetBranch {
    fn owner(&self, payable: bool) -> AccountId {
        if !payable {
            no_deposit();
        }
        let who = env::predecessor_account_id();
        require(
            who == self.owner_id && who == env::signer_account_id(),
            "ERR_AUTH",
        );
        who
    }
    fn chain(&self, id: u64) -> Vec<Grant> {
        let mut out = Vec::with_capacity(4);
        let mut current = grant(id);
        loop {
            require(
                current.depth <= 3 && current.depth <= current.max_depth && current.max_depth <= 3,
                "ERR_DEPTH",
            );
            if current.id == 0 {
                require(current.parent == 0 && current.depth == 0, "ERR_ARGUMENT");
                out.push(current);
                break;
            }
            require(current.depth > 0 && out.len() < 3, "ERR_DEPTH");
            let parent = grant(current.parent);
            require(
                parent.id < current.id && parent.depth.checked_add(1) == Some(current.depth),
                "ERR_ARGUMENT",
            );
            out.push(current);
            current = parent;
        }
        out
    }
    fn status(&self, id: u64) -> (&'static str, Option<String>) {
        let chain = self.chain(id);
        if let Some(g) = chain.iter().find(|g| g.revoked) {
            return ("revoked", Some(g.id.to_string()));
        }
        if let Some(g) = chain.iter().find(|g| env::block_timestamp() >= g.expires) {
            return ("expired", Some(g.id.to_string()));
        }
        ("active", None)
    }
    fn active_chain(&self, id: u64) -> Vec<Grant> {
        let chain = self.chain(id);
        require(!chain.iter().any(|g| g.revoked), "ERR_REVOKED");
        require(
            chain.iter().all(|g| env::block_timestamp() < g.expires),
            "ERR_EXPIRED",
        );
        chain
    }
    fn grant_view(&self, g: Grant) -> GrantView {
        let (effective_status, blocked_by) = self.status(g.id);
        GrantView {
            grant_id: g.id.to_string(),
            parent_id: if g.id == 0 {
                None
            } else {
                Some(g.parent.to_string())
            },
            delegatee_id: g.delegatee,
            depth: g.depth,
            max_depth: g.max_depth,
            allowed_receivers: g.receivers,
            expires_at_ns: g.expires.to_string(),
            revoked: g.revoked,
            effective_status,
            blocked_by,
            allocation: g.allocation.to_string(),
            free: g.free.to_string(),
            child_reserved: g.child_reserved.to_string(),
            pending: g.pending.to_string(),
            spent: g.spent.to_string(),
            returned: g.returned.to_string(),
        }
    }
    fn retry(&self, who: &AccountId, id: &str, intent: &Intent) -> Option<Request> {
        valid_request(id);
        let existing: Option<Request> = read(&request_key(who, id));
        if let Some(ref r) = existing {
            require(&r.intent == intent, "ERR_REQUEST_CONFLICT");
        }
        existing
    }
    fn record_request(
        &mut self,
        who: &AccountId,
        id: &str,
        intent: Intent,
        result_id: u64,
        recovery: bool,
    ) {
        if recovery {
            require(
                self.recovery_request_count < MAX_RECOVERY_REQUESTS,
                "ERR_CAPACITY",
            );
            self.recovery_request_count = count(self.recovery_request_count);
        } else {
            require(
                self.normal_request_count < MAX_NORMAL_REQUESTS,
                "ERR_CAPACITY",
            );
            self.normal_request_count = count(self.normal_request_count);
        }
        self.request_count = count(self.request_count);
        let fingerprint = env::sha256_array(intent.canonical_json().as_bytes());
        write(
            &request_key(who, id),
            &Request {
                intent,
                result_id,
                fingerprint,
            },
        );
    }
    fn storage_required(&self) -> u128 {
        u128::from(env::storage_usage())
            .checked_mul(env::storage_byte_cost().as_yoctonear())
            .unwrap_or_else(|| fail("ERR_OVERFLOW"))
    }
    fn remaining_recovery_bytes(&self) -> u64 {
        let payments = u64::from(
            MAX_REFUNDS
                .checked_sub(self.owner_refund_count)
                .unwrap_or_else(|| fail("ERR_OVERFLOW")),
        );
        let requests = u64::from(
            MAX_RECOVERY_REQUESTS
                .checked_sub(self.recovery_request_count)
                .unwrap_or_else(|| fail("ERR_OVERFLOW")),
        );
        payments
            .checked_mul(MAX_PAYMENT_STORAGE_BYTES)
            .and_then(|x| {
                requests
                    .checked_mul(MAX_RECOVERY_REQUEST_STORAGE_BYTES)
                    .and_then(|y| x.checked_add(y))
            })
            .unwrap_or_else(|| fail("ERR_OVERFLOW"))
    }
    fn recovery_reserve(&self) -> u128 {
        u128::from(self.remaining_recovery_bytes())
            .checked_mul(env::storage_byte_cost().as_yoctonear())
            .unwrap_or_else(|| fail("ERR_OVERFLOW"))
    }
    fn persist_and_check(&self, recovery_required: bool, outgoing: u128) {
        // All maps are raw writes. Persist root *before* measuring; SDK's later
        // wrapper write has precisely the same fixed-width bytes.
        env::state_write(self);
        let base = add(self.storage_required(), OPERATIONAL_BUFFER);
        let required = if recovery_required {
            add(base, self.recovery_reserve())
        } else {
            base
        };
        require(self.operational_funding >= required, "ERR_STORAGE_RESERVE");
        if outgoing > 0 {
            require(
                env::account_balance().as_yoctonear()
                    >= add(self.operational_funding.max(base), outgoing),
                "ERR_LIQUIDITY",
            );
        }
    }
    fn schedule(&self, payment: &Payment) {
        let promise = match payment.kind {
            PaymentKind::Spend => Promise::new(payment.receiver.clone()).function_call_weight(
                "receive_payment".to_string(),
                json!({"payment_id": payment.id.to_string()})
                    .to_string()
                    .into_bytes(),
                NearToken::from_yoctonear(payment.amount),
                RECEIVER_GAS,
                GasWeight(0),
            ),
            PaymentKind::OwnerRefund => Promise::new(self.owner_id.clone())
                .transfer(NearToken::from_yoctonear(payment.amount)),
        };
        // Do not return the Promise: the initiating return is the stable payment ID.
        promise
            .then(
                Promise::new(env::current_account_id()).function_call_weight(
                    "on_payment_result".to_string(),
                    json!({"payment_id": payment.id.to_string()})
                        .to_string()
                        .into_bytes(),
                    NearToken::from_yoctonear(0),
                    CALLBACK_GAS,
                    GasWeight(0),
                ),
            )
            .detach();
    }
    fn accept_payment(
        &mut self,
        g: &mut Grant,
        who: AccountId,
        request: String,
        receiver: AccountId,
        amount: u128,
        kind: PaymentKind,
        intent: Intent,
    ) -> PaymentResult {
        positive(amount);
        require(g.free >= amount, "ERR_INSUFFICIENT_FREE");
        let recovery = kind == PaymentKind::OwnerRefund;
        if recovery {
            require(self.owner_refund_count < MAX_REFUNDS, "ERR_CAPACITY");
            self.owner_refund_count = count(self.owner_refund_count);
        } else {
            require(self.spend_count < MAX_SPENDS, "ERR_CAPACITY");
            self.spend_count = count(self.spend_count);
        }
        self.payment_count = count(self.payment_count);
        let id = u64::from(self.payment_count);
        g.free = sub(g.free, amount);
        g.pending = add(g.pending, amount);
        save_grant(g);
        let payment = Payment {
            id,
            kind,
            grant: g.id,
            caller: who.clone(),
            request: request.clone(),
            receiver,
            amount,
            status: PaymentStatus::Pending,
            failure: FailureCode::None,
            created: env::block_timestamp(),
            settled: 0,
        };
        write(&record_key(b'p', id), &payment);
        self.record_request(&who, &request, intent, id, recovery);
        self.persist_and_check(true, amount);
        event("payment_pending", &payment.view());
        self.schedule(&payment);
        PaymentResult {
            payment_id: id.to_string(),
        }
    }
    fn page(&self, from: Option<String>, limit: Option<u32>, len: u32) -> (u64, u64) {
        let start = from.as_deref().map(number).unwrap_or(0);
        let limit = limit.unwrap_or(50);
        require((1..=50).contains(&limit), "ERR_ARGUMENT");
        let end = start.saturating_add(u64::from(limit)).min(u64::from(len));
        (start.min(u64::from(len)), end)
    }
}

#[near_bindgen]
impl BudgetBranch {
    #[init(ignore_state)]
    #[payable]
    pub fn new(
        owner_id: AccountId,
        allowed_receivers: Vec<AccountId>,
        expires_at_ns: String,
    ) -> Self {
        require(!env::state_exists(), "ERR_INIT");
        no_deposit();
        require(
            env::predecessor_account_id() == env::current_account_id()
                && env::signer_account_id() == env::current_account_id(),
            "ERR_INIT",
        );
        require(owner_id != env::current_account_id(), "ERR_AUTH");
        valid_receivers(&allowed_receivers);
        let expires = number(&expires_at_ns);
        require(env::block_timestamp() < expires, "ERR_EXPIRED");
        let contract = Self {
            owner_id: owner_id.clone(),
            operational_funding: env::account_balance().as_yoctonear(),
            grant_count: 1,
            payment_count: 0,
            request_count: 0,
            spend_count: 0,
            owner_refund_count: 0,
            normal_request_count: 0,
            recovery_request_count: 0,
        };
        save_grant(&Grant {
            id: 0,
            parent: 0,
            delegatee: owner_id,
            depth: 0,
            max_depth: 3,
            receivers: allowed_receivers,
            expires,
            revoked: false,
            allocation: 0,
            free: 0,
            child_reserved: 0,
            pending: 0,
            spent: 0,
            returned: 0,
        });
        contract.persist_and_check(false, 0);
        contract
    }

    #[payable]
    pub fn deposit(&mut self) -> BudgetView {
        self.owner(true);
        let amount = env::attached_deposit().as_yoctonear();
        require(amount > 0, "ERR_DEPOSIT");
        self.active_chain(0);
        let mut root = grant(0);
        root.allocation = add(root.allocation, amount);
        root.free = add(root.free, amount);
        save_grant(&root);
        self.persist_and_check(true, 0);
        event(
            "budget_deposited",
            &json!({"owner_id":self.owner_id,"amount":amount.to_string(),"funded":root.allocation.to_string()}),
        );
        self.get_budget()
    }

    #[payable]
    pub fn fund_operations(&mut self) -> BudgetView {
        self.owner(true);
        let amount = env::attached_deposit().as_yoctonear();
        require(amount > 0, "ERR_DEPOSIT");
        self.operational_funding = add(self.operational_funding, amount);
        self.persist_and_check(false, 0);
        event(
            "operations_funded",
            &json!({"owner_id":self.owner_id,"amount":amount.to_string(),"operational_funding":self.operational_funding.to_string()}),
        );
        self.get_budget()
    }

    #[payable]
    pub fn delegate(
        &mut self,
        parent_id: String,
        delegatee_id: AccountId,
        amount: String,
        allowed_receivers: Vec<AccountId>,
        expires_at_ns: String,
        max_depth: u8,
        request_id: String,
    ) -> GrantResult {
        let who = caller();
        let parent_id = number(&parent_id);
        let amount = crate::amount(&amount);
        let expires = number(&expires_at_ns);
        valid_receivers(&allowed_receivers);
        let intent = Intent::Delegate {
            parent_id,
            delegatee_id: delegatee_id.clone(),
            amount,
            allowed_receivers: allowed_receivers.clone(),
            expires_at_ns: expires,
            max_depth,
        };
        if let Some(r) = self.retry(&who, &request_id, &intent) {
            return GrantResult {
                grant_id: r.result_id.to_string(),
            };
        }
        let mut parent = grant(parent_id);
        require(parent.delegatee == who, "ERR_AUTH");
        positive(amount);
        require(delegatee_id != env::current_account_id(), "ERR_AUTH");
        let chain = self.active_chain(parent_id);
        let depth = parent
            .depth
            .checked_add(1)
            .unwrap_or_else(|| fail("ERR_OVERFLOW"));
        require(
            depth <= 3 && depth <= max_depth && max_depth <= 3,
            "ERR_DEPTH",
        );
        require(env::block_timestamp() < expires, "ERR_EXPIRED");
        for ancestor in &chain {
            require(
                expires <= ancestor.expires
                    && max_depth <= ancestor.max_depth
                    && allowed_receivers
                        .iter()
                        .all(|r| ancestor.receivers.binary_search(r).is_ok()),
                "ERR_WIDENING",
            );
        }
        require(parent.free >= amount, "ERR_INSUFFICIENT_FREE");
        require(self.grant_count < MAX_GRANTS, "ERR_CAPACITY");
        let id = u64::from(self.grant_count);
        self.grant_count = count(self.grant_count);
        parent.free = sub(parent.free, amount);
        parent.child_reserved = add(parent.child_reserved, amount);
        save_grant(&parent);
        let child = Grant {
            id,
            parent: parent_id,
            delegatee: delegatee_id,
            depth,
            max_depth,
            receivers: allowed_receivers,
            expires,
            revoked: false,
            allocation: amount,
            free: amount,
            child_reserved: 0,
            pending: 0,
            spent: 0,
            returned: 0,
        };
        save_grant(&child);
        self.record_request(&who, &request_id, intent, id, false);
        self.persist_and_check(true, 0);
        event(
            "grant_created",
            &json!({"caller_id":who,"request_id":request_id,"grant":self.grant_view(child)}),
        );
        GrantResult {
            grant_id: id.to_string(),
        }
    }

    #[payable]
    pub fn spend(
        &mut self,
        grant_id: String,
        receiver_id: AccountId,
        amount: String,
        request_id: String,
    ) -> PaymentResult {
        let who = caller();
        let grant_id = number(&grant_id);
        let amount = crate::amount(&amount);
        let intent = Intent::Spend {
            grant_id,
            receiver_id: receiver_id.clone(),
            amount,
        };
        if let Some(r) = self.retry(&who, &request_id, &intent) {
            return PaymentResult {
                payment_id: r.result_id.to_string(),
            };
        }
        let mut g = grant(grant_id);
        require(g.delegatee == who, "ERR_AUTH");
        positive(amount);
        for ancestor in self.active_chain(grant_id) {
            require(
                ancestor.receivers.binary_search(&receiver_id).is_ok(),
                "ERR_RECIPIENT",
            );
        }
        require(env::prepaid_gas() >= MIN_SPEND_GAS, "ERR_GAS");
        self.accept_payment(
            &mut g,
            who,
            request_id,
            receiver_id,
            amount,
            PaymentKind::Spend,
            intent,
        )
    }

    #[payable]
    pub fn revoke(&mut self, grant_id: String) -> GrantResult {
        let who = self.owner(false);
        let id = number(&grant_id);
        let mut g = grant(id);
        if !g.revoked {
            g.revoked = true;
            save_grant(&g);
            event(
                "grant_revoked",
                &json!({"caller_id":who,"grant_id":id.to_string()}),
            );
        }
        GrantResult {
            grant_id: id.to_string(),
        }
    }

    #[payable]
    pub fn reclaim(
        &mut self,
        grant_id: String,
        amount: String,
        request_id: String,
    ) -> ReclaimResult {
        let who = self.owner(false);
        let id = number(&grant_id);
        let amount = crate::amount(&amount);
        let intent = Intent::Reclaim {
            grant_id: id,
            amount,
        };
        if self.retry(&who, &request_id, &intent).is_some() {
            return ReclaimResult {
                grant_id: id.to_string(),
                amount: amount.to_string(),
            };
        }
        require(id != 0, "ERR_RECLAIM_ROOT");
        positive(amount);
        let mut g = grant(id);
        require(self.status(id).0 != "active", "ERR_RECLAIM_ACTIVE");
        require(g.free >= amount, "ERR_INSUFFICIENT_FREE");
        let mut parent = grant(g.parent);
        g.free = sub(g.free, amount);
        g.returned = add(g.returned, amount);
        parent.child_reserved = sub(parent.child_reserved, amount);
        parent.free = add(parent.free, amount);
        save_grant(&g);
        save_grant(&parent);
        self.record_request(&who, &request_id, intent, id, true);
        self.persist_and_check(true, 0);
        event(
            "grant_reclaimed",
            &json!({"caller_id":who,"request_id":request_id,"grant_id":id.to_string(),"parent_id":g.parent.to_string(),"amount":amount.to_string()}),
        );
        ReclaimResult {
            grant_id: id.to_string(),
            amount: amount.to_string(),
        }
    }

    #[payable]
    pub fn refund_owner(&mut self, amount: String, request_id: String) -> PaymentResult {
        let who = self.owner(false);
        let amount = crate::amount(&amount);
        let intent = Intent::RefundOwner { amount };
        if let Some(r) = self.retry(&who, &request_id, &intent) {
            return PaymentResult {
                payment_id: r.result_id.to_string(),
            };
        }
        require(env::prepaid_gas() >= MIN_REFUND_GAS, "ERR_GAS");
        let mut root = grant(0);
        self.accept_payment(
            &mut root,
            who,
            request_id,
            self.owner_id.clone(),
            amount,
            PaymentKind::OwnerRefund,
            intent,
        )
    }

    #[private]
    #[payable]
    pub fn on_payment_result(&mut self, payment_id: String) -> PaymentView {
        no_deposit();
        require(
            env::predecessor_account_id() == env::current_account_id(),
            "ERR_AUTH",
        );
        require(env::promise_results_count() == 1, "ERR_CALLBACK");
        let id = number(&payment_id);
        let mut payment: Payment =
            read(&record_key(b'p', id)).unwrap_or_else(|| fail("ERR_CALLBACK"));
        if payment.status != PaymentStatus::Pending {
            return payment.view();
        }
        let succeeded = match env::promise_result_checked(0, 0) {
            Ok(_) | Err(PromiseError::TooLong(_)) => true,
            Err(PromiseError::Failed) => false,
            Err(_) => fail("ERR_CALLBACK"),
        };
        let bytes_before = env::storage_usage();
        let mut g = grant(payment.grant);
        g.pending = sub(g.pending, payment.amount);
        if succeeded {
            payment.status = PaymentStatus::Succeeded;
            match payment.kind {
                PaymentKind::Spend => g.spent = add(g.spent, payment.amount),
                PaymentKind::OwnerRefund => g.returned = add(g.returned, payment.amount),
            }
        } else {
            payment.status = PaymentStatus::Failed;
            g.free = add(g.free, payment.amount);
            payment.failure = match payment.kind {
                PaymentKind::Spend => FailureCode::ReceiverFailed,
                PaymentKind::OwnerRefund => FailureCode::TransferFailed,
            };
        }
        payment.settled = env::block_timestamp();
        save_grant(&g);
        write(&record_key(b'p', id), &payment);
        require(env::storage_usage() == bytes_before, "ERR_STORAGE_RESERVE");
        let view = payment.view();
        event(
            if succeeded {
                "payment_succeeded"
            } else {
                "payment_failed"
            },
            &view,
        );
        view
    }

    pub fn get_budget(&self) -> BudgetView {
        let mut free = 0;
        let mut pending = 0;
        let mut spent = 0;
        for id in 0..u64::from(self.grant_count) {
            let g = grant(id);
            free = add(free, g.free);
            pending = add(pending, g.pending);
            spent = add(spent, g.spent);
        }
        let root = grant(0);
        let storage = self.storage_required();
        let protected = self
            .operational_funding
            .max(add(storage, OPERATIONAL_BUFFER));
        BudgetView {
            protocol_version: "0.1.0",
            owner_id: self.owner_id.clone(),
            root_id: "0",
            funded: root.allocation.to_string(),
            free: free.to_string(),
            pending: pending.to_string(),
            spent: spent.to_string(),
            returned: root.returned.to_string(),
            operational_funding: self.operational_funding.to_string(),
            operational_buffer: OPERATIONAL_BUFFER.to_string(),
            storage_required: storage.to_string(),
            recovery_storage_reserved: self.recovery_reserve().to_string(),
            physical_liquid: env::account_balance()
                .as_yoctonear()
                .saturating_sub(protected)
                .to_string(),
            grant_count: self.grant_count,
            payment_count: self.payment_count,
            request_count: self.request_count,
            spend_count: self.spend_count,
            owner_refund_count: self.owner_refund_count,
            normal_request_count: self.normal_request_count,
            recovery_request_count: self.recovery_request_count,
        }
    }
    pub fn get_grant(&self, grant_id: String) -> Option<GrantView> {
        read::<Grant>(&record_key(b'g', number(&grant_id))).map(|g| self.grant_view(g))
    }
    pub fn list_grants(&self, from_index: Option<String>, limit: Option<u32>) -> Vec<GrantView> {
        let (start, end) = self.page(from_index, limit, self.grant_count);
        (start..end).map(|id| self.grant_view(grant(id))).collect()
    }
    pub fn get_payment(&self, payment_id: String) -> Option<PaymentView> {
        read::<Payment>(&record_key(b'p', number(&payment_id))).map(|p| p.view())
    }
    pub fn list_payments(
        &self,
        from_index: Option<String>,
        limit: Option<u32>,
    ) -> Vec<PaymentView> {
        let (start, end) = self.page(from_index, limit, self.payment_count);
        (start..end)
            .map(|offset| {
                read::<Payment>(&record_key(b'p', offset + 1))
                    .unwrap_or_else(|| fail("ERR_NOT_FOUND"))
                    .view()
            })
            .collect()
    }
    pub fn get_request(&self, caller_id: AccountId, request_id: String) -> Option<RequestView> {
        valid_request(&request_id);
        read::<Request>(&request_key(&caller_id, &request_id)).map(|r| {
            let result = match &r.intent {
                Intent::Delegate { .. } => json!({"grant_id":r.result_id.to_string()}),
                Intent::Spend { .. } | Intent::RefundOwner { .. } => {
                    json!({"payment_id":r.result_id.to_string()})
                }
                Intent::Reclaim { grant_id, amount } => {
                    json!({"grant_id":grant_id.to_string(),"amount":amount.to_string()})
                }
            };
            RequestView {
                caller_id,
                request_id,
                fingerprint: r.fingerprint.iter().map(|b| format!("{b:02x}")).collect(),
                method: r.intent.method(),
                result,
            }
        })
    }
    pub fn get_snapshot(&self) -> SnapshotView {
        SnapshotView {
            block_height: env::block_height().to_string(),
            block_timestamp_ns: env::block_timestamp().to_string(),
            budget: self.get_budget(),
            grants: (0..u64::from(self.grant_count))
                .map(|id| self.grant_view(grant(id)))
                .collect(),
            payments: self.list_payments(
                Some(self.payment_count.saturating_sub(50).to_string()),
                Some(50),
            ),
        }
    }
}

#[cfg(test)]
mod tests;
