"""Summarize already executed evidence; this script does not run or simulate tests."""
from pathlib import Path
import hashlib
import json
import platform
import re

root = Path(__file__).resolve().parent.parent
evidence = root / "evidence"
suites = ["cycle", "full", "capacity", "storage-boundary", "interleaving", "negatives",
          "adversarial", "refund-failure", "maximum-state", "refund-order"]
wasm = {}
for name in ["budgetbranch", "demo_receiver", "test_adversary"]:
    path = root / "target/wasm32-unknown-unknown/release" / f"{name}.wasm"
    wasm[path.name] = {"sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "size_bytes": path.stat().st_size}

results = {}
for suite in suites:
    data = json.loads((evidence / f"sandbox-{suite}.json").read_text())
    records = data["records"]
    run = json.loads((evidence / f"{suite}-run.json").read_text())
    assert run["exit_code"] == 0, f"Unsuccessful run: {suite}"
    assert "PASS " in (evidence / f"{suite}-run.log").read_text(), f"No completed run output for {suite}"
    code = next(r for r in records if r["label"] == "locked-contract-code")
    assert code["wasm_sha256"] == wasm["budgetbranch.wasm"]["sha256"], f"Stale budget Wasm evidence: {suite}"
    for receiver in (r for r in records if r["label"] == "locked-receiver"):
        assert receiver["wasm_sha256"] == wasm["demo_receiver.wasm"]["sha256"], f"Stale receiver Wasm evidence: {suite}"
    callbacks = [int(o["gas_burnt"]) for r in records for o in r.get("outcomes", [])
                 if any('"event":"payment_succeeded"' in s or '"event":"payment_failed"' in s for s in o["logs"])]
    results[suite] = {"exit_code": 0, "level": "real native NEAR Sandbox", "records": len(records),
                      "initial_transaction_failures": sum(r.get("initial_success") is False for r in records),
                      "all_outcome_failures": sum(not o["success"] for r in records for o in r.get("outcomes", [])),
                      "settlement_callback_receipts": len(callbacks), "max_callback_gas": str(max(callbacks, default=0)),
                      "evidence": f"evidence/sandbox-{suite}.json", "execution": f"evidence/{suite}-run.json"}
unit_output = (evidence / "unit-tests.log").read_text()
match = re.search(r"test result: ok\. (\d+) passed; (\d+) failed", unit_output)
assert match and match.group(2) == "0", "No successful unit run"
(evidence / "unit-tests.txt").write_text(unit_output.rstrip() + "\n")
(evidence / "wasm-build.txt").write_text((evidence / "wasm-build.log").read_text().rstrip() + "\n")
source_paths = [p for p in root.rglob("*.rs") if "target" not in p.parts]
source_paths += [p for p in root.rglob("*.toml") if "target" not in p.parts]
source_paths += [root / "Cargo.lock", root / "fixtures/request-fingerprints.json"]
source_hashes = {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(source_paths)}
ordering = next(r for r in json.loads((evidence / "sandbox-refund-order.json").read_text())["records"]
                if r["label"] == "actual-refund-ordering")
summary = {"status": "M1 implementation evidence; independent QA and owner G1 pending", "platform": platform.platform(),
           "rustc": "1.95.0 (59807616e 2026-04-14)", "near_sdk": "5.30.1", "near_workspaces": "0.24.0",
           "sandbox": {"version": "2.14.0", "protocol": 88, "binary_sha256": "8e0e1521372b0fce801b7464078c1e95e5a25a0f92ad4b4241451c33fe9e5a2a"},
           "unit_contexts": {"exit_code": 0, "passed": int(match.group(1)), "failed": 0}, "sandbox_suites": results,
           "max_measured_callback_gas": str(max(int(r["max_callback_gas"]) for r in results.values())),
           "callback_prepaid_gas": "30000000000000", "wasm": wasm, "source_sha256": source_hashes,
           "refund_ordering": ordering, "remaining_gaps": [
               "A dispatch in a real delayed-refund liquidity window was not controlled; low-cash ERR_LIQUIDITY is unit-context evidence.",
               "Exact timestamp expiry, authenticated duplicate callback and callback execution failure use unit contexts.",
               "Independent QA has not approved this implementation. No Testnet execution."],
           "expected_build_failure": {"case": "build from repository root without cfg(near)", "exit_code": 101,
                                      "evidence": "evidence/missing-cfg-build.txt"}}
(evidence / "m1-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
print(f"Summarized {len(suites)} real Sandbox suites and {match.group(1)} unit contexts; max callback gas={summary['max_measured_callback_gas']}")
