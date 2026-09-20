# Execution mode clarification

This prompt is for an implementation agent that must **fix the real Tauri runtime defect discovered in Sys Human Intent Actions v0.1 inside `nvxtien/sys-editor`**.

Do not redesign the GUI.
Do not add new product scope.
Do not turn this task into a conversational walkthrough.

Proceed autonomously through:

    reproduce runtime defect
    -> trace the actual load path
    -> write focused failing test/reproduction
    -> implement the smallest fix
    -> verify runtime termination
    -> rerun Human Intent Actions flow
    -> lint/build/regression
    -> report

# Prompt: Fix Sys Semantic Workbench Runtime Loading v0.1

Repository:

    nvxtien/sys-editor

## Measured defect

In a real Tauri runtime, opening the Sys Semantic Workbench can remain indefinitely at:

    Loading semantic snapshot...

The workbench shell itself is running, but the Sys semantic surface does not transition to a ready or error state.

This defect was observed manually after the Human Intent Actions implementation.

The SideX AI panel may simultaneously show:

    Unable to reach model
    The local AI server is not running.

That SideX agent error is **not part of this milestone** and must not be treated as the root cause unless direct evidence proves coupling.

## Goal

Make the Sys Semantic Workbench load path terminate deterministically in the real Tauri runtime.

Required invariant:

    LOADING
    ->
    READY
    OR
    ERROR

Forbidden:

    LOADING forever

The milestone must identify and fix the actual runtime cause, not hide the symptom with a timeout or hard-coded fallback unless the timeout/fallback is already part of an accepted lifecycle design.

## Product boundary

Preserve:

    nvxtien/sys-platform
    = semantic/governance authority

    nvxtien/sys-editor
    = interaction / visualization shell

This milestone is runtime reliability for the existing typed snapshot/action-state boundary.

Do not add semantic inference to the GUI.

Do not parse CLI text.

Do not redesign Human Intent Actions.

## Current architecture to inspect

Trace the real path from view creation to data render.

At minimum inspect the equivalent of:

    SemanticWorkbenchView
        ->
    SysSemanticSnapshotService
        ->
    SysIntentActionService / persisted intent state
        ->
    workbench/storage lifecycle
        ->
    render/update

Exact type names may differ.

Find where the awaited chain can fail to resolve, fail to reject, or wait on a lifecycle event that never fires in the real Tauri runtime.

## Mandatory brainstorming / diagnosis gate

Before production edits:

1. Reproduce the issue in real Tauri runtime.
2. Record the exact point where the UI enters loading state.
3. Add temporary diagnostics only as needed to identify:
   - snapshot request start;
   - intent-state load start/end;
   - storage read start/end;
   - promise resolution/rejection;
   - render/update invocation.
4. Determine whether the failure is:
   - unresolved promise;
   - swallowed exception;
   - lifecycle ordering;
   - missing service registration;
   - storage initialization;
   - stale state migration;
   - event subscription timing;
   - another measured cause.
5. Remove temporary noisy diagnostics before finalizing unless a small durable error log is justified.
6. Record the exact root cause in the report.

Do not guess from source alone if the Tauri runtime can be instrumented.

## Error handling requirement

The Sys Semantic Workbench must surface failures explicitly.

If loading fails, render a human-readable error state equivalent to:

    Unable to load semantic snapshot

    <concise non-secret reason>

    [Retry]

Do not leave the panel indefinitely loading.

Do not expose stack traces or internal secrets in the default UI.

Detailed diagnostics may go to the existing log/output mechanism.

## Retry behavior

If an error is recoverable, Retry must call the same typed service boundary again.

Do not reload the entire IDE merely to retry the snapshot unless existing workbench conventions make that unavoidable.

Retry must not duplicate subscriptions or corrupt intent interaction state.

## State preservation

The fix must preserve existing Human Intent Actions semantics:

    UNRESOLVED
    -> CANDIDATE
    -> CONFIRMED HUMAN INTENT

and:

    CONFIRMED HUMAN INTENT != GOVERNED SPEC

A runtime load fix must not reset or silently lose:

- confirmed meaning;
- candidate meaning;
- leftOpenByHuman;
- governance state;
- replacement state that is supposed to survive the supported lifecycle.

If corrupted/invalid persisted state is the measured cause, handle it explicitly and conservatively.

Do not silently replace invalid state with invented business meaning.

## TDD / acceptance gates

Write a focused failing reproduction before the production fix where practical.

### L1 — load resolves to READY

Given valid deterministic Cinema snapshot + valid intent state:

    load()
    -> READY

The view renders the semantic workspace.

### L2 — load rejection becomes ERROR

Given snapshot or state service rejects:

    LOADING
    -> ERROR

The UI must not remain loading.

### L3 — unresolved dependency cannot hang forever

Create the narrowest test/reproduction for the measured hanging path.

After the fix, the measured runtime path must terminate.

