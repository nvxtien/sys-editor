# Plan: Kind-Aware Structured Intent Lifecycle

## Goal

Implement the approved kind-aware Structured Intent lifecycle so raw
requirements retain their semantic shape, sys-core owns domain validation and
formalization capability decisions, and the Editor renders capability results
without hard-coding platform semantics. A DATA_MODEL requirement must remain a
reviewable Structured Intent and must never be fabricated into an operation
Formal Spec.

## Architecture

The flow is:

```text
raw requirement
  -> provider normalization
  -> sys-core domain validation and persistence
  -> human review and exact-content approval
  -> sys-core capability evaluation
  -> Editor renders capability
  -> Formal Spec only when supported
```

`kind` is the primary semantic shape. Entity definitions plus cardinality use
`DATA_MODEL`; `RELATIONSHIP` is for a relationship-focused requirement on an
existing model. Legacy artifacts missing `kind` are read as operation rules
only; new artifacts always persist `kind`.

## Tech Stack

- TypeScript workbench lifecycle and unit tests
- Go SideX server API and tests
- Rust sys-core/platform commands in `/Volumes/Work/dev/sys-platform`
- Playwright Chromium GUI tests
- Existing JSON file-backed `.sys` compatibility projections

## Spec

`docs/superpowers/specs/2026-09-23-structured-intent-kind-design.md`

## Global Constraints

- Preserve unrelated user changes in both repositories.
- Do not extend the sys-platform Formal Spec grammar in this change.
- Do not add provider SDKs or provider calls to sys-core.
- Do not let the Editor or CLI hard-code `kind`-to-capability decisions.
- Keep current operation-rule behavior working.
- Do not persist a newly created Structured Intent without `kind`.
- Do not represent an absent operation as an empty string; use `null` or an
  absent domain value with `UNKNOWN` provenance.
- Provider provenance is untrusted input; sys-core must normalize or reject
  unsupported provenance claims.
- Approval is content identity: current content must equal the stored
  `approvedContentHash` for the same artifact type.

## Review Focus

- Is domain validation owned by sys-core rather than duplicated in Editor?
- Can a future platform capability change work without a semantic-kind branch
  in the workbench view?
- Are DATA_MODEL entities, fields, relationships, and unknowns preserved
  without operation-only coercion?
- Does any stale or edited artifact lose downstream actions through hash
  comparison?
- Does the E2E test prove both UI behavior and absence of provider/spec side
  effects?

## Tasks

### 1. Define and validate the domain contract in sys-core

Files:

- `/Volumes/Work/dev/sys-platform/sys-core/src/...` (the existing Structured
  Intent domain/command modules identified during implementation)
- `/Volumes/Work/dev/sys-platform/sys-core/tests/...`

Steps:

- [ ] Add the `StructuredIntentKind` enum with
  `OPERATION_RULE`, `DATA_MODEL`, `RELATIONSHIP`, `INVARIANT`, `WORKFLOW`, and
  `UNKNOWN`.
- [ ] Add kind-specific entity, field, and relationship values while keeping
  existing common facts and explicit `unknowns`.
- [ ] Make `operation` nullable/absent at the domain boundary when it is not
  applicable; reject empty-string representations for newly persisted data.
- [ ] Decode legacy artifacts without `kind` as `OPERATION_RULE` and mark them
  as legacy internally if the existing record shape permits it.
- [ ] Ensure all new persistence paths require and write `kind`.
- [ ] Normalize or reject provider provenance claims so `SPECIFIED` is only
  accepted when traceably grounded in the raw requirement, with missing facts
  represented as `UNKNOWN`.
- [ ] Add unit tests for every kind, DATA_MODEL fields, relationship
  cardinality, unknowns, legacy read compatibility, new-write enforcement,
  nullable operation, and provenance normalization.

### 2. Add sys-core capability evaluation and approval hashes

Files:

- `/Volumes/Work/dev/sys-platform/sys-core/src/...` (existing intent/formal
  spec lifecycle command modules)
- `/Volumes/Work/dev/sys-platform/sys-core/tests/...`

Steps:

- [ ] Define the `FormalizationCapability` result with `status`, optional
  `reason`, and optional `requiredPreconditions`.
- [ ] Make sys-core consume the sys-platform capability contract rather than
  embedding Editor-specific kind checks.
- [ ] Return `FORMAL_SPEC_SUPPORTED` only for an operation rule with an
  authoritative operation under the current platform contract.
- [ ] Return `PLATFORM_FORMAL_SPEC_GAP` with an actionable reason for
  unsupported DATA_MODEL, RELATIONSHIP, WORKFLOW, and UNKNOWN cases.
- [ ] Store `approvedContentHash` for Structured Intent and Formal Spec
  approvals, using canonical serialized content.
- [ ] Recompute and compare hashes on reads and lifecycle transitions; edited
  content must become stale and lose downstream actions.
- [ ] Add tests for supported and unsupported capability results, reasons and
  preconditions, exact approval, edited content, raw requirement changes, and
  cross-artifact staleness.

### 3. Update the normalization API contract

Files:

