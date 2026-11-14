# Third-party notices

The owner's **MIT OR Apache-2.0** choice applies to original BudgetBranch material. Libraries, fonts, copied notices and other external material retain their own copyright and license terms. This file does not relicense them.

## Browser distribution

The web build includes [THIRD_PARTY_NOTICES.txt](web/public/THIRD_PARTY_NOTICES.txt) and verbatim texts under `licenses/`. Vite copies these static files into `web/dist`; the JavaScript, CSS, HTML and five font assets are unchanged. Distribute the notices with those assets.

| Component | Exact version | Original license / retained notice |
| --- | --- | --- |
| React, React DOM | 19.3.1 | MIT; [original Meta Platforms notice](web/public/licenses/react-react-dom-scheduler-MIT.txt). |
| Scheduler | 0.28.0 | MIT; same unchanged copyright/license text as React. |
| Geist variable font | 5.3.0 | OFL-1.1; [original Geist Project Authors notice](web/public/licenses/geist-5.3.0-OFL.txt). Font software remains OFL, not BudgetBranch dual-license. |
| Vite | 8.3.8 | [Full upstream notices](web/public/licenses/vite-8.3.8-LICENSE.txt), retained for generated helpers; this does not imply every Vite build dependency ships in the browser. |
| Rolldown | 1.2.19 | [Original notice](web/public/licenses/rolldown-1.2.19-LICENSE.txt), including its existing upstream attribution. |

Geist is unmodified. The original font attribution is retained exactly; neither its name nor copyright holder has been replaced. The existing demo screenshot is a capture of BudgetBranch, with rendered typography, not a redistribution of font source under a new license.

## Contract Wasm components

The normal Wasm dependency graph includes **wee_alloc 0.4.5** and **memory_units 0.4.0**, both under **MPL-2.0**. Their terms remain distinct from the MIT/Apache choice for BudgetBranch's original files. No source modifications to these dependencies are included in this project.

If redistributing a compiled Wasm artifact, accompany it with the applicable dependency notices/license texts and inform recipients how to obtain the corresponding MPL-covered source. Exact published source packages:

- [wee_alloc 0.4.5 source](https://static.crates.io/crates/wee_alloc/wee_alloc-0.4.5.crate)
- [memory_units 0.4.0 source](https://static.crates.io/crates/memory_units/memory_units-0.4.0.crate)

Their checksums are pinned in [Cargo.lock](contracts/Cargo.lock). Verbatim [wee_alloc MPL text](third_party/licenses/cargo/wee_alloc-0.4.5/LICENSE) and [memory_units MPL text](third_party/licenses/cargo/memory_units-0.4.0/LICENSE), plus legal texts for all36 normal target crates, are retained with a [notice manifest](docs/evidence/licenses/wasm-notice-manifest.json). Exact source/license provenance is recorded in the [license review](docs/LICENSE_REVIEW.md). The repository currently distributes source and test evidence; it does not track Wasm binaries. A compiled artifact must not be described as solely MIT/Apache with third-party conditions discarded.

## Build and test dependencies

The [npm inventory](docs/evidence/licenses/npm-inventory.json) records all 57 unique external packages across 59 lockfile occurrences. It distinguishes registry declarations for uninstalled platform variants from locally inspected package notice files. Retained npm texts are under [third_party/licenses/npm](third_party/licenses/npm).

Lightning CSS 1.33.0 and its platform variants are MPL-2.0 build tools, separate from the browser runtime. Rust build/test dependencies also include licenses and combined expressions beyond MIT/Apache; their original notices and any `AND` conditions remain applicable. See the [Cargo and resource review](docs/LICENSE_REVIEW.md) for the exact scope, source availability, special notices and the unresolved upstream near-sandbox license-file inconsistency.

Dependency/tool downloads occur through the pinned upstream distribution paths. Project caches, `node_modules`, native Sandbox and Rust/Node installations are not part of this Git source distribution. This review is not a complete SBOM or redistribution clearance for a future bundle of those native tools.

## Project attribution

Original work is credited collectively as **Copyright © 2026 BudgetBranch contributors**. This does not invent an individual's legal name or a company. [Development provenance](docs/ATTRIBUTIONS.md) describes project code, development assistance, external libraries and actual demo evidence. Copied third-party copyright statements identify their original holders and remain unchanged.