Do not add an arbitrary tiny timeout solely to make the test pass unless timeout semantics are intentionally part of the design.

### L4 — Retry works

From ERROR:

    Retry
    -> new load attempt

If the service succeeds:

    -> READY

### L5 — no duplicate subscriptions

Repeated retry/reload must not cause duplicate render/update events or multiple action handlers.

### L6 — persisted intent state remains intact

Load/reload preserves:

- confirmed meaning;
- unresolved item state;
- leftOpenByHuman;
- governance distinction.

### L7 — Cinema snapshot remains unchanged

The fix must not alter the semantic fixture merely to make loading succeed.

Expected evidence still includes:

    createBooking
    unresolved intent = 2 initially
    recovered paths = 6
    fully recovered guards = 0
    false_greens = 0

### L8 — Human Intent Actions still work

After READY in Tauri runtime:

    customer validation
    -> enter clarification
    -> review
    -> confirm
    -> CONFIRMED HUMAN INTENT
    -> NOT YET GOVERNED

and:

    status transition rules
    -> Leave unresolved

and replacement:

    old/new shown
    cancel preserves old
    confirm replaces only after explicit action

### L9 — no semantic logic added to the view

The fix must not:

    parse Java
    parse Formal Spec
    classify semantics
    derive unresolved intent
    map free text to business meaning

### L10 — deterministic terminal state

For the same valid inputs:

    READY content/order is deterministic

For the same failure:

    ERROR state is deterministic enough for tests.

### L11 — theme regression

READY and ERROR states must be readable in both:

    light theme
    dark theme

Use existing theme tokens.

### L12 — SideX regression

Required:

    npm run lint
    npm run build
    git diff --check

and focused Sys tests green.

If Rust/Tauri files are touched:

    npm run rust:check

plus relevant fmt/clippy checks if they are part of the touched path.

## Real Tauri verification

This gate is mandatory.

After automated tests pass:

    npm run tauri dev

Then verify:

1. Open Sys Activity Bar.
2. Semantic Workbench leaves "Loading semantic snapshot...".
3. Cinema Booking appears.
4. No infinite loading after switching away and back.
5. Human Intent Actions flow works.
6. Retry behavior works if an error state can be safely induced.
7. Light theme readable.
8. Dark theme readable.

Record whether the SideX AI panel is disconnected, but do not treat that as a Sys failure unless it actually blocks Sys loading.

## No fake success

Do not "fix" the runtime by:

- bypassing persisted state entirely;
- hard-coding READY;
- rendering the fixture before service resolution and ignoring service failure;
- swallowing exceptions;
- removing persistence;
- disabling Human Intent Actions;
- replacing async service loading with static UI data;
- coupling Sys loading to SideX agent readiness.

The real service path must work.

## Working-tree safety

Before edits record:

    git status --short
    current branch
    HEAD

Do not overwrite unrelated work.

If runtime diagnostics create generated files/logs, clean them before finalizing unless they are intentionally part of the product.

## Scope restrictions

Do NOT implement:

- new semantic features;
- source evidence navigation;
- proposal workflow;
- live sys-platform integration;
- CLI parsing;
- agent changes;
- SideX AI server fixes;
- rebranding;
- new persistence backend;
- ontology visualization;
- collection/time/concurrency semantics.

This milestone is only:

> make the existing Sys semantic workspace reliably finish loading in the real desktop runtime.

## Deliverables

Create/update:

- `docs/reports/SYS_SEMANTIC_WORKBENCH_RUNTIME_LOADING_V0_1.md`

Update architecture docs only if the root cause reveals a durable lifecycle rule that future Sys workbench services must follow.

Add focused regression tests for L1-L12 using existing test conventions.

## Report requirements

The report must include:

- exact reproduced symptom;
- root cause;
- where the unresolved/hanging path occurred;
- focused failing test/reproduction;
- implementation fix;
- L1-L12 results;
- real Tauri walkthrough result;
- Human Intent Actions regression result;
- light/dark verification;
- lint/build/test results;
- Rust-check applicability/result;
- `git diff --check`;
- unrelated dirty files;
- SideX AI disconnected state explicitly classified as relevant or irrelevant;
- final recommendation:

    GO
    NARROW
    STOP / REDESIGN

## GO criterion

GO requires all of the following:

1. Real Tauri runtime no longer remains indefinitely at "Loading semantic snapshot...".
2. Every load attempt terminates as READY or ERROR.
3. READY renders the existing Cinema semantic state correctly.
4. ERROR is visible and retryable.
5. Human Intent Actions still work and preserve their state semantics.
6. No semantic inference was added to the GUI.
7. Light/dark rendering passes.
8. Lint/build/focused tests pass.
9. No unrelated SideX subsystem was changed to hide the issue.

Success is:

> Sys Semantic Workbench is reliable enough that a human can trust that "loading" always becomes either usable semantic state or an explicit recoverable error.
