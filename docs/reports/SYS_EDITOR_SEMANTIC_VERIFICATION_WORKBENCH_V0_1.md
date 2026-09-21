# Sys Editor Semantic Verification Workbench v0.1 Report

WORKBENCH_RESULT:
PLATFORM_VERIFICATION_CONTRACT_GAP

DATA_PROVIDER:
`ISysVerificationDataProvider` (`src/vs/workbench/contrib/sys/browser/sysVerificationProviderService.ts`) with two implementations emitting the identical `VerificationProject` contract: `FixtureVerificationDataProvider` (registered) and `LivePlatformVerificationDataProvider` (present, not registered — returns `PLATFORM_CONTRACT_GAP` with empty rules). No semantic behavior lives in either provider.

UI_CONTRACT:
`src/vs/workbench/contrib/sys/common/sysVerification.ts` defines `VerificationProject -> VerificationRule -> VerificationObligation`, each obligation carrying `disposition`, `governed`/`recovered` (`VerificationSemanticView` with `summary`/`expression`/`evidence`/`provenance`), `why`, `reasons`, `completeness`, and `anchors`. Matches the mission's suggested shape; no new schema was introduced beyond it.

LIVE_PLATFORM_FIELDS:
None of the fields this workbench needs are exposed live today (unchanged from the prior platform integration pass): no governed rule id/list, no obligation-level disposition, no governed/recovered semantic objects, no proof/reason codes, no provenance, no completeness, no evidence, no source/spec anchors.

MISSING_PLATFORM_FIELDS:
governedRuleId, ruleDisposition, obligationDisposition, governedSemanticObject, recoveredSemanticObject, proofReasonCodes, provenance, completeness, evidence, sourceAnchors, specAnchors — recorded verbatim in `LIVE_PLATFORM_CONTRACT_GAP_PROJECT.missingPlatformFields`.

RULE_LIST:
Implemented in `SysVerificationWorkbenchView` (`browser/sysVerificationWorkbenchView.ts`), registered as a second view ("Verification") in the existing Sys view container. Renders id, title, and an aggregate-disposition badge per rule; selecting a row expands its obligations inline.

DETAIL_VIEW:
Per obligation: Governed / Recovered / Verification tab switcher (`_renderSemanticView`, `_renderVerification`) plus an always-visible Evidence / Navigation section (`_renderEvidenceAndNavigation`). Governed and Recovered summaries carry a `SPECIFIED`/`DERIVED` provenance badge so specified and derived meaning are never visually conflated.

OBLIGATION_VIEW:
Obligations expand/collapse independently. B8's aggregate `CONFLICTED` is rendered with an explicit note that the aggregate does not imply any sub-obligation's disposition, and the synced `EFFECT` obligation is never hidden or relabeled by the conflicted aggregate.

B2_DEMO:
B2 renders governed `DistinctBy(requestedSeats, Seat.id)` against recovered `ExistsDuplicateBy(requestedSeats, Seat.id)` with the bounded existential witness lines, and the Verification tab shows the polarity relation plus the `SYNCED` verdict. Source anchor points at `BookingService.hasDuplicate`.

B8_DEMO:
Aggregate `CONFLICTED`; guard obligation `WRONG_OPERATION_SCOPE` (reason `NOT_OBSERVED_IN_RECOVERED_OPERATION_SCOPE`), effect obligation `SYNCED` (`booking.status becomes BookingStatus.CONFIRMED` vs. recovered exact mutation). Both obligations render independently under the same rule row.

SOURCE_NAVIGATION:
Anchor buttons call `IOpenerService.open(URI.file(...))` when a `file` is present; anchors without a file (e.g. the B8 guard, which sys-platform never resolved to a location) render disabled with an explicit "no navigable location" title rather than a fabricated link.

SPEC_NAVIGATION:
Spec anchors render as labeled entries (e.g. `booking.spec:20`) alongside source anchors; no spec file viewer exists yet in this editor, so spec anchors are label-only and not click-navigable — a smaller gap than the platform contract gap, left for a follow-up.

FILTERING:
`filterRulesByDisposition` (pure, unit-tested) filters the rule list by aggregate or any obligation disposition; wired to a button bar with one button per `VerificationDisposition` plus `ALL`.

SOUNDNESS_UX:
Each disposition has its own badge shape/border style (solid vs. dashed vs. dotted vs. opacity), not just color, so PARTIAL/NOT_OBSERVED/UNSUPPORTED cannot be confused with SYNCED by shape alone. Governed/Recovered carry explicit provenance badges. Missing recovered meaning, missing anchors, and the platform contract gap all render as explicit "unavailable" states, never blank or fabricated. All disposition/reason/provenance text is platform-sourced data rendered through a deterministic `dispositionLabel` switch — no parsing of human-readable strings to derive semantics.

TESTS:
`src/vs/workbench/contrib/sys/common/test/sysVerification.test.ts` — 9 `node:test` cases covering B1/B2/B3 SYNCED end-to-end, B8 conflicted-aggregate-does-not-hide-synced-obligation, governed=SPECIFIED/recovered=DERIVED provenance, missing evidence/anchors on unsupported rules, WRONG_OPERATION_SCOPE distinct from CONFLICTED, the deterministic label switch, disposition filtering, stable selection across refresh, and live-contract-gap non-substitution. All 9 pass (verified via `tsc` transpile + `node --test`). Full-project `tsc --noEmit` and `eslint` show zero new errors/warnings introduced by this change.

DOMAIN_SPECIFIC_UI_LOGIC:
0 — `sysVerification.ts` and the view take rule/obligation data generically; Cinema Booking only appears in the fixture module, not in shared UI logic.

UI_SEMANTIC_INFERENCE:
0 — the UI renders `disposition`, `provenance`, `reasons`, `why`, and `completeness` exactly as provided; no source parsing, no text-based verdict reconstruction anywhere in `browser/sysVerificationWorkbenchView.ts`.

NEXT_PRODUCT_GAP:
sys-platform needs to publish the versioned aggregate verification contract (rule/obligation tree with disposition, governed/recovered semantic objects, evidence, anchors) so `LivePlatformVerificationDataProvider` can be registered in place of the fixture provider without touching the view.

NEXT_RECOMMENDED_STEP:
Land that platform contract, then implement `LivePlatformVerificationDataProvider.getProject()` against it with schema validation and `ERROR`/`PLATFORM_CONTRACT_GAP` fallback — the view and pure logic in this change require no further modification.
