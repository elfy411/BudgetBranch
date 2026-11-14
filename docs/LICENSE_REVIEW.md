# License and dependency provenance

Original BudgetBranch material is licensed **MIT OR Apache-2.0**. Upstream components keep their own terms. This engineering inventory concerns source-checkout distribution; it is not legal clearance for an arbitrary binary/tool bundle.

The [Cargo inventory](evidence/licenses/cargo-inventory.json) records 438 locked registry crates and dependency scope; the [npm inventory](evidence/licenses/npm-inventory.json) records 57 unique external packages across 59 lockfile occurrences. [Wasm notice manifest](evidence/licenses/wasm-notice-manifest.json) binds 69 retained legal files to the 36 normal Wasm target libraries. These inventories are edited publication extracts with internal cache locations removed; source archive hashes and legal provenance are retained. Current digests and transformations are in the [evidence manifest](evidence/manifest.json).

## Conditions retained

- **MPL-2.0:** deployed `wee_alloc 0.4.5` and `memory_units 0.4.0` remain MPL-covered. Compiled redistribution must preserve applicable notices and provide corresponding covered source under MPL, including modifications. Exact source packages and checksums are linked in [Third-party notices](../THIRD_PARTY_NOTICES.md). Separable original project files retain their own license.
- **OFL-1.1:** the unmodified Geist font retains its actual copyright and OFL text in the web distribution. It is not relicensed under the project license.
- **MIT/BSD/ISC/Zlib/Apache and combined expressions:** retain upstream notices and relevant conditions; an OR choice and an AND obligation are not interchangeable.
- **MPL build tools:** Lightning CSS and platform packages retain their terms, distinct from the browser runtime.

## Unresolved host-library ambiguity

The exact `near-sandbox 0.4.1` host launcher source declares MIT OR Apache-2.0 and contains both texts, but also contains a root GPLv3 LICENSE without a clear scope statement found by the review. All three [upstream texts](evidence/licenses/notices) are retained unchanged. The project license does not resolve that ambiguity. No ready-made launcher or native tool is bundled; any future binary distribution requires a separate review.

Other host notices include security-framework APSL-related documentation attribution, ring/AWS-LC mixed notices, cfg_aliases attribution and certificate-data licenses. Their retained [notice files](evidence/licenses/notices) preserve the actual upstream language. The inventory reports missing standalone packaged texts and the limits of source-header sampling; it is not an exhaustive copyright audit.

All files under `third_party/licenses/` and `web/public/licenses/` and the retained host notice directory preserve upstream bytes. The source distribution contains no downloaded tools, caches, node_modules or compiled Wasm. Authorship and reused components are described in [Attribution](ATTRIBUTIONS.md). Open [dependency warnings](DEPENDENCY_REVIEW.md) remain unchanged.
