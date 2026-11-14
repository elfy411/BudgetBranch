//! Rust unit contexts only. Runtime receipts are covered by sandbox-tests.
use super::*;
use near_sdk::{
    PromiseResult,
    test_utils::{VMContextBuilder, get_created_receipts},
    testing_env,
};
use std::collections::HashMap;

const N: u128 = 1_000_000_000_000_000_000_000_000;
fn id(s: &str) -> AccountId {
    s.parse().unwrap()
}
fn context(who: &str, deposit: u128, time: u64, result: Option<PromiseResult>) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(id("budget.test.near"))
        .predecessor_account_id(id(who))
        .signer_account_id(id(if who == "budget.test.near" {
            "owner.test.near"
        } else {
            who
        }))
        .account_balance(NearToken::from_yoctonear(1000 * N))
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .storage_usage(env::storage_usage())
        .block_timestamp(time)
        .prepaid_gas(Gas::from_tgas(300));
    testing_env!(
        b.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        HashMap::default(),
        result.into_iter().collect()
    );
}
fn fixture() -> BudgetBranch {
    near_sdk::mock::with_mocked_blockchain(|b| {
        b.take_storage();
    });
    let mut b = VMContextBuilder::new();
    b.current_account_id(id("budget.test.near"))
        .predecessor_account_id(id("budget.test.near"))
        .signer_account_id(id("budget.test.near"))
        .account_balance(NearToken::from_yoctonear(100 * N))
        .block_timestamp(1)
        .prepaid_gas(Gas::from_tgas(300));
    testing_env!(b.build());
    let c = BudgetBranch::new(
        id("owner.test.near"),
        vec![id("accept.test.near"), id("reject.test.near")],
        "1000".into(),
    );
    context("owner.test.near", 0, 2, None);
    c
}
fn funded() -> BudgetBranch {
    let mut c = fixture();
    context("owner.test.near", 10 * N, 2, None);
    c.deposit();
    context("owner.test.near", 0, 3, None);
    c
}
fn delegate(c: &mut BudgetBranch, parent: &str, who: &str, n: u128, req: &str) -> String {
    c.delegate(
        parent.into(),
        id(who),
        n.to_string(),
        vec![id("accept.test.near"), id("reject.test.near")],
        "1000".into(),
        3,
        req.into(),
    )
    .grant_id
}
fn check(c: &BudgetBranch) {
    let mut all_free = 0;
    let mut all_pending = 0;
    let mut all_spent = 0;
    for i in 0..u64::from(c.grant_count) {
        let g = grant(i);
        let mut children = 0;
        for j in 1..u64::from(c.grant_count) {
            let child = grant(j);
            if child.parent == i {
                children = add(children, sub(child.allocation, child.returned));
            }
        }
        assert_eq!(g.child_reserved, children);
        assert_eq!(
            g.allocation,
            add(
                add(add(add(g.free, g.child_reserved), g.pending), g.spent),
                g.returned
            )
        );
        all_free = add(all_free, g.free);
        all_pending = add(all_pending, g.pending);
        all_spent = add(all_spent, g.spent);
    }
    let root = grant(0);
    assert_eq!(
        root.allocation,
        add(add(add(all_free, all_pending), all_spent), root.returned)
    );
}
fn error(code: &str, f: impl FnOnce()) {
    let e =
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)).expect_err("expected BB panic");
    let s = if let Some(s) = e.downcast_ref::<String>() {
        s.clone()
    } else if let Some(s) = e.downcast_ref::<&str>() {
        s.to_string()
    } else {
        format!("{e:?}")
    };
    assert!(s.contains(code), "wanted {code}, got {s}");
}

