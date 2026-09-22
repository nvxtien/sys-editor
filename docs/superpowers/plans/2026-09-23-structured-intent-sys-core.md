# Structured Intent sys-core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move Structured Intent → Formal Spec lifecycle ownership into one reusable `sys-core` crate consumed by both `product-cli` and Sys Editor adapters.

**Architecture:** `sys-core` lives as an independent Rust crate beside the existing sys-platform crates and owns the canonical `.sys` persistence model, exact-content approvals, operation binding, staleness, and lifecycle status. `product-cli` uses it directly; Sys Editor uses a thin Go/server adapter that invokes the same core JSON command surface, while the existing TypeScript layer becomes presentation-only. Formal Spec parsing/validation remains in sys-platform and provider transport remains outside the core behind an injected proposal boundary.

**Tech Stack:** Rust 2021, serde/serde_json/sha2, existing product-cli and formal-spec crates, Go server adapter, TypeScript UI tests, shell integration tests.

**Spec:** `docs/prompts/STRUCTURED_INTENT_TO_FORMAL_SPEC_LIFECYCLE_V0_1.md`

## Global Constraints

- `sys-core` owns lifecycle semantics exactly once; `sys-editor` and `product-cli` are clients.
- Raw requirements remain free-form and model-added facts remain `INFERRED` or `UNKNOWN`.
- Operation identity is never guessed; missing authoritative binding blocks Formal Spec generation.
- Human approval is required for Structured Intent and Formal Spec, with exact-content identity.
- Upstream edits stale downstream artifacts; no fixture fallback or fake governed/verification status.
- sys-platform remains the Formal Spec grammar, parser, semantic, and verification authority.
- Do not overwrite unrelated dirty files in `/Volumes/Work/dev/sys-platform`.

## Review Focus

- Cross-client parity: the same `.sys` input produces identical approval and staleness outcomes in CLI and Editor adapter tests.
- Exact identity: byte/normalized-content edits invalidate approvals even when IDs are unchanged.
- Unknown operation: normalization and generation must return a blocking state rather than inventing an operation.
- Workspace isolation: paths are rooted at the requested workspace and never fall back to repository fixtures.
- Provider boundary: core accepts proposals through a narrow trait/JSON boundary and has no GUI/vendor dependency.

### Task 1: Add independent sys-core lifecycle crate

**Files:**
- Create: `/Volumes/Work/dev/sys-platform/sys-core/Cargo.toml`
- Create: `/Volumes/Work/dev/sys-platform/sys-core/src/lib.rs`
- Create: `/Volumes/Work/dev/sys-platform/sys-core/src/model.rs`
- Create: `/Volumes/Work/dev/sys-platform/sys-core/src/store.rs`
- Create: `/Volumes/Work/dev/sys-platform/sys-core/src/lifecycle.rs`
- Create: `/Volumes/Work/dev/sys-platform/sys-core/tests/lifecycle.rs`

**Interfaces:**
- Produces `Project`, `Requirement`, `StructuredIntent`, `FormalSpec`, `Approval`, `LifecycleStatus`, `Provenance`, `CoreError`, and `Workspace` APIs.
- `Workspace::load(path)`, `Workspace::create_requirement(id, raw)`, `Workspace::save_intent(req, intent)`, `Workspace::approve_intent(req, identity)`, `Workspace::bind_operation(req, operation)`, `Workspace::save_formal_spec(req, candidate)`, `Workspace::approve_formal_spec(req, identity)`, and `Workspace::status(req)` are the only lifecycle mutation/read entry points.

- [ ] **Step 1: Write failing tests** covering free-form raw text, provenance/UNKNOWN preservation, no operation guessing, exact approval, edit invalidation, staleness propagation, Unicode/newlines, workspace isolation, and blocked generation before approval.
- [ ] **Step 2: Run `cargo test --manifest-path sys-core/Cargo.toml` and verify the tests fail because the crate/API is absent.**
- [ ] **Step 3: Implement the smallest serde-backed model and filesystem store under `.sys/requirements`, `.sys/intents`, and `.sys/specs`; hash exact UTF-8 content with SHA-256; derive status only from persisted artifacts.**
- [ ] **Step 4: Run the crate tests and verify all lifecycle tests pass.**
- [ ] **Step 5: Commit only new `sys-core` files as `feat: add shared sys-core lifecycle crate`.**

### Task 2: Integrate product-cli as a thin sys-core client

**Files:**
- Modify: `/Volumes/Work/dev/sys-platform/product-cli/Cargo.toml`
- Modify: `/Volumes/Work/dev/sys-platform/product-cli/src/main.rs`
- Create: `/Volumes/Work/dev/sys-platform/product-cli/src/core_adapter.rs`
- Create: `/Volumes/Work/dev/sys-platform/product-cli/tests/core_parity.rs`

