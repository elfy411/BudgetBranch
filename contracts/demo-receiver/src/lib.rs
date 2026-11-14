//! The only supported v0.1 receiver: immutable synchronous code, no promises.
#[cfg(all(target_arch = "wasm32", not(near)))]
compile_error!("Missing --cfg near: run Cargo from contracts/ to load .cargo/config.toml");
use borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::{AccountId, PanicOnDefault, env, near_bindgen};
use serde::Serialize;

#[near_bindgen(contract_state)]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct DemoReceiver {
    admin_id: AccountId,
    budgetbranch_id: AccountId,
    accepting: bool,
    received: u128,
}

#[derive(Serialize)]
pub struct ReceiverState {
    admin_id: AccountId,
    budgetbranch_id: AccountId,
    accepting: bool,
    received: String,
}

fn require(ok: bool, code: &str) {
    if !ok {
        env::panic_str(&format!("BB:{code}"));
    }
}

#[near_bindgen]
impl DemoReceiver {
    #[init(ignore_state)]
    #[payable]
    pub fn new(admin_id: AccountId, budgetbranch_id: AccountId) -> Self {
        require(!env::state_exists(), "ERR_INIT");
        require(env::attached_deposit().is_zero(), "ERR_DEPOSIT");
        require(
            env::predecessor_account_id() == env::current_account_id()
                && env::signer_account_id() == env::current_account_id(),
            "ERR_INIT",
        );
        Self {
            admin_id,
            budgetbranch_id,
            accepting: true,
            received: 0,
        }
    }

    // Marked payable only to provide the frozen BB error code for nonzero deposit.
    #[payable]
    pub fn set_accepting(&mut self, accepting: bool) {
        require(env::attached_deposit().is_zero(), "ERR_DEPOSIT");
        require(
            env::predecessor_account_id() == self.admin_id
                && env::signer_account_id() == self.admin_id,
            "ERR_AUTH",
        );
        self.accepting = accepting;
    }

    #[payable]
    pub fn receive_payment(&mut self, payment_id: String) {
        require(
            env::predecessor_account_id() == self.budgetbranch_id,
            "ERR_AUTH",
        );
        require(!env::attached_deposit().is_zero(), "ERR_DEPOSIT");
        require(
            !payment_id.is_empty()
                && payment_id.len() <= 20
                && payment_id.bytes().all(|b| b.is_ascii_digit())
                && (payment_id == "0" || !payment_id.starts_with('0'))
                && payment_id.parse::<u64>().is_ok(),
            "ERR_ARGUMENT",
        );
        require(self.accepting, "ERR_RECEIVER_FAILED");
        let amount = env::attached_deposit().as_yoctonear();
        self.received = self
            .received
            .checked_add(amount)
            .unwrap_or_else(|| env::panic_str("BB:ERR_OVERFLOW"));
        // A synchronous unit return. This method never constructs a Promise.
        env::log_str(&format!("RECEIVER_ACCEPTED:{payment_id}:{}", amount));
    }

    pub fn get_state(&self) -> ReceiverState {
        ReceiverState {
            admin_id: self.admin_id.clone(),
            budgetbranch_id: self.budgetbranch_id.clone(),
            accepting: self.accepting,
            received: self.received.to_string(),
        }
    }
}