#[test]
fn full_ledger_scenario_with_failed_receipt_and_owner_refund() {
    let mut c = funded();
    let a = delegate(&mut c, "0", "agent-a.test.near", 6 * N, "a");
    let b = delegate(&mut c, "0", "agent-b.test.near", 4 * N, "b");
    context("agent-a.test.near", 0, 4, None);
    let child = delegate(&mut c, &a, "child.test.near", 4 * N, "child");
    check(&c);
    error("ERR_INSUFFICIENT_FREE", || {
        delegate(&mut c, &a, "child2.test.near", 4 * N, "child2");
    });
    context("child.test.near", 0, 5, None);
    let payment = c
        .spend(
            child.clone(),
            id("accept.test.near"),
            N.to_string(),
            "ok".into(),
        )
        .payment_id;
    assert_eq!(get_created_receipts().len(), 2);
    assert_eq!(c.get_budget().pending, N.to_string());
    check(&c);
    context(
        "budget.test.near",
        0,
        6,
        Some(PromiseResult::Successful(vec![])),
    );
    c.on_payment_result(payment);
    check(&c);
    context("child.test.near", 0, 7, None);
    let p = c
        .spend(
            child.clone(),
            id("reject.test.near"),
            N.to_string(),
            "reject".into(),
        )
        .payment_id;
    context("budget.test.near", 0, 8, Some(PromiseResult::Failed));
    c.on_payment_result(p);
    check(&c);
    context("owner.test.near", 0, 9, None);
    c.revoke(a.clone());
    context("agent-b.test.near", 0, 10, None);
    let p = c
        .spend(b, id("accept.test.near"), N.to_string(), "b-ok".into())
        .payment_id;
    context(
        "budget.test.near",
        0,
        11,
        Some(PromiseResult::Successful(vec![])),
    );
    c.on_payment_result(p);
    check(&c);
    context("owner.test.near", 0, 12, None);
    c.reclaim(child, (3 * N).to_string(), "child-back".into());
    c.reclaim(a, (5 * N).to_string(), "a-back".into());
    check(&c);
    let p = c
        .refund_owner((5 * N).to_string(), "owner-back".into())
        .payment_id;
    check(&c);
    context(
        "budget.test.near",
        0,
        13,
        Some(PromiseResult::Successful(vec![])),
    );
    c.on_payment_result(p);
    check(&c);
    let b = c.get_budget();
    assert_eq!(
        (b.free, b.pending, b.spent, b.returned),
        (
            (3 * N).to_string(),
            "0".into(),
            (2 * N).to_string(),
            (5 * N).to_string()
        )
    );
}

#[test]
fn callback_fixed_size_duplicate_and_successful_nonempty() {
    let mut c = funded();
    let p = c
        .spend(
            "0".into(),
            id("accept.test.near"),
            N.to_string(),
            "ok".into(),
        )
        .payment_id;
    let before = env::storage_usage();
    context(
        "budget.test.near",
        0,
        4,
        Some(PromiseResult::Successful(vec![b'x'; 65536])),
    );
    c.on_payment_result(p.clone());
    assert_eq!(env::storage_usage(), before);
    assert_eq!(c.get_budget().spent, N.to_string());
    context("budget.test.near", 0, 5, Some(PromiseResult::Failed));
    c.on_payment_result(p);
    assert_eq!(c.get_budget().spent, N.to_string());
    assert_eq!(env::storage_usage(), before);
    check(&c);
}

#[test]
fn revoke_pending_failure_restores_source_then_reclaim() {
    let mut c = funded();
    let a = delegate(&mut c, "0", "agent-a.test.near", 6 * N, "a");
    context("agent-a.test.near", 0, 4, None);
    let p = c
        .spend(
            a.clone(),
            id("reject.test.near"),
            N.to_string(),
            "reject".into(),
        )
        .payment_id;
    context("owner.test.near", 0, 5, None);
    c.revoke(a.clone());
    c.reclaim(a.clone(), (5 * N).to_string(), "free-only".into());
    assert_eq!(c.get_budget().pending, N.to_string());
    context("budget.test.near", 0, 6, Some(PromiseResult::Failed));
    c.on_payment_result(p);
    context("owner.test.near", 0, 7, None);
    c.reclaim(a, N.to_string(), "restored".into());
    assert_eq!(c.get_budget().free, (10 * N).to_string());
    check(&c);
}