**Interfaces:**
- Consumes the Task 1 `sys_core::Workspace` APIs.
- Produces representative commands `sys intent approve`, `sys intent show`, `sys spec approve`, and `sys status` without duplicating lifecycle rules.

- [ ] **Step 1: Add CLI tests that invoke the real command path against a temporary workspace and assert approval/staleness decisions come from sys-core.**
- [ ] **Step 2: Run the focused product-cli tests and verify they fail because the dependency/commands do not exist.**
- [ ] **Step 3: Add the path dependency and thin argument/output adapter; remove or bypass duplicate lifecycle decisions only where the new command paths overlap. Preserve unrelated dirty files.**
- [ ] **Step 4: Run `cargo test --manifest-path product-cli/Cargo.toml` and the focused parity tests; verify pass.**
- [ ] **Step 5: Commit only the sys-core dependency, adapter, command, and tests as `feat: consume sys-core from product cli`.**

### Task 3: Expose the same core operations to Sys Editor

**Files:**
- Create: `sidexai/sidex-server/internal/api/sys_core.go`
- Create: `sidexai/sidex-server/internal/api/sys_core_test.go`
- Modify: `sidexai/sidex-server/cmd/server/main.go`
- Modify: `src/vs/workbench/contrib/sys/browser/sysProjectService.ts`
- Modify: `src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts`
- Modify: `src/vs/workbench/contrib/sys/common/sysStructuredIntent.ts`
- Modify: `src/vs/workbench/contrib/sys/common/sysStructuredIntentDraft.ts`
- Modify: related TypeScript tests

**Interfaces:**
- Go adapter accepts workspace path, operation name, and exact-content identity, then invokes the `sys-core` JSON command surface without interpreting lifecycle state.
- TypeScript keeps rendering/actions only and maps adapter responses to UI; it no longer persists or derives approval/staleness truth.

- [ ] **Step 1: Add Go and TypeScript tests proving Editor approval/status calls are delegated and that an unapproved or stale response blocks generation.**
- [ ] **Step 2: Run focused tests and verify failure because the adapter route/delegation is absent.**
- [ ] **Step 3: Implement the narrow adapter and route; replace direct TypeScript lifecycle mutations with adapter calls while retaining provider selection and editor navigation.**
- [ ] **Step 4: Run Go tests and focused TypeScript tests; verify pass and no duplicate approval/staleness helper remains authoritative in the Editor.**
- [ ] **Step 5: Commit Editor integration as `feat: route editor lifecycle through sys-core`.**

### Task 4: Formal Spec/provider boundary and architectural proof

**Files:**
- Modify: `/Volumes/Work/dev/sys-platform/sys-core/src/lifecycle.rs`
- Create: `/Volumes/Work/dev/sys-platform/sys-core/src/provider.rs`
- Create: `/Volumes/Work/dev/sys-platform/sys-core/tests/architecture.rs`
- Modify: `sidexai/sidex-server/internal/api/normalize_intent.go`
- Modify: `sidexai/sidex-server/internal/api/draft_spec.go`
- Create: `docs/architecture/SYS_CORE_STRUCTURED_INTENT_LIFECYCLE.md`

**Interfaces:**
- `ProposalProvider` is provider-agnostic and returns an untrusted Structured Intent or Formal Spec candidate.
- sys-core accepts only an approved intent plus authoritative operation for Formal Spec orchestration; sys-platform remains the validator.

- [ ] **Step 1: Add tests for candidate/untrusted state, approved-intent-only generation, canonical parser delegation, and no provider/editor dependency.**
- [ ] **Step 2: Run focused tests and verify red.**
- [ ] **Step 3: Implement provider boundary and adapter delegation; remove prompt/state authority from server/UI code without changing sys-platform grammar.**
- [ ] **Step 4: Run architecture tests, relevant sys-platform parser tests, Go tests, focused TypeScript tests, `npm run lint`, and `npm run build`.**
- [ ] **Step 5: Commit documentation and boundary tests as `test: prove shared sys-core lifecycle ownership`.**

### Task 5: Final verification and report

**Files:**
- Modify: `docs/reports/STRUCTURED_INTENT_TO_FORMAL_SPEC_LIFECYCLE_V0_1.md`

- [ ] **Step 1: Run the complete relevant suites in both repositories, inspect status/diff, and remove debug/temp artifacts.**
- [ ] **Step 2: Record exact commit IDs, test counts, any checkpoint or narrow condition, and the required ownership report.**
- [ ] **Step 3: Commit the report, then push only after verification confirms the intended commits and no unrelated files are included.**

## Spec coverage

Tasks 1–4 cover the required model, approvals, provenance, staleness, provider boundary, CLI parity, Editor parity, platform delegation, tests, and ownership report. Full desktop/provider replay remains `CHECKPOINT_REACHED` if it cannot be performed in this environment; no success claim is made for that external replay.
