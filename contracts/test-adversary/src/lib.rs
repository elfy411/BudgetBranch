//! UNSUPPORTED ADVERSARIAL FIXTURE. Never allowlisted by the normal deployment
//! policy. Used only to prove forwarded identity, forged callbacks and successful
//! nonempty runtime results. The Promise-chain trap mode demonstrates why its
//! code must be refused by the fixture, even after its account keys are removed.
#[cfg(all(target_arch = "wasm32", not(near)))]
compile_error!("Missing --cfg near: run Cargo from contracts/ to load .cargo/config.toml");
use borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::{AccountId, Gas, GasWeight, NearToken, PanicOnDefault, Promise, env, near_bindgen};
use serde_json::{Value, json};

#[near_bindgen(contract_state)]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Adversary {
    admin: AccountId,
    budget: AccountId,
    received: u128,
    promise_trap: bool,
}

#[near_bindgen]
impl Adversary {
    #[init]
    pub fn new(admin_id: AccountId, budgetbranch_id: AccountId) -> Self {
        assert_eq!(env::predecessor_account_id(), env::current_account_id());
        assert_eq!(env::signer_account_id(), env::current_account_id());
        Self {
            admin: admin_id,
            budget: budgetbranch_id,
            received: 0,
            promise_trap: false,
        }
    }
    pub fn forward(&self, contract_id: AccountId, method: String, args: Value) -> Promise {
        Promise::new(contract_id).function_call_weight(
            method,
            args.to_string().into_bytes(),
            NearToken::from_yoctonear(0),
            Gas::from_tgas(120),
            GasWeight(0),
        )
    }
    pub fn forge_callback(&self, contract_id: AccountId, payment_id: String) -> Promise {
        Promise::new(env::current_account_id())
            .function_call_weight(
                "noop",
                b"{}".to_vec(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(10),
                GasWeight(0),
            )
            .then(Promise::new(contract_id).function_call_weight(
                "on_payment_result",
                json!({"payment_id":payment_id}).to_string().into_bytes(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(30),
                GasWeight(0),
            ))
    }
    pub fn noop(&self) {}
    pub fn fail(&self) {
        env::panic_str("ADVERSARIAL_DOWNSTREAM_FAILURE");
    }
    pub fn set_trap(&mut self, promise_trap: bool) {
        assert_eq!(env::predecessor_account_id(), self.admin);
        assert_eq!(env::signer_account_id(), self.admin);
        self.promise_trap = promise_trap;
    }
    pub fn get_state(&self) -> Value {
        json!({"admin_id":self.admin,"budgetbranch_id":self.budget,"received":self.received.to_string(),"promise_trap":self.promise_trap})
    }
}

// Raw export intentionally returns malformed non-JSON, oversized successful
// bytes, exercising the runtime result classification without JSON decoders.
#[unsafe(no_mangle)]
pub extern "C" fn receive_payment() {
    env::setup_panic_hook();
    let mut state: Adversary = env::state_read().unwrap();
    assert_eq!(env::predecessor_account_id(), state.budget);
    let deposit = env::attached_deposit().as_yoctonear();
    assert!(deposit > 0);
    state.received = state.received.checked_add(deposit).unwrap();
    env::state_write(&state);
    if state.promise_trap {
        Promise::new(env::current_account_id())
            .function_call_weight(
                "fail",
                b"{}".to_vec(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(5),
                GasWeight(0),
            )
            .as_return()
            .detach();
    } else {
        env::value_return(&vec![b'x'; 65_536]);
    }
}