#[test]
fn authenticated_replay_after_revocation_does_not_dispatch_again() {
    let mut c = funded();
    let a = delegate(&mut c, "0", "agent-a.test.near", 6 * N, "a");
    context("agent-a.test.near", 0, 4, None);
    let p = c
        .spend(
            a.clone(),
            id("accept.test.near"),
            N.to_string(),
            "same".into(),
        )
        .payment_id;
    context("owner.test.near", 0, 5, None);
    c.revoke(a.clone());
    context("agent-a.test.near", 0, 6, None);
    assert_eq!(
        c.spend(
            a.clone(),
            id("accept.test.near"),
            N.to_string(),
            "same".into()
        )
        .payment_id,
        p
    );
    assert!(get_created_receipts().is_empty());
    error("ERR_REQUEST_CONFLICT", || {
        c.spend(
            a.clone(),
            id("accept.test.near"),
            (2 * N).to_string(),
            "same".into(),
        );
    });
    error("ERR_REVOKED", || {
        c.spend(a, id("accept.test.near"), N.to_string(), "new".into());
    });
    check(&c);
}

#[test]
fn auth_ancestor_widening_and_exact_expiry() {
    let mut c = funded();
    let a = delegate(&mut c, "0", "agent-a.test.near", 6 * N, "a");
    error("ERR_AUTH", || {
        c.spend(
            a.clone(),
            id("accept.test.near"),
            "1".into(),
            "owner-bypass".into(),
        );
    });
    context("agent-a.test.near", 0, 4, None);
    error("ERR_WIDENING", || {
        c.delegate(
            a.clone(),
            id("child.test.near"),
            "1".into(),
            vec![id("alien.test.near")],
            "1000".into(),
            3,
            "wide".into(),
        );
    });
    error("ERR_WIDENING", || {
        c.delegate(
            a.clone(),
            id("child.test.near"),
            "1".into(),
            vec![id("accept.test.near")],
            "1001".into(),
            3,
            "expiry".into(),
        );
    });
    context("agent-a.test.near", 0, 1000, None);
    error("ERR_EXPIRED", || {
        c.spend(
            a.clone(),
            id("accept.test.near"),
            "1".into(),
            "expired".into(),
        );
    });
    assert_eq!(c.get_grant(a).unwrap().effective_status, "expired");
    check(&c);
}

#[test]
fn indirect_signer_and_forged_callback_are_denied() {
    let mut c = funded();
    let mut b = VMContextBuilder::new();
    b.current_account_id(id("budget.test.near"))
        .predecessor_account_id(id("proxy.test.near"))
        .signer_account_id(id("owner.test.near"))
        .prepaid_gas(Gas::from_tgas(300));
    testing_env!(b.build());
    error("ERR_AUTH", || {
        c.spend(
            "0".into(),
            id("accept.test.near"),
            "1".into(),
            "proxy".into(),
        );
    });
    error("ERR_AUTH", || {
        c.on_payment_result("1".into());
    });
    context("budget.test.near", 0, 5, None);
    error("ERR_CALLBACK", || {
        c.on_payment_result("1".into());
    });
}

