//! Real compiled Wasm and native NEAR Sandbox. No financial state patches.
use anyhow::{Context, Result, ensure};
use near_workspaces::{
    Account, ContractState, Worker,
    network::Sandbox,
    operations::Function,
    result::ExecutionFinalResult,
    types::{Gas, NearToken},
};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{path::PathBuf, time::Duration};

const N: u128 = 1_000_000_000_000_000_000_000_000;
const EXPIRY: &str = "18446744073709551615";

struct Harness {
    worker: Worker<Sandbox>,
    owner: Account,
    bb: Account,
    accept: Account,
    reject: Account,
    records: Vec<Value>,
    evidence: PathBuf,
    receiver_hash: Vec<u8>,
}
fn amount(v: &Value, key: &str) -> u128 {
    v[key].as_str().unwrap().parse().unwrap()
}
async fn named_account(worker: &Worker<Sandbox>, label: &str) -> Result<Account> {
    let root = worker.root_account()?;
    let length = 64 - root.id().as_str().len() - 1;
    let name = format!("{label}{}", "a".repeat(length - label.len()));
    let account = root
        .create_subaccount(&name)
        .initial_balance(NearToken::from_near(100))
        .transact()
        .await?
        .into_result()?;
    ensure!(account.id().as_str().len() == 64);
    Ok(account)
}
fn receipt_evidence(label: &str, r: &ExecutionFinalResult) -> Value {
    json!({"label":label,"transaction_hash":r.outcome().transaction_hash.to_string(),"initial_success":r.is_success(),
        "total_gas_burnt":r.total_gas_burnt.as_gas().to_string(),
        "outcomes":r.outcomes().into_iter().map(|o|json!({
            "id":o.transaction_hash.to_string(),"block_hash":o.block_hash.to_string(),"executor_id":o.executor_id,
            "success":o.is_success(),"gas_burnt":o.gas_burnt.as_gas().to_string(),"tokens_burnt":o.tokens_burnt.as_yoctonear().to_string(),
            "receipt_ids":o.receipt_ids.iter().map(|x|x.to_string()).collect::<Vec<_>>(),"logs":o.logs,
            "status":format!("{:?}",o.clone().into_result())
        })).collect::<Vec<_>>()})
}
impl Harness {
    async fn new(mode: &str) -> Result<Self> {
        Self::new_with_balance(mode, 100).await
    }
    async fn new_with_balance(mode: &str, balance: u128) -> Result<Self> {
        ensure!(
            std::env::var("NEAR_SANDBOX_BIN_PATH").is_ok(),
            "Set NEAR_SANDBOX_BIN_PATH to the reviewed pinned native binary"
        );
        let worker = near_workspaces::sandbox().await?;
        let maximum = mode == "maximum-state";
        let owner = if maximum {
            named_account(&worker, "owner").await?
        } else {
            worker.dev_create_account().await?
        };
        let bb = if maximum {
            named_account(&worker, "budget").await?
        } else if balance == 100 {
            worker.dev_create_account().await?
        } else {
            worker
                .root_account()?
                .create_subaccount("budget")
                .initial_balance(NearToken::from_near(balance))
                .transact()
                .await?
                .into_result()?
        };
        let accept = if maximum {
            named_account(&worker, "accept").await?
        } else {
            worker.dev_create_account().await?
        };
        let reject = if maximum {
            named_account(&worker, "reject").await?
        } else {
            worker.dev_create_account().await?
        };
        let mut extras = vec![];
        if maximum {
            for i in 0..6 {
                extras.push(named_account(&worker, &format!("r{i}")).await?);
            }
        }
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .to_path_buf();
        let budget_wasm =
            std::fs::read(root.join("target/wasm32-unknown-unknown/release/budgetbranch.wasm"))?;
        let receiver_wasm =
            std::fs::read(root.join("target/wasm32-unknown-unknown/release/demo_receiver.wasm"))?;
        let mut h = Self {
            worker,
            owner,
            bb,
            accept,
            reject,
            records: vec![],
            evidence: root.join(format!("evidence/sandbox-{mode}.json")),
            receiver_hash: Sha256::digest(&receiver_wasm).to_vec(),
        };
        let mut receivers = vec![h.accept.id().clone(), h.reject.id().clone()];
        receivers.extend(extras.iter().map(|a| a.id().clone()));
        receivers.sort();
        let r=h.bb.batch(h.bb.id()).deploy(&budget_wasm)
            .call(Function::new("new").args_json(json!({"owner_id":h.owner.id(),"allowed_receivers":receivers,"expires_at_ns":EXPIRY})).gas(Gas::from_tgas(80)))
            .delete_key(h.bb.secret_key().public_key()).transact().await?;
        h.record("deploy-initialize-lock-budgetbranch", &r)?;
        r.into_result()?;
        let mut deployments = vec![
            ("accept".to_string(), h.accept.clone()),
            ("reject".to_string(), h.reject.clone()),
        ];
        deployments.extend(
            extras
                .into_iter()
                .enumerate()
                .map(|(i, a)| (format!("extra-{i}"), a)),
        );
        for (label, receiver) in deployments {
            let r = receiver
                .batch(receiver.id())
                .deploy(&receiver_wasm)
                .call(
                    Function::new("new")
                        .args_json(json!({"admin_id":h.owner.id(),"budgetbranch_id":h.bb.id()}))
                        .gas(Gas::from_tgas(50)),
                )
                .delete_key(receiver.secret_key().public_key())
                .transact()
                .await?;
            h.record(&format!("deploy-initialize-lock-{label}"), &r)?;
            r.into_result()?;
            h.verify_receiver(&receiver).await?;
        }
        let bb_keys = h.bb.view_access_keys().await?;
        ensure!(bb_keys.is_empty());
        let bb_state = h.bb.view_account().await?;
        ensure!(matches!(
            bb_state.contract_state,
            ContractState::LocalHash(_)
        ));
        let code = h.worker.view_code(h.bb.id()).await?;
        ensure!(Sha256::digest(&code) == Sha256::digest(&budget_wasm));
        h.records.push(json!({"label":"locked-contract-code","account_id":h.bb.id(),"access_keys":[],"code_reference_kind":"local",
            "code_reference":format!("{:?}",bb_state.contract_state),"wasm_sha256":format!("{:x}",Sha256::digest(&budget_wasm))}));
        let owner = h.owner.clone();
        let reject = h.reject.clone();
        let r = owner
            .call(reject.id(), "set_accepting")
            .args_json(json!({"accepting":false}))
            .gas(Gas::from_tgas(30))
            .transact()
            .await?;
        h.record("set-receiver-rejecting", &r)?;
        r.into_result()?;
        Ok(h)
    }
    fn flush(&self) -> Result<()> {
        std::fs::create_dir_all(self.evidence.parent().unwrap())?;
        std::fs::write(
            &self.evidence,
            serde_json::to_vec_pretty(&json!({"level":"NEAR Sandbox","mock":false,
            "sandbox_version":"2.14.0","sandbox_binary_sha256":"8e0e1521372b0fce801b7464078c1e95e5a25a0f92ad4b4241451c33fe9e5a2a",
            "records":self.records}))?,
        )?;
        Ok(())
    }
    fn record(&mut self, label: &str, r: &ExecutionFinalResult) -> Result<()> {
        self.records.push(receipt_evidence(label, r));
        self.flush()
    }
    async fn verify_receiver(&mut self, a: &Account) -> Result<()> {
        let keys = a.view_access_keys().await?;
        ensure!(keys.is_empty(), "Receiver has access keys");
        let details = a.view_account().await?;
        ensure!(
            matches!(details.contract_state, ContractState::LocalHash(_)),
            "Unsupported mutable or absent code reference"
        );
        let code = self.worker.view_code(a.id()).await?;
        ensure!(
            Sha256::digest(&code).to_vec() == self.receiver_hash,
            "Unreviewed receiver code"
        );
        let state: Value = a
            .view(a.id(), "get_state")
            .args_json(json!({}))
            .await?
            .json()?;
        ensure!(
            state["admin_id"] == self.owner.id().as_str()
                && state["budgetbranch_id"] == self.bb.id().as_str()
        );
        self.records.push(json!({"label":"locked-receiver","account_id":a.id(),"access_keys":[],"code_reference_kind":"local",
            "code_reference":format!("{:?}",details.contract_state),"wasm_sha256":format!("{:x}",Sha256::digest(&code)),"state":state}));
        self.flush()
    }
    async fn call(
        &mut self,
        label: &str,
        who: &Account,
        method: &str,
        args: Value,
        deposit: u128,
        gas: u64,
    ) -> Result<Value> {
        let r = who
            .call(self.bb.id(), method)
            .args_json(args)
            .deposit(NearToken::from_yoctonear(deposit))
            .gas(Gas::from_tgas(gas))
            .transact()
            .await?;
        self.record(label, &r)?;
        Ok(r.json().with_context(|| format!("{label} failed"))?)
    }
    async fn denied(
        &mut self,
        label: &str,
        who: &Account,
        method: &str,
        args: Value,
        code: &str,
    ) -> Result<()> {
        self.denied_options(label, who, method, args, code, 0, 150)
            .await
    }
    async fn denied_options(
        &mut self,
        label: &str,
        who: &Account,
        method: &str,
        args: Value,
        code: &str,
        deposit: u128,
        gas: u64,
    ) -> Result<()> {
        let before = self.snapshot().await?;
        let r = who
            .call(self.bb.id(), method)
            .args_json(args)
            .deposit(NearToken::from_yoctonear(deposit))
            .gas(Gas::from_tgas(gas))
            .transact()
            .await?;
        self.record(label, &r)?;
        ensure!(r.is_failure(), "{label} unexpectedly succeeded");
        ensure!(
            format!("{r:?}").contains(code),
            "{label}: wrong failure {r:?}"
        );
        let after = self.snapshot().await?;
        for key in ["grants", "payments"] {
            ensure!(before[key] == after[key], "{label} mutated {key}");
        }
        for key in [
            "funded",
            "free",
            "pending",
            "spent",
            "returned",
            "grant_count",
            "payment_count",
            "request_count",
        ] {
            ensure!(
                before["budget"][key] == after["budget"][key],
                "{label} mutated {key}"
            );
        }
        Ok(())
    }
    async fn view(&self, method: &str, args: Value) -> Result<Value> {
        Ok(self
            .worker
            .view(self.bb.id(), method)
            .args_json(args)
            .await?
            .json()?)
    }
    async fn snapshot(&self) -> Result<Value> {
        self.view("get_snapshot", json!({})).await
    }
    async fn checkpoint(&mut self, label: &str, expected: [u128; 4]) -> Result<()> {
        let s = self.snapshot().await?;
        check_invariants(&s)?;
        for (i, k) in ["free", "pending", "spent", "returned"].iter().enumerate() {
            ensure!(
                amount(&s["budget"], k) == expected[i],
                "{label} {k}: {}",
                s["budget"][k]
            );
        }
        self.records.push(json!({"label":label,"snapshot":s}));
        self.flush()
    }
    async fn payment(&mut self, id: &str, status: &str) -> Result<Value> {
        for _ in 0..100 {
            let p = self.view("get_payment", json!({"payment_id":id})).await?;
            if p["status"] != "pending" {
                ensure!(p["status"] == status, "Unexpected terminal payment {p}");
                return Ok(p);
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
        anyhow::bail!("Payment {id} remained pending; no artificial settlement applied")
    }
    async fn spend(
        &mut self,
        label: &str,
        who: &Account,
        grant: &str,
        receiver: &Account,
        n: u128,
        expected: &str,
    ) -> Result<String> {
        let before = receiver
            .view(receiver.id(), "get_state")
            .args_json(json!({}))
            .await?
            .json::<Value>()?;
        let r=self.call(label,who,"spend",json!({"grant_id":grant,"receiver_id":receiver.id(),"amount":n.to_string(),"request_id":label}),0,100).await?;
        let id = r["payment_id"].as_str().context("payment ID")?.to_string();
        let p = self.payment(&id, expected).await?;
        let after = receiver
            .view(receiver.id(), "get_state")
            .args_json(json!({}))
            .await?
            .json::<Value>()?;
        ensure!(
            amount(&after, "received")
                == amount(&before, "received") + if expected == "succeeded" { n } else { 0 }
        );
        self.records.push(json!({"label":format!("{label}-terminal"),"payment":p,"receiver_before":before,"receiver_after":after}));
        self.flush()?;
        Ok(id)
    }
    async fn delegate(
        &mut self,
        who: &Account,
        parent: &str,
        agent: &Account,
        n: u128,
        request: &str,
    ) -> Result<String> {
        let receivers =
            self.view("get_grant", json!({"grant_id":"0"})).await?["allowed_receivers"].clone();
        let r=self.call(request,who,"delegate",json!({"parent_id":parent,"delegatee_id":agent.id(),"amount":n.to_string(),
            "allowed_receivers":receivers,"expires_at_ns":EXPIRY,"max_depth":3,"request_id":request}),0,80).await?;
        Ok(r["grant_id"].as_str().context("grant id")?.into())
    }
}
fn check_invariants(snapshot: &Value) -> Result<()> {
    let grants = snapshot["grants"].as_array().context("grants")?;
    let mut free = 0;
    let mut pending = 0;
    let mut spent = 0;
    for g in grants {
        let local = ["free", "child_reserved", "pending", "spent", "returned"]
            .iter()
            .map(|k| amount(g, k))
            .sum::<u128>();
        ensure!(
            amount(g, "allocation") == local,
            "local equation failed: {g}"
        );
        let children = grants
            .iter()
            .filter(|c| c["parent_id"] == g["grant_id"])
            .map(|c| amount(c, "allocation") - amount(c, "returned"))
            .sum::<u128>();
        ensure!(
            amount(g, "child_reserved") == children,
            "child equation failed: {g}"
        );
        free += amount(g, "free");
        pending += amount(g, "pending");
        spent += amount(g, "spent");
    }
    let b = &snapshot["budget"];
    ensure!(amount(b, "funded") == free + pending + spent + amount(&grants[0], "returned"));
    ensure!(
        free == amount(b, "free") && pending == amount(b, "pending") && spent == amount(b, "spent")
    );
    Ok(())
}

async fn cycle() -> Result<()> {
    let mut h = Harness::new("cycle").await?;
    let owner = h.owner.clone();
    let accept = h.accept.clone();
    let reject = h.reject.clone();
    h.call("deposit-ten", &owner, "deposit", json!({}), 10 * N, 80)
        .await?;
    h.checkpoint("funded", [10 * N, 0, 0, 0]).await?;
    h.spend("cycle-accept", &owner, "0", &accept, N, "succeeded")
        .await?;
    h.checkpoint("accept-settled", [9 * N, 0, N, 0]).await?;
    h.spend("cycle-reject", &owner, "0", &reject, N, "failed")
        .await?;
    h.checkpoint("reject-settled", [9 * N, 0, N, 0]).await?;
    println!(
        "PASS real Sandbox cycle: compiled Wasm, locked receivers, accept+reject, private callbacks; evidence={}",
        h.evidence.display()
    );
    Ok(())
}
async fn full() -> Result<()> {
    let mut h = Harness::new("full").await?;
    let owner = h.owner.clone();
    let accept = h.accept.clone();
    let reject = h.reject.clone();
    let a = h.worker.dev_create_account().await?;
    let b = h.worker.dev_create_account().await?;
    let child = h.worker.dev_create_account().await?;
    let stranger = h.worker.dev_create_account().await?;
    h.call("deposit-ten", &owner, "deposit", json!({}), 10 * N, 80)
        .await?;
    h.checkpoint("step1", [10 * N, 0, 0, 0]).await?;
    let ga = h.delegate(&owner, "0", &a, 6 * N, "delegate-a").await?;
    let gb = h.delegate(&owner, "0", &b, 4 * N, "delegate-b").await?;
    h.checkpoint("step2", [10 * N, 0, 0, 0]).await?;
    let gc = h.delegate(&a, &ga, &child, 4 * N, "delegate-child").await?;
    h.checkpoint("step3", [10 * N, 0, 0, 0]).await?;
    let mut receivers = vec![accept.id(), reject.id()];
    receivers.sort();
    h.denied("step4-overallocation",&a,"delegate",json!({"parent_id":ga,"delegatee_id":stranger.id(),"amount":(4*N).to_string(),
        "allowed_receivers":receivers,"expires_at_ns":EXPIRY,"max_depth":3,"request_id":"overspend-child"}),"ERR_INSUFFICIENT_FREE").await?;
    h.spend("step5-accept", &child, &gc, &accept, N, "succeeded")
        .await?;
    h.checkpoint("step5", [9 * N, 0, N, 0]).await?;
    h.denied("step6-recipient",&child,"spend",json!({"grant_id":gc,"receiver_id":stranger.id(),"amount":N.to_string(),"request_id":"bad-recipient"}),"ERR_RECIPIENT").await?;
    h.spend("step7-reject", &child, &gc, &reject, N, "failed")
        .await?;
    h.checkpoint("step7", [9 * N, 0, N, 0]).await?;
    h.denied(
        "foreign-signer",
        &stranger,
        "spend",
        json!({"grant_id":gc,"receiver_id":accept.id(),"amount":"1","request_id":"foreign"}),
        "ERR_AUTH",
    )
    .await?;
    h.denied(
        "owner-no-bypass",
        &owner,
        "spend",
        json!({"grant_id":gc,"receiver_id":accept.id(),"amount":"1","request_id":"owner-bypass"}),
        "ERR_AUTH",
    )
    .await?;
    h.denied("widen-receiver",&a,"delegate",json!({"parent_id":ga,"delegatee_id":stranger.id(),"amount":"1", "allowed_receivers":[stranger.id()],"expires_at_ns":EXPIRY,"max_depth":3,"request_id":"wide"}),"ERR_WIDENING").await?;
    h.call(
        "step8-revoke",
        &owner,
        "revoke",
        json!({"grant_id":ga}),
        0,
        40,
    )
    .await?;
    h.checkpoint("step8", [9 * N, 0, N, 0]).await?;
    for (agent, grant, request) in [(&a, &ga, "revoked-a"), (&child, &gc, "revoked-child")] {
        h.denied(
            request,
            agent,
            "spend",
            json!({"grant_id":grant,"receiver_id":accept.id(),"amount":"1","request_id":request}),
            "ERR_REVOKED",
        )
        .await?;
        h.denied(&format!("{request}-delegate"),agent,"delegate",json!({"parent_id":grant,"delegatee_id":stranger.id(),"amount":"1", "allowed_receivers":receivers,"expires_at_ns":EXPIRY,"max_depth":3,"request_id":format!("{request}-delegate")}),"ERR_REVOKED").await?;
    }
    let replay=h.call("replay-after-revoke",&child,"spend",json!({"grant_id":gc,"receiver_id":accept.id(),"amount":N.to_string(),"request_id":"step5-accept"}),0,20).await?;
    ensure!(replay["payment_id"] == "1");
    h.denied(
        "payload-conflict",
        &child,
        "spend",
        json!({"grant_id":gc,"receiver_id":accept.id(),"amount":"1","request_id":"step5-accept"}),
        "ERR_REQUEST_CONFLICT",
    )
    .await?;
    h.spend("step9-sibling", &b, &gb, &accept, N, "succeeded")
        .await?;
    h.checkpoint("step9", [8 * N, 0, 2 * N, 0]).await?;
    h.call(
        "step10-child-reclaim",
        &owner,
        "reclaim",
        json!({"grant_id":gc,"amount":(3*N).to_string(),"request_id":"reclaim-child"}),
        0,
        80,
    )
    .await?;
    h.call(
        "step10-a-reclaim",
        &owner,
        "reclaim",
        json!({"grant_id":ga,"amount":(5*N).to_string(),"request_id":"reclaim-a"}),
        0,
        80,
    )
    .await?;
    h.checkpoint("step10", [8 * N, 0, 2 * N, 0]).await?;
    let r = h
        .call(
            "step11-refund",
            &owner,
            "refund_owner",
            json!({"amount":(5*N).to_string(),"request_id":"owner-refund"}),
            0,
            60,
        )
        .await?;
    h.payment(r["payment_id"].as_str().unwrap(), "succeeded")
        .await?;
    h.checkpoint("step11-final", [3 * N, 0, 2 * N, 5 * N])
        .await?;
    h.denied(
        "forged-private-callback",
        &stranger,
        "on_payment_result",
        json!({"payment_id":"1"}),
        "private",
    )
    .await?;
    println!(
        "PASS full real Sandbox scenario: free=3 pending=0 spent=2 returned=5; evidence={}",
        h.evidence.display()
    );
    Ok(())
}

async fn capacity() -> Result<()> {
    let mut h = Harness::new("capacity").await?;
    let owner = h.owner.clone();
    h.call("capacity-deposit", &owner, "deposit", json!({}), 10 * N, 80)
        .await?;
    let mut receivers = vec![h.accept.id().clone(), h.reject.id().clone()];
    receivers.sort();
    for start in (0..127).step_by(10) {
        let mut tx = owner.batch(h.bb.id());
        for index in start..(start + 10).min(127) {
            tx=tx.call(Function::new("delegate").args_json(json!({"parent_id":"0","delegatee_id":owner.id(),"amount":"1",
                "allowed_receivers":receivers,"expires_at_ns":EXPIRY,"max_depth":3,"request_id":format!("grant-{index:058}")})).gas(Gas::from_tgas(25)));
        }
        let r = tx.transact().await?;
        h.record(&format!("fill-grants-{start}"), &r)?;
        r.into_result()?;
    }
    h.denied(
        "grant-cap",
        &owner,
        "delegate",
        json!({"parent_id":"0","delegatee_id":owner.id(),"amount":"1","allowed_receivers":receivers,
        "expires_at_ns":EXPIRY,"max_depth":3,"request_id":"over-grants"}),
        "ERR_CAPACITY",
    )
    .await?;
    for start in (0..512).step_by(3) {
        let mut tx = owner.batch(h.bb.id());
        for index in start..(start + 3).min(512) {
            let receiver = if index % 2 == 0 {
                h.accept.id()
            } else {
                h.reject.id()
            };
            tx = tx.call(
                Function::new("spend")
                    .args_json(json!({"grant_id":"0","receiver_id":receiver,"amount":"1",
                "request_id":format!("spend-{index:058}")}))
                    .gas(Gas::from_tgas(100)),
            );
        }
        let r = tx.transact().await?;
        h.record(&format!("fill-spends-{start}"), &r)?;
        r.into_result()?;
        if start % 60 == 0 {
            println!(
                "capacity: {} / 512 real spends accepted",
                (start + 3).min(512)
            );
        }
    }
    for offset in (0..512).step_by(50) {
        let page = h
            .view(
                "list_payments",
                json!({"from_index":offset.to_string(),"limit":50}),
            )
            .await?;
        for p in page.as_array().unwrap() {
            let id = p["payment_id"].as_str().unwrap().parse::<u64>()?;
            ensure!(p["status"] == if id % 2 == 1 { "succeeded" } else { "failed" });
        }
    }
    let b = h.view("get_budget", json!({})).await?;
    ensure!(
        b["grant_count"] == 128
            && b["spend_count"] == 512
            && b["normal_request_count"] == 639
            && b["recovery_request_count"] == 0
    );
    ensure!(
        b["owner_refund_count"] == 0
            && b["recovery_storage_reserved"] == "13025280000000000000000000"
    );
    h.checkpoint("normal-capacity-saturated", [10 * N - 256, 0, 256, 0])
        .await?;
    h.denied(
        "spend-cap",
        &owner,
        "spend",
        json!({"grant_id":"0","receiver_id":h.accept.id(),"amount":"1","request_id":"over-spends"}),
        "ERR_CAPACITY",
    )
    .await?;
    h.call(
        "revoke-at-capacity",
        &owner,
        "revoke",
        json!({"grant_id":"0"}),
        0,
        30,
    )
    .await?;
    for start in (1..128).step_by(10) {
        let mut tx = owner.batch(h.bb.id());
        for id in start..(start + 10).min(128) {
            tx=tx.call(Function::new("reclaim").args_json(json!({"grant_id":id.to_string(),"amount":"1","request_id":format!("recovery-{id:055}")})).gas(Gas::from_tgas(25)));
        }
        let r = tx.transact().await?;
        h.record(&format!("recovery-reclaims-{start}"), &r)?;
        r.into_result()?;
    }
    let r = h
        .call(
            "recovery-refund-no-topup",
            &owner,
            "refund_owner",
            json!({"amount":(10*N-256).to_string(),"request_id":"recover-all"}),
            0,
            60,
        )
        .await?;
    h.payment(r["payment_id"].as_str().unwrap(), "succeeded")
        .await?;
    h.checkpoint("capacity-recovered", [0, 0, 256, 10 * N - 256])
        .await?;
    let final_budget = h.view("get_budget", json!({})).await?;
    ensure!(final_budget["operational_funding"] == b["operational_funding"]);
    ensure!(
        final_budget["normal_request_count"] == 639
            && final_budget["recovery_request_count"] == 128
            && final_budget["owner_refund_count"] == 1
    );
    println!(
        "PASS actual Sandbox normal capacity:128 grants,512 spends,639 normal requests; owner recovery completed with no topup; evidence={}",
        h.evidence.display()
    );
    Ok(())
}

async fn storage_boundary() -> Result<()> {
    let mut h = Harness::new_with_balance("storage-boundary", 5).await?;
    let owner = h.owner.clone();
    let initial = h.view("get_budget", json!({})).await?;
    let r = owner
        .call(h.bb.id(), "deposit")
        .args_json(json!({}))
        .deposit(NearToken::from_near(10))
        .gas(Gas::from_tgas(80))
        .transact()
        .await?;
    h.record("deposit-before-prepaid-recovery-denied", &r)?;
    ensure!(r.is_failure() && format!("{r:?}").contains("ERR_STORAGE_RESERVE"));
    h.checkpoint("deposit-rolled-back", [0, 0, 0, 0]).await?;
    let deficit = amount(&initial, "storage_required")
        + amount(&initial, "recovery_storage_reserved")
        + amount(&initial, "operational_buffer")
        - amount(&initial, "operational_funding");
    h.call(
        "fund-exact-operational-reserve",
        &owner,
        "fund_operations",
        json!({}),
        deficit,
        80,
    )
    .await?;
    let exact = h.view("get_budget", json!({})).await?;
    ensure!(
        amount(&exact, "operational_funding")
            == amount(&exact, "storage_required")
                + amount(&exact, "recovery_storage_reserved")
                + amount(&exact, "operational_buffer")
    );
    h.call(
        "deposit-after-exact-reserve",
        &owner,
        "deposit",
        json!({}),
        10 * N,
        80,
    )
    .await?;
    let mut receivers = vec![h.accept.id(), h.reject.id()];
    receivers.sort();
    h.denied("normal-growth-cannot-eat-recovery-reserve",&owner,"delegate",json!({"parent_id":"0","delegatee_id":owner.id(),"amount":"1",
        "allowed_receivers":receivers,"expires_at_ns":EXPIRY,"max_depth":3,"request_id":"no-storage"}),"ERR_STORAGE_RESERVE").await?;
    h.call(
        "revoke-at-exact-reserve",
        &owner,
        "revoke",
        json!({"grant_id":"0"}),
        0,
        30,
    )
    .await?;
    let r = h
        .call(
            "reserved-recovery-succeeds-without-extra-topup",
            &owner,
            "refund_owner",
            json!({"amount":(10*N).to_string(),"request_id":"all-back"}),
            0,
            60,
        )
        .await?;
    h.payment(r["payment_id"].as_str().unwrap(), "succeeded")
        .await?;
    h.checkpoint("exact-reserve-recovered", [0, 0, 0, 10 * N])
        .await?;
    ensure!(
        h.view("get_budget", json!({})).await?["operational_funding"]
            == exact["operational_funding"]
    );
    println!(
        "PASS actual Sandbox exact storage reserve boundary and recovery without extra topup; evidence={}",
        h.evidence.display()
    );
    Ok(())
}

async fn interleaving() -> Result<()> {
    let mut h = Harness::new("interleaving").await?;
    let owner = h.owner.clone();
    h.call(
        "interleaving-deposit",
        &owner,
        "deposit",
        json!({}),
        10 * N,
        80,
    )
    .await?;
    for (idx, receiver, expected) in [
        (1, h.accept.clone(), "succeeded"),
        (2, h.reject.clone(), "failed"),
    ] {
        let grant = h
            .delegate(&owner, "0", &owner, 2 * N, &format!("grant-{idx}"))
            .await?;
        let r=owner.batch(h.bb.id())
            .call(Function::new("spend").args_json(json!({"grant_id":grant,"receiver_id":receiver.id(),"amount":N.to_string(),"request_id":format!("inflight-{idx}")})).gas(Gas::from_tgas(100)))
            .call(Function::new("revoke").args_json(json!({"grant_id":grant})).gas(Gas::from_tgas(25)))
            .call(Function::new("reclaim").args_json(json!({"grant_id":grant,"amount":N.to_string(),"request_id":format!("free-before-callback-{idx}")})).gas(Gas::from_tgas(50)))
            .transact().await?;
        h.record(
            &format!("controlled-spend-revoke-partial-reclaim-{idx}"),
            &r,
        )?;
        ensure!(r.is_success());
        let initial = r
            .receipt_outcomes()
            .iter()
            .find(|o| o.logs.iter().any(|s| s.contains("payment_pending")))
            .context("initiating receipt")?;
        ensure!(
            initial.logs.len() == 3
                && initial.logs[0].contains("payment_pending")
                && initial.logs[1].contains("grant_revoked")
                && initial.logs[2].contains("grant_reclaimed")
        );
        let callback = r
            .receipt_outcomes()
            .iter()
            .find(|o| {
                o.logs.iter().any(|s| {
                    s.contains(if expected == "succeeded" {
                        "payment_succeeded"
                    } else {
                        "payment_failed"
                    })
                })
            })
            .context("callback receipt")?;
        ensure!(
            callback.block_hash != initial.block_hash,
            "Callback must execute in a later receipt block"
        );
        h.payment(&idx.to_string(), expected).await?;
        let after = h.view("get_grant", json!({"grant_id":grant})).await?;
        ensure!(
            after["effective_status"] == "revoked"
                && amount(&after, "pending") == 0
                && amount(&after, "returned") == N
        );
        if expected == "failed" {
            ensure!(amount(&after, "free") == N);
            h.call("reclaim-failure-restored-free",&owner,"reclaim",json!({"grant_id":grant,"amount":N.to_string(),"request_id":"after-failed-callback"}),0,80).await?;
        } else {
            ensure!(amount(&after, "spent") == N && amount(&after, "free") == 0);
        }
    }
    h.checkpoint("interleavings-conserved", [9 * N, 0, N, 0])
        .await?;
    println!(
        "PASS actual controlled spend -> revoke -> partial reclaim -> real callback (success and failure); evidence={}",
        h.evidence.display()
    );
    Ok(())
}

async fn negatives() -> Result<()> {
    let mut h = Harness::new("negatives").await?;
    let owner = h.owner.clone();
    let receiver = h.accept.clone();
    let stranger = h.worker.dev_create_account().await?;
    h.call("negative-deposit", &owner, "deposit", json!({}), 10 * N, 80)
        .await?;
    let g1 = h.delegate(&owner, "0", &owner, 6 * N, "depth1").await?;
    let g2 = h.delegate(&owner, &g1, &owner, 4 * N, "depth2").await?;
    let g3 = h.delegate(&owner, &g2, &owner, 2 * N, "depth3").await?;
    let mut receivers = vec![h.accept.id(), h.reject.id()];
    receivers.sort();
    h.denied("depth-four",&owner,"delegate",json!({"parent_id":g3,"delegatee_id":owner.id(),"amount":"1","allowed_receivers":receivers,"expires_at_ns":EXPIRY,"max_depth":3,"request_id":"depth4"}),"ERR_DEPTH").await?;
    for (label, wire, code) in [
        ("leading-zero", "01", "ERR_ARGUMENT"),
        ("zero", "0", "ERR_ZERO_AMOUNT"),
        (
            "overflow-input",
            "340282366920938463463374607431768211456",
            "ERR_ARGUMENT",
        ),
    ] {
        h.denied(
            label,
            &owner,
            "spend",
            json!({"grant_id":g3,"receiver_id":receiver.id(),"amount":wire,"request_id":label}),
            code,
        )
        .await?;
    }
    h.denied(
        "invalid-request",
        &owner,
        "spend",
        json!({"grant_id":g3,"receiver_id":receiver.id(),"amount":"1","request_id":"has space"}),
        "ERR_REQUEST_ID",
    )
    .await?;
    h.denied("missing-grant",&owner,"spend",json!({"grant_id":"18446744073709551615","receiver_id":receiver.id(),"amount":"1","request_id":"missing"}),"ERR_NOT_FOUND").await?;
    h.denied(
        "method-conflict",
        &owner,
        "refund_owner",
        json!({"amount":"1","request_id":"depth1"}),
        "ERR_REQUEST_CONFLICT",
    )
    .await?;
    h.denied_options(
        "nonpayable-spend",
        &owner,
        "spend",
        json!({"grant_id":g3,"receiver_id":receiver.id(),"amount":"1","request_id":"deposit"}),
        "ERR_DEPOSIT",
        1,
        100,
    )
    .await?;
    h.denied_options(
        "spend-gas-boundary",
        &owner,
        "spend",
        json!({"grant_id":g3,"receiver_id":receiver.id(),"amount":"1","request_id":"low-gas"}),
        "ERR_GAS",
        0,
        99,
    )
    .await?;
    h.denied_options(
        "refund-gas-boundary",
        &owner,
        "refund_owner",
        json!({"amount":"1","request_id":"low-refund-gas"}),
        "ERR_GAS",
        0,
        59,
    )
    .await?;
    h.denied("empty-deposit", &owner, "deposit", json!({}), "ERR_DEPOSIT")
        .await?;
    h.denied(
        "stranger-revoke",
        &stranger,
        "revoke",
        json!({"grant_id":g1}),
        "ERR_AUTH",
    )
    .await?;
    h.denied(
        "active-reclaim",
        &owner,
        "reclaim",
        json!({"grant_id":g3,"amount":"1","request_id":"active"}),
        "ERR_RECLAIM_ACTIVE",
    )
    .await?;
    h.denied(
        "root-reclaim",
        &owner,
        "reclaim",
        json!({"grant_id":"0","amount":"1","request_id":"root"}),
        "ERR_RECLAIM_ROOT",
    )
    .await?;
    let before = h.view("get_budget", json!({})).await?;
    let args =
        json!({"grant_id":g3,"receiver_id":receiver.id(),"amount":"1","request_id":"same-pending"});
    let r = owner
        .batch(h.bb.id())
        .call(
            Function::new("spend")
                .args_json(args.clone())
                .gas(Gas::from_tgas(100)),
        )
        .call(
            Function::new("spend")
                .args_json(args)
                .gas(Gas::from_tgas(30)),
        )
        .transact()
        .await?;
    h.record("exact-replay-during-pending", &r)?;
    r.clone().into_result()?;
    ensure!(
        r.logs()
            .iter()
            .filter(|s| s.contains("payment_pending"))
            .count()
            == 1
    );
    h.payment("1", "succeeded").await?;
    let after = h.view("get_budget", json!({})).await?;
    ensure!(after["payment_count"].as_u64() == before["payment_count"].as_u64().map(|x| x + 1));
    // Two distinct transactions race for a grant's last principal. Receipt
    // ordering is real; either winner is acceptable, but exactly one must win.
    let race_grant = h.delegate(&owner, "0", &owner, N, "race-grant").await?;
    let mut pending = vec![];
    for name in ["race-first", "race-second"] {
        pending.push((name,owner.call(h.bb.id(),"spend").args_json(json!({"grant_id":race_grant,"receiver_id":receiver.id(),"amount":N.to_string(),"request_id":name})).gas(Gas::from_tgas(100)).transact_async().await?));
    }
    let mut wins = 0;
    let mut losses = 0;
    for (name, tx) in pending {
        let r = tx.await?;
        h.record(name, &r)?;
        if r.is_success() {
            wins += 1;
        } else {
            ensure!(format!("{r:?}").contains("ERR_INSUFFICIENT_FREE"));
            losses += 1;
        }
    }
    ensure!(wins == 1 && losses == 1);
    h.checkpoint("direct-negatives-conserved", [9 * N - 1, 0, N + 1, 0])
        .await?;
    println!(
        "PASS actual direct negatives, gas bounds, depth4, replay while pending and distinct-request race; evidence={}",
        h.evidence.display()
    );
    Ok(())
}

async fn adversarial() -> Result<()> {
    let mut h = Harness::new("adversarial").await?;
    let owner = h.owner.clone();
    h.call(
        "adversarial-base-deposit",
        &owner,
        "deposit",
        json!({}),
        10 * N,
        80,
    )
    .await?;
    let proxy = h.worker.dev_create_account().await?;
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .to_path_buf();
    let code =
        std::fs::read(root.join("target/wasm32-unknown-unknown/release/test_adversary.wasm"))?;
    // The unsupported receiver's declared budget is a separate deployment used
    // only for the result-classification test, never the supported normal tree.
    let isolated = h.worker.dev_create_account().await?;
    let r = proxy
        .batch(proxy.id())
        .deploy(&code)
        .call(
            Function::new("new")
                .args_json(json!({"admin_id":owner.id(),"budgetbranch_id":isolated.id()}))
                .gas(Gas::from_tgas(50)),
        )
        .delete_key(proxy.secret_key().public_key())
        .transact()
        .await?;
    h.record("deploy-isolated-adversary", &r)?;
    r.into_result()?;
    let policy_error = h
        .verify_receiver(&proxy)
        .await
        .expect_err("unknown code must be refused");
    h.records.push(json!({"label":"deployment-policy-refuses-promise-capable-adversary","refused":true,"reason":policy_error.to_string(),"scope":"unsupported isolated test fixture"}));
    h.flush()?;
    let before = h.snapshot().await?;
    let r=owner.call(proxy.id(),"forward").args_json(json!({"contract_id":h.bb.id(),"method":"spend","args":{"grant_id":"0","receiver_id":h.accept.id(),"amount":"1","request_id":"forwarded"}})).gas(Gas::from_tgas(160)).transact().await?;
    h.record("forwarded-owner-signer-denied", &r)?;
    ensure!(r.is_failure() && format!("{r:?}").contains("ERR_AUTH"));
    let r = owner
        .call(proxy.id(), "forge_callback")
        .args_json(json!({"contract_id":h.bb.id(),"payment_id":"1"}))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;
    h.record("forged-callback-with-real-promise-result-denied", &r)?;
    ensure!(r.is_failure() && format!("{r:?}").contains("private"));
    let after = h.snapshot().await?;
    ensure!(before["grants"] == after["grants"] && before["payments"] == after["payments"]);
    let budget_code =
        std::fs::read(root.join("target/wasm32-unknown-unknown/release/budgetbranch.wasm"))?;
    let r=isolated.batch(isolated.id()).deploy(&budget_code).call(Function::new("new").args_json(json!({"owner_id":owner.id(),"allowed_receivers":[proxy.id()],"expires_at_ns":EXPIRY})).gas(Gas::from_tgas(80)))
        .delete_key(isolated.secret_key().public_key()).transact().await?;
    h.record("isolated-unsafe-allowlist-for-classifier-test-only", &r)?;
    r.into_result()?;
    h.bb = isolated;
    h.call("isolated-deposit", &owner, "deposit", json!({}), N, 80)
        .await?;
    let r=h.call("successful-malformed-65536-byte-return",&owner,"spend",json!({"grant_id":"0","receiver_id":proxy.id(),"amount":N.to_string(),"request_id":"malformed-large"}),0,100).await?;
    h.payment(r["payment_id"].as_str().unwrap(), "succeeded")
        .await?;
    h.checkpoint("nonempty-success-never-refunds", [0, 0, N, 0])
        .await?;
    let received: Value = proxy
        .view(proxy.id(), "get_state")
        .args_json(json!({}))
        .await?
        .json()?;
    ensure!(amount(&received, "received") == N);
    println!(
        "PASS actual forwarded identity, forged callback with dependency, policy refusal and successful malformed64KiB classification; evidence={}",
        h.evidence.display()
    );
    Ok(())
}

async fn refund_failure() -> Result<()> {
    let mut h = Harness::new("refund-failure").await?;
    let owner = h.owner.clone();
    h.call(
        "refund-failure-deposit",
        &owner,
        "deposit",
        json!({}),
        10 * N,
        80,
    )
    .await?;
    let tx = owner
        .call(h.bb.id(), "refund_owner")
        .args_json(json!({"amount":N.to_string(),"request_id":"deleted-owner"}))
        .gas(Gas::from_tgas(60))
        .transact_async()
        .await?;
    let deletion = owner.clone().delete_account(h.accept.id()).await?;
    h.record("delete-disposable-owner-before-refund-receipt", &deletion)?;
    deletion.into_result()?;
    let result = tx.await?;
    h.record("refund-to-deleted-owner", &result)?;
    result.into_result()?;
    let p = h.payment("1", "failed").await?;
    ensure!(p["failure_code"] == "ERR_TRANSFER_FAILED");
    h.checkpoint("native-transfer-failure-restores-free", [10 * N, 0, 0, 0])
        .await?;
    println!(
        "PASS actual native owner-refund transfer failure and successful callback restoring free; evidence={}",
        h.evidence.display()
    );
    Ok(())
}

async fn maximum_state() -> Result<()> {
    let mut h = Harness::new("maximum-state").await?;
    let owner = h.owner.clone();
    let accept = h.accept.clone();
    let reject = h.reject.clone();
    h.call("maximum-deposit", &owner, "deposit", json!({}), 10 * N, 80)
        .await?;
    let g1 = h
        .delegate(&owner, "0", &owner, 6 * N, &"a".repeat(64))
        .await?;
    let g2 = h
        .delegate(&owner, &g1, &owner, 4 * N, &"b".repeat(64))
        .await?;
    let g3 = h
        .delegate(&owner, &g2, &owner, 3 * N, &"c".repeat(64))
        .await?;
    let receivers =
        h.view("get_grant", json!({"grant_id":"0"})).await?["allowed_receivers"].clone();
    ensure!(receivers.as_array().unwrap().len() == 8);
    for start in (0..124).step_by(8) {
        let mut tx = owner.batch(h.bb.id());
        for i in start..(start + 8).min(124) {
            tx=tx.call(Function::new("delegate").args_json(json!({"parent_id":"0","delegatee_id":owner.id(),"amount":"1",
                "allowed_receivers":receivers,"expires_at_ns":EXPIRY,"max_depth":3,"request_id":format!("maximum-grant-{i:050}")})).gas(Gas::from_tgas(30)));
        }
        let r = tx.transact().await?;
        h.record(&format!("maximum-grants-{start}"), &r)?;
        r.into_result()?;
    }
    ensure!(h.view("get_budget", json!({})).await?["grant_count"] == 128);
    for (index, receiver, expected) in [(1, accept, "succeeded"), (2, reject, "failed")] {
        let before = h.bb.view_account().await?;
        let label = format!("maximum-payment-{index:048}");
        ensure!(label.len() == 64);
        h.spend(&label, &owner, &g3, &receiver, N, expected).await?;
        let after = h.bb.view_account().await?;
        ensure!(
            after.storage_usage - before.storage_usage == 614,
            "Maximum payment+spend-request storage: {}",
            after.storage_usage - before.storage_usage
        );
        h.records.push(json!({"label":format!("maximum-storage-measurement-{index}"),"growth_bytes":614,"payment_bytes":304,"spend_request_bytes":310,
            "grant_count":128,"source_depth":3,"receiver_count_per_ancestor":8,"account_id_bytes":64,"request_id_bytes":64,"callback_gas_reserved":"30000000000000"}));
        h.flush()?;
    }
    h.checkpoint("maximum-state-conserved", [9 * N, 0, N, 0])
        .await?;
    println!(
        "PASS actual max128 grants,depth3,8 receivers of64 bytes,64-byte request IDs and fixed-size callbacks; evidence={}",
        h.evidence.display()
    );
    Ok(())
}

async fn refund_order() -> Result<()> {
    let mut h = Harness::new("refund-order").await?;
    let owner = h.owner.clone();
    h.call(
        "refund-order-deposit",
        &owner,
        "deposit",
        json!({}),
        10 * N,
        80,
    )
    .await?;
    let r=owner.call(h.bb.id(),"spend").args_json(json!({"grant_id":"0","receiver_id":h.reject.id(),"amount":(10*N).to_string(),"request_id":"all-principal-rejected"})).gas(Gas::from_tgas(100)).transact().await?;
    h.record("all-principal-rejected", &r)?;
    r.clone().into_result()?;
    let mut callback_height = None;
    let mut refund_height = None;
    let mut timeline = vec![];
    for o in r.receipt_outcomes() {
        let block = h.worker.view_block().block_hash(o.block_hash).await?;
        let role = if o.logs.iter().any(|s| s.contains("payment_pending")) {
            "initiating"
        } else if o.logs.iter().any(|s| s.contains("payment_failed")) {
            callback_height = Some(block.height());
            "successful-failure-settlement-callback"
        } else if o.executor_id == *h.reject.id() {
            "failed-receiver"
        } else if o.executor_id == *h.bb.id() && o.is_success() {
            refund_height = Some(block.height());
            "protocol-attached-deposit-refund"
        } else {
            "protocol-gas-refund"
        };
        timeline.push(json!({"receipt_id":o.transaction_hash.to_string(),"executor_id":o.executor_id,"role":role,"height":block.height().to_string(),"timestamp_ns":block.timestamp().to_string(),"success":o.is_success()}));
    }
    let callback = callback_height.context("callback outcome")?;
    let refund = refund_height.context("protocol deposit refund outcome")?;
    h.payment("1", "failed").await?;
    h.checkpoint("rejected-principal-conserved", [10 * N, 0, 0, 0])
        .await?;
    let physical = h.view("get_budget", json!({})).await?;
    ensure!(amount(&physical, "physical_liquid") >= 10 * N);
    let later = refund > callback;
    h.records.push(json!({"label":"actual-refund-ordering","timeline":timeline,"callback_block":callback.to_string(),"refund_block":refund.to_string(),
        "refund_strictly_after_callback_block":later,"same_block_order_not_inferred":refund==callback,
        "delayed_window_dispatch_test":"not controlled in this native run; synthetic low-balance unit test independently verifies ERR_LIQUIDITY",
        "physical_liquid_after_protocol_refund":physical["physical_liquid"]}));
    h.flush()?;
    println!(
        "PASS actual failed receipt + protocol principal refund; callback block={callback}, refund block={refund}; later-block window reproduced={later}; evidence={}",
        h.evidence.display()
    );
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    match std::env::args().nth(1).as_deref().unwrap_or("cycle") {
        "cycle" => cycle().await,
        "full" => full().await,
        "capacity" => capacity().await,
        "storage-boundary" => storage_boundary().await,
        "interleaving" => interleaving().await,
        "negatives" => negatives().await,
        "adversarial" => adversarial().await,
        "refund-failure" => refund_failure().await,
        "maximum-state" => maximum_state().await,
        "refund-order" => refund_order().await,
        other => anyhow::bail!("Unknown suite {other}"),
    }
}