- `/Volumes/Work/dev/sys-editor/sidexai/sidex-server/internal/api/normalize_intent.go`
- `/Volumes/Work/dev/sys-editor/sidexai/sidex-server/internal/api/normalize_intent_test.go`

Steps:

- [ ] Update the provider prompt to require `kind` and preserve
  `entities`, `fields`, `relationships`, and `unknowns` where applicable.
- [ ] Remove the operation-only field list and language that forbids schema or
  relationship semantics.
- [ ] Keep provider output JSON-only and transport validation in the server;
  call sys-core domain validation before accepting/persisting the candidate.
- [ ] Ensure provider output cannot directly authorize Structured Intent or
  Formal Spec approval.
- [ ] Add API tests for a DATA_MODEL response, an operation response, invalid
  kind-specific shape, unsupported provenance, and provider JSON errors.

### 4. Update the TypeScript shared lifecycle model

Files:

- `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/common/sysStructuredIntent.ts`
- `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/common/sysStructuredIntentDraft.ts`
- `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/common/test/sysStructuredIntent.test.ts`
- `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/common/test/sysStructuredIntentDraft.test.ts`

Steps:

- [ ] Mirror the sys-core domain shape, including `kind`, nullable operation,
  kind-specific values, capability result, and approval hashes.
- [ ] Keep legacy read parsing for missing `kind` while ensuring serializers
  always emit `kind` for new artifacts.
- [ ] Treat hashes, not booleans or state labels alone, as the source of truth
  for approval and staleness.
- [ ] Make the shared lifecycle consume the capability result returned by
  sys-core rather than checking `intent.kind` to decide UI actions.
- [ ] Add unit tests for parsing, serialization, legacy compatibility,
  capability rendering inputs, hash approval, and stale transitions.

### 5. Wire the Editor and compatibility projection

Files:

- `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/browser/sysProjectService.ts`
- `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts`
- `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/browser/media/sysSemanticWorkbench.css`

Steps:

- [ ] Persist the validated Structured Intent through sys-core before creating
  or refreshing the Editor compatibility projection.
- [ ] Request the capability result after confirmed intent approval.
- [ ] Render `Review intent` and `Confirm intent` for drafts, then render the
  capability result returned by sys-core.
- [ ] Render `Bind operation` and `Generate Formal Spec` only when the result
  status is `FORMAL_SPEC_SUPPORTED`.
- [ ] Render the platform-gap reason and hide Formal Spec generation for
  `PLATFORM_FORMAL_SPEC_GAP`; do not create a fake `Operation:` declaration.
- [ ] Keep raw requirement approval separate from Structured Intent approval.
- [ ] Preserve the existing 3D action-button styling and accessible labels.

### 6. Add regression coverage for the full GUI lifecycle

Files:

- `/Volumes/Work/dev/sys-editor/tests/gui/gui-full-requirement-lifecycle.spec.mjs`
- `/Volumes/Work/dev/sys-editor/playwright.config.mjs`

Steps:

- [ ] Mock a DATA_MODEL normalization response containing entities, fields,
  relationships, unknowns, and a null/unknown operation.
- [ ] Verify the UI shows review/confirmation state and retains the structured
  data after normalization.
- [ ] Mock a `PLATFORM_FORMAL_SPEC_GAP` capability response and verify the gap
  is rendered while `Generate Formal Spec` is absent.
- [ ] Count Formal Spec provider endpoint calls and assert the count remains
  zero for DATA_MODEL.
- [ ] Assert no `.spec` proposal file is created for DATA_MODEL.
- [ ] Keep the supported operation-rule path covered so existing Formal Spec
  generation remains available.
- [ ] Assert the action buttons retain the intended 3D visual affordance.

### 7. Verify, review, and integrate

Files:

- No new source files beyond the implementation changes above.

Steps:

- [ ] Run focused TypeScript unit tests for Structured Intent and lifecycle
  state.
- [ ] Run `go test ./internal/api` with the repository’s supported cache setup.
- [ ] Run sys-core tests and the relevant sys-platform command tests.
- [ ] Run `npm run lint` and the production build.
- [ ] Run the Playwright GUI test and inspect its generated artifacts.
- [ ] Review the diff for unrelated changes and preserve all pre-existing user
  modifications.
- [ ] Report any platform capability contract mismatch before changing the
  Formal Spec grammar.

## Self-review

- Coverage: the plan covers domain schema, provider boundary, capability
  ownership, hash-based lifecycle, UI, and the required Playwright side-effect
  assertions.
- No placeholders: repository paths that depend on the existing sys-core
  module layout are explicitly bounded to the existing domain/lifecycle
  modules, and discovery is a first implementation step rather than an
  unresolved behavior decision.
- Type consistency: the same six kinds, nullable operation semantics,
  provenance rules, capability statuses, and hash identity are carried through
  Rust, Go, TypeScript, and tests.
- Review focus: the plan directly addresses all review points: capability
  ownership, kind precedence, read-only legacy compatibility, sys-core
  validation, provenance trust, null operation, exact hashes, and Playwright
  no-call/no-file assertions.