#[test]
fn storage_schema_maxima_and_runtime_overhead() {
    let mut c = fixture();
    let who = id(&"a".repeat(64));
    let request = "R".repeat(64);
    let p = Payment {
        id: u64::MAX,
        kind: PaymentKind::OwnerRefund,
        grant: 0,
        caller: who.clone(),
        request: request.clone(),
        receiver: who.clone(),
        amount: u128::MAX,
        status: PaymentStatus::Pending,
        failure: FailureCode::None,
        created: u64::MAX,
        settled: 0,
    };
    assert_eq!(
        borsh::to_vec(&p).unwrap().len() as u64,
        MAX_PAYMENT_VALUE_BYTES
    );
    let r = Request {
        intent: Intent::Reclaim {
            grant_id: u64::MAX,
            amount: u128::MAX,
        },
        result_id: u64::MAX,
        fingerprint: [255; 32],
    };
    assert_eq!(
        borsh::to_vec(&r).unwrap().len() as u64,
        MAX_RECOVERY_REQUEST_VALUE_BYTES
    );
    assert_eq!(request_key(&who, &request).len(), 137);
    let before = env::storage_usage();
    write(&record_key(b'p', u64::MAX), &p);
    assert_eq!(env::storage_usage() - before, MAX_PAYMENT_STORAGE_BYTES);
    let before = env::storage_usage();
    write(&request_key(&who, &request), &r);
    assert_eq!(
        env::storage_usage() - before,
        MAX_RECOVERY_REQUEST_STORAGE_BYTES
    );
    let size = borsh::to_vec(&c).unwrap().len();
    c.grant_count = u32::MAX;
    c.request_count = u32::MAX;
    assert_eq!(size, borsh::to_vec(&c).unwrap().len());
    let terminal = Payment {
        status: PaymentStatus::Failed,
        failure: FailureCode::TransferFailed,
        settled: u64::MAX,
        ..p
    };
    assert_eq!(
        borsh::to_vec(&terminal).unwrap().len() as u64,
        MAX_PAYMENT_VALUE_BYTES
    );
}

#[test]
fn liquidity_guard_never_uses_logical_free_as_cash() {
    let mut c = funded();
    let mut b = VMContextBuilder::new();
    b.current_account_id(id("budget.test.near"))
        .predecessor_account_id(id("owner.test.near"))
        .signer_account_id(id("owner.test.near"))
        .account_balance(NearToken::from_yoctonear(c.operational_funding))
        .block_timestamp(5)
        .prepaid_gas(Gas::from_tgas(300));
    testing_env!(b.build());
    error("ERR_LIQUIDITY", || {
        c.spend(
            "0".into(),
            id("accept.test.near"),
            "1".into(),
            "cash-not-arrived".into(),
        );
    });
}

#[test]
fn recovery_reserve_decreases_only_for_recovery_slots() {
    let mut c = funded();
    let before = c.recovery_reserve();
    delegate(&mut c, "0", "agent-a.test.near", N, "a");
    assert_eq!(c.recovery_reserve(), before);
    c.refund_owner(N.to_string(), "return".into());
    let bytes = MAX_PAYMENT_STORAGE_BYTES + MAX_RECOVERY_REQUEST_STORAGE_BYTES;
    assert_eq!(
        before - c.recovery_reserve(),
        u128::from(bytes) * env::storage_byte_cost().as_yoctonear()
    );
}

#[test]
fn wire_integer_and_request_validation() {
    for s in [
        "",
        "01",
        "+1",
        " 1",
        "1.0",
        "1e1",
        "-1",
        "340282366920938463463374607431768211456",
    ] {
        error("ERR_ARGUMENT", || {
            amount(s);
        });
    }
    assert_eq!(amount(&u128::MAX.to_string()), u128::MAX);
    for s in ["", "a b", "é", &"a".repeat(65)] {
        error("ERR_REQUEST_ID", || valid_request(s));
    }
}

