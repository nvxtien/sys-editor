# Sys Editor end-to-end user journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Sys Editor user journey from plain-language requirement through spec review, verified code proposal, explicit apply approval, and Platform post-apply verification.

**Architecture:** Sys Editor owns the user-facing flow and invokes Sys Platform's `sys` CLI from the selected project root. Sys Platform remains authoritative for draft validation, persistence, proposal verification, apply, and post-apply verification. Add only a non-mutating draft-preview mode; reuse existing CLI operations for the rest.

**Tech Stack:** Rust (Sys Platform CLI and tests), TypeScript (Sys Editor workbench/transport), existing JSON CLI output and task service.

**Spec:** [work/sys-editor-e2e-design.md](work/sys-editor-e2e-design.md)

## Global Constraints

- Sys Platform owns semantic validation and verification decisions.
- Draft preview must not mutate project state.
- Spec approval and code apply require separate explicit user actions.
- Apply is enabled only for `VERIFIED_SYNCED` proposals.
- Use existing CLI and task-service patterns; add no workflow framework, persistence format, or dependency.
- Preserve the existing Sys Editor Verify action.

## Review Focus

- Invalid or compiler-unsupported draft: return a failure and leave no approved requirement/spec state.
- Empty or malformed CLI JSON: show an error and never treat it as success.
- Missing provider, verifier failure, or any status other than `VERIFIED_SYNCED`: keep Apply disabled and show the reason/state.
- CLI timeout/non-zero exit: surface failure and retain the user's editable draft.
- Project path with spaces or wrong project root: invoke the CLI with the selected project cwd and argument-safe parameters.

---

### Task 1: Add safe draft preview and approval validation in Sys Platform

**Files:**
- Modify: `/Volumes/Work/dev/sys-platform/product-cli/src/requirement.rs`
- Modify: `/Volumes/Work/dev/sys-platform/product-cli/src/main.rs` only if command arguments are defined there
- Test: existing requirement CLI unit/integration test module(s) in `product-cli/src/requirement.rs`

**Interfaces:**
- Consumes: current requirement command inputs and draft-provider/parser/compiler functions.
- Produces: a draft-only JSON response containing the validated candidate; preview path performs no requirement/spec/state writes.

- [ ] Add a CLI test that supplies a deterministic valid draft and asserts JSON candidate output with no persisted requirement/spec approval.
- [ ] Run the focused requirement test and confirm the preview test fails before implementation.
- [ ] Add the narrow `--draft-only --json` mode by reusing current draft generation, parse, and ontology compile checks; return before all persistence and approval paths.
- [ ] Add a test with a compiler-rejected candidate and assert command failure with no approved state persisted.
- [ ] Move compiler validation ahead of approval persistence in the existing approval flow; add/adjust a regression test proving invalid compilation leaves no approved artifact/state.
- [ ] Run the focused requirement tests and CLI formatting check.

### Task 2: Pass selected project root through the Editor CLI transport

**Files:**
- Modify: `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/browser/sysVerificationProviderService.ts`
- Modify: `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/common/sysVerificationLive.ts` if needed to pass cwd
- Test: `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/common/test/sysVerificationLive.test.ts`

**Interfaces:**
- Consumes: existing `TaskProcessTransport.run` and `ISideXTaskService` spawn options.
- Produces: transport invocation with optional working directory, while current verification calls remain compatible.

- [ ] Add a transport test asserting cwd is passed to the task service and omitted for callers that do not provide it.
- [ ] Run the focused transport test and confirm it fails before implementation.
- [ ] Thread optional cwd through `TaskProcessTransport.run`; preserve existing argument handling and transport output/error behavior.
- [ ] Run focused transport tests and lint the touched TypeScript files.

### Task 3: Wire the user-approved E2E flow in Sys Editor

**Files:**
- Modify: `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/browser/sysProjectService.ts`
- Modify: `/Volumes/Work/dev/sys-editor/src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts`
- Add or modify: focused Sys Editor service/view tests alongside the existing `sys` workbench tests.

**Interfaces:**
- Consumes: Task 1 CLI commands/JSON and Task 2 cwd-aware transport.
- Produces: actions to preview a natural-language requirement, edit/review/approve its spec, inspect proposal diff/status, explicitly apply only verified proposals, and display post-apply results.

- [ ] Add service tests with mocked CLI responses for preview, spec approval, proposal show, blocked apply, successful apply, malformed JSON, non-zero exit, and timeout.
- [ ] Run the focused service tests and confirm expected failures before implementation.
- [ ] Implement the service flow using the selected project root and existing `sys` CLI commands; keep draft text available after errors.
- [ ] Add view behavior that shows candidate spec, proposal diff and exact verification state; disable Apply unless status is exactly `VERIFIED_SYNCED`.
- [ ] Wire separate explicit spec-approval and code-apply actions; display Platform's post-apply verification result.
- [ ] Run focused view/service tests and lint the touched TypeScript files.

### Task 4: Verify integrated acceptance behavior

**Files:**
- Modify only tests from Tasks 1–3 if integration gaps are found.

- [ ] Run the focused Sys Platform requirement tests and relevant CLI checks.
- [ ] Run the Sys Editor focused tests, lint, and `npx tsc --noEmit`; report any pre-existing failures separately from this change.
- [ ] Perform a CLI-backed dry-run against a disposable project to confirm preview leaves state untouched, proposal state controls Apply, and apply output includes post-apply verification.
- [ ] Inspect the final diff for unrelated changes and confirm no proposal can be applied from the Editor unless it is `VERIFIED_SYNCED`.

## Self-review

- Spec coverage: preview, validation-before-persistence, explicit spec and code approvals, verified-only apply, post-apply display, project cwd, and preservation of Verify are assigned to Tasks 1–4.
- No placeholders: each task names repository files, behavior, and checks; exact helper signatures are deferred to reading the existing code when implementing.
- Type/CLI consistency: existing `sys` CLI and transport are reused; the only new CLI behavior is the draft-only JSON preview.
- Review focus: failure cases are exercised in Tasks 1 and 3; selected project cwd is exercised in Task 2; Task 4 validates cross-repository behavior.
- Scope check: both repositories are required because Platform owns workflow authority while Editor owns the interaction; no additional independent subsystem is included.