#[test]
fn golden_fingerprints_match_typescript_fixture() {
    let _ = fixture();
    let fixtures: Vec<Value> =
        serde_json::from_str(include_str!("../../fixtures/request-fingerprints.json")).unwrap();
    for f in fixtures {
        let a = &f["args"];
        let n = |key: &str| number(a[key].as_str().unwrap());
        let am = || amount(a["amount"].as_str().unwrap());
        let intent = match f["method"].as_str().unwrap() {
            "delegate" => Intent::Delegate {
                parent_id: n("parent_id"),
                delegatee_id: id(a["delegatee_id"].as_str().unwrap()),
                amount: am(),
                allowed_receivers: a["allowed_receivers"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|x| id(x.as_str().unwrap()))
                    .collect(),
                expires_at_ns: n("expires_at_ns"),
                max_depth: a["max_depth"].as_u64().unwrap() as u8,
            },
            "spend" => Intent::Spend {
                grant_id: n("grant_id"),
                receiver_id: id(a["receiver_id"].as_str().unwrap()),
                amount: am(),
            },
            "reclaim" => Intent::Reclaim {
                grant_id: n("grant_id"),
                amount: am(),
            },
            "refund_owner" => Intent::RefundOwner { amount: am() },
            _ => unreachable!(),
        };
        assert_eq!(intent.canonical_json(), f["canonical"].as_str().unwrap());
        let hex: String = env::sha256_array(intent.canonical_json().as_bytes())
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect();
        assert_eq!(hex, f["sha256"].as_str().unwrap());
    }
}

#[test]
fn callback_execution_failure_and_elapsed_time_never_release_pending() {
    let mut c = funded();
    let p = c
        .spend(
            "0".into(),
            id("accept.test.near"),
            N.to_string(),
            "no-result".into(),
        )
        .payment_id;
    context("budget.test.near", 0, 9_000_000, None);
    error("ERR_CALLBACK", || {
        c.on_payment_result(p.clone());
    });
    assert_eq!(c.get_payment(p).unwrap().status, "pending");
    assert_eq!(c.get_budget().pending, N.to_string());
    context("owner.test.near", 0, 9_000_001, None);
    c.revoke("0".into());
    error("ERR_INSUFFICIENT_FREE", || {
        c.refund_owner((10 * N).to_string(), "cannot-release-pending".into());
    });
    assert_eq!(c.get_budget().pending, N.to_string());
    check(&c);
}

#[test]
fn failed_owner_refund_restores_free_once() {
    let mut c = funded();
    let p = c
        .refund_owner(N.to_string(), "refund-fails".into())
        .payment_id;
    context("budget.test.near", 0, 4, Some(PromiseResult::Failed));
    let result = c.on_payment_result(p.clone());
    assert_eq!(result.status, "failed");
    assert_eq!(result.failure_code, Some("ERR_TRANSFER_FAILED"));
    context(
        "budget.test.near",
        0,
        5,
        Some(PromiseResult::Successful(vec![])),
    );
    c.on_payment_result(p);
    assert_eq!(c.get_budget().free, (10 * N).to_string());
    assert_eq!(c.get_budget().returned, "0");
    check(&c);
}

#[test]
fn checked_arithmetic_and_nearest_effective_status() {
    let mut c = funded();
    let a = delegate(&mut c, "0", "agent-a.test.near", N, "a");
    error("ERR_OVERFLOW", || {
        add(u128::MAX, 1);
    });
    error("ERR_OVERFLOW", || {
        sub(0, 1);
    });
    error("ERR_OVERFLOW", || {
        count(u32::MAX);
    });
    context("owner.test.near", 0, 1000, None);
    assert_eq!(c.get_grant(a.clone()).unwrap().blocked_by, Some(a.clone()));
    c.revoke("0".into());
    let g = c.get_grant(a).unwrap();
    assert_eq!(g.effective_status, "revoked");
    assert_eq!(g.blocked_by, Some("0".into()));
}

#[test]
fn pages_and_single_record_missing_values() {
    let mut c = funded();
    delegate(&mut c, "0", "agent-a.test.near", N, "a");
    assert_eq!(c.list_grants(Some("1".into()), Some(1))[0].grant_id, "1");
    assert!(
        c.list_grants(Some(u64::MAX.to_string()), Some(50))
            .is_empty()
    );
    assert!(c.get_grant("999".into()).is_none());
    assert!(c.get_payment("1".into()).is_none());
    error("ERR_ARGUMENT", || {
        c.list_grants(None, Some(0));
    });
    error("ERR_ARGUMENT", || {
        c.list_payments(None, Some(51));
    });
}
