# Execution mode clarification

This prompt is for an implementation agent that must **fix the still-reproducible real Tauri runtime loading defect in `nvxtien/sys-editor`**.

A prior commit (`c7176de0`) fixed one initialization race but did **not** eliminate the observed runtime symptom.

Do not assume the previous root-cause explanation is sufficient.

Proceed autonomously through:

    reproduce exact Tauri symptom
    -> instrument production path
    -> identify last reached checkpoint
    -> write failing production-coupled test/reproduction
    -> implement smallest fix
    -> verify READY/ERROR termination
    -> rerun full GUI flow
    -> lint/build/regression
    -> report

Do not add new GUI features.

# Prompt: Fix Sys Semantic Workbench Real Runtime Load Path v0.2

Repository:

    nvxtien/sys-editor

## Current measured evidence

In the real desktop Tauri runtime, opening the Sys Semantic Workbench still shows indefinitely:

    Loading semantic snapshot...

This was observed **after** commit:

    c7176de0
    fix: Sys Semantic Workbench runtime loading v0.1

Therefore:

    previous fix != proven root cause resolution

The previous race in `SysIntentActionService.initialize()` may be a real defect, but runtime evidence shows it was not sufficient to explain/fix the actual infinite-loading symptom.

The real runtime screenshot is authoritative evidence.

## Goal

Find and fix the actual production load-path defect that causes the Sys Semantic Workbench to remain in LOADING state in Tauri.

Required invariant:

    every load attempt
    -> READY
    OR
    -> ERROR

Never:

    LOADING forever

## Critical rule: production evidence wins

Do not declare a root cause until a traced production checkpoint sequence proves it.

Do not infer success from unit tests that model the same logic in local helper functions.

A candidate explanation is not accepted until:

    real Tauri reproduction
    + production-path trace
    + post-fix Tauri verification

all align.

## First task: trace the real production path

Add temporary, minimal diagnostics to the **actual production classes**.

Trace checkpoints equivalent to:

    [SYS_LOAD_01] renderBody entered
    [SYS_LOAD_02] load() entered
    [SYS_LOAD_03] snapshotService.getSnapshot START
    [SYS_LOAD_04] snapshotService.getSnapshot DONE
    [SYS_LOAD_05] intentActionService.getIntentItems START
    [SYS_LOAD_06] intentActionService.getIntentItems DONE
    [SYS_LOAD_07] current-detail load START (if applicable)
    [SYS_LOAD_08] current-detail load DONE
    [SYS_LOAD_09] renderSnapshot entered
    [SYS_LOAD_10] READY rendered

And on failure:

    [SYS_LOAD_ERR] <stage> <sanitized error>

The exact logging mechanism should follow existing SideX logging/output conventions where practical.

Do not log secrets or full persisted payloads.

The purpose is to identify the **last checkpoint that actually occurs** in Tauri.

## Candidate failure classes

Do not assume one of these; measure them.

Possible categories include:

### A. View lifecycle

    renderBody never reaches load()

### B. Snapshot service

    getSnapshot() never resolves/rejects

### C. Intent action service

    getIntentItems() never resolves/rejects

### D. Detail-state loading

    stale currentDetailId/currentDetails creates a blocked path

### E. Storage lifecycle

    storage read awaits/depends on a lifecycle phase that is not ready

### F. Render lifecycle

    load completes but _renderSnapshot() is not attached to the current/live ViewPane container

### G. Re-entrant render loop

    renderBody()
    -> load()
    -> renderBody()
    -> load()
    ...
    prevents stable READY render

### H. Disposed/stale view instance

    async completion writes into a stale/disposed pane

### I. swallowed rejection

    fire-and-forget promise rejects without visible ERROR state

The agent must report which category was measured.

## Previous fix must be reviewed critically

Inspect commit `c7176de0` and explicitly verify:

1. whether awaiting initialization is still needed;
2. whether it actually participates in the hanging path;
3. whether the current fallback-to-fixture-on-storage-error is semantically safe;
4. whether current tests call real production classes or merely simulate them.

Do not revert a valid race fix without evidence.

But do not preserve an unsafe workaround merely because it is already committed.

## Storage failure rule

Distinguish:

### No stored state

This is normal for the fixture-backed GUI milestone.

Allowed:

    no stored state
    -> initialize from deterministic Cinema fixture

### Storage read throws / corrupted stored state

This is a failure.

Required:

    propagate / surface ERROR

Forbidden:

    storage failure
    -> silently replace with Cinema fixture
    -> READY

Reason:

A failed state source must not be presented as a trustworthy loaded state.

If corrupted persisted state can be safely identified and ignored under an existing documented migration policy, use that policy. Otherwise fail visibly.

## Loading state model

Use one explicit state machine in the view or controller.

Conceptually:

    IDLE
    LOADING
    READY
    ERROR

Transitions:

    IDLE -> LOADING
    LOADING -> READY
    LOADING -> ERROR
    ERROR -> LOADING   (Retry)
    READY -> LOADING   (explicit refresh only)

Avoid using multiple booleans whose combinations permit ambiguous states unless existing code conventions require it.

If existing code already has booleans, at minimum prove there is no state combination that causes renderBody to repeatedly render LOADING while data is already available.

## Re-entrancy protection

Ensure one view render does not accidentally start overlapping loads.

If load is already in flight, repeated renderBody calls should not spawn unbounded concurrent loads.

A safe pattern may be:

    private loadPromise?: Promise<void>

or equivalent lifecycle-aware scheduling.

Do not adopt this mechanically; first measure whether overlapping loads are part of the defect.

## View-container correctness

Verify that the DOM node used after async completion is still the current live container.

Check whether:

    this.getContainerDomNode()

returns the same node expected by the current pane lifecycle at load completion.

If the view framework recreates the body/container, rendering into an old node can make a completed load invisible.

This is a strong candidate if logs show:

    renderSnapshot entered
    but GUI still says Loading...

If measured, fix using the existing ViewPane lifecycle pattern rather than retaining stale DOM references.

## Mandatory production-coupled tests

Do not satisfy acceptance with tests that recreate local helper functions unrelated to the real implementation.

Prefer tests that instantiate or directly exercise:

    SysIntentActionService
    SysSemanticSnapshotService
    SysSemanticWorkbenchView load controller/state

using mocked SideX dependencies where needed.

If full ViewPane construction is impractical, extract the smallest real production load-state coordinator and test that production class directly.

The extracted coordinator must be used by the real view.

## Required TDD gates

### P1 — actual service initialization race

Test real `SysIntentActionService` with delayed first initialization.

Required:

    first getIntentItems()
    waits
    returns initialized items

### P2 — no stored state

Real service with no stored state:

    -> Cinema fixture

This is a valid READY path.

### P3 — storage failure

Real service with storage throwing:

    -> rejection / explicit error result

Forbidden:

    fixture fallback pretending success

### P4 — real load coordinator READY

Given real/production load controller with:

    snapshot service success
    intent service success

Required:

    LOADING -> READY

### P5 — snapshot rejection

Required:

    LOADING -> ERROR

### P6 — intent service rejection

Required:

    LOADING -> ERROR

### P7 — retry

From ERROR:

    Retry
    -> new load attempt

If dependencies succeed:

    -> READY

### P8 — no overlapping-load explosion

Repeated render/refresh while one load is pending must not create uncontrolled duplicate loads/subscriptions.

### P9 — stale/disposed lifecycle

If the production framework exposes disposal state, ensure async completion does not mutate a disposed view.

At minimum verify no uncaught error or infinite loading loop results.

### P10 — READY render uses live container

Add the narrowest production-coupled assertion possible that READY rendering targets the current view container.

### P11 — no silent exception

Every rejected async load must reach:

    ERROR UI
    or existing centralized error handling

Never unhandled/fire-and-forget loss.

### P12 — Human Intent Actions regression

After READY:

    unresolved item detail opens
    candidate entry works
    confirmation works
    confirmed != governed
    leave unresolved works
    replacement cancel preserves old
    replacement confirm replaces explicitly

### P13 — fixture semantic state unchanged

Still show:

    Cinema Booking
    createBooking
    initial unresolved intent = 2
    recovered paths = 6
    fully recovered guards = 0
    false_greens = 0

### P14 — theme/error UI

Both READY and ERROR states readable in:

    light
    dark

### P15 — deterministic terminal state

No test/runtime path is allowed to remain indefinitely in LOADING.

Use an explicit bounded test harness for async completion, but do not "solve" production with an arbitrary timeout unless timeout is part of the accepted runtime design.

## Runtime verification is mandatory

After the fix and automated tests:

    npm run tauri dev

Then reproduce the exact prior path.

Required evidence:

### R1

Open Sys Activity Bar.

Observe:

    Loading semantic snapshot...

Then within normal startup time:

    -> Cinema Booking

or:

    -> explicit ERROR

### R2

Switch away from Sys and back.

Required:

    no infinite Loading state

### R3

Open unresolved intent detail.

Required:

    customer validation
    status transition rules

### R4

Run Human Intent Actions flow:

    customer validation
    -> enter clarification
    -> review
    -> confirm
    -> CONFIRMED HUMAN INTENT
    -> NOT YET GOVERNED

### R5

Leave status transition unresolved.

Required:

    remains visible
    leftOpenByHuman = true

### R6

Replacement flow:

    old/new visible
    cancel preserves old

### R7

Light theme:

    READY readable
    ERROR readable if induced safely

### R8

Dark theme:

    READY readable
    ERROR readable if induced safely

## Diagnostic cleanup

Once root cause is proven:

- remove temporary noisy checkpoint logging;
- retain only durable, concise error logging if useful;
- do not leave console spam in normal operation.

The final report must include the measured checkpoint sequence before and after the fix.

Example:

    BEFORE:
      01 renderBody
      02 load entered
      03 snapshot start
      04 snapshot done
      05 intent start
      <stops>

    AFTER:
      01
      02
      03
      04
      05
      06
      09
      10 READY

This is illustrative only.

## No fake fix

Forbidden:

- hard-code READY;
- bypass the action service;
- bypass persisted intent state;
- render Cinema fixture synchronously while ignoring load failures;
- swallow exceptions;
- add "setTimeout(render, 100)" without root-cause proof;
- retry forever in a loop;
- couple Sys loading to SideX AI server;
- remove Human Intent Actions;
- reset user state on every startup;
- change fixture semantics to make loading easier.

## SideX AI panel

The SideX agent may remain disconnected.

This must not block Sys.

Treat:

    Unable to reach model

as unrelated unless checkpoint evidence proves a direct shared dependency.

Do not fix SideX agent/server in this milestone.

## Verification gates

After production fix:

    npm run lint
    npm run build
    git diff --check

Run:

- production-coupled P1-P15 tests;
- existing H1-H13 Human Intent Actions tests;
- existing Semantic Workbench tests.

If Rust files are touched:

    npm run rust:check

and appropriate fmt/clippy gates.

## Working-tree safety

Before edits:

    git status --short
    git rev-parse --abbrev-ref HEAD
    git rev-parse HEAD

Record unrelated dirty files.

Do not overwrite unrelated work.

## Scope restrictions

Do NOT implement:

- live sys-platform integration;
- semantic feature expansion;
- source evidence navigation;
- proposal workflow;
- SideX agent fixes;
- IDE rebranding;
- ontology graph visualization;
- collection/time/concurrency semantics;
- CLI parsing.

This is a runtime lifecycle correctness milestone only.

## Deliverable

Create/update:

    docs/reports/SYS_SEMANTIC_WORKBENCH_REAL_RUNTIME_LOAD_PATH_V0_2.md

Architecture doc update only if a durable lifecycle invariant is discovered.

## Report requirements

The report must contain:

- exact pre-fix Tauri symptom;
- previous `c7176de0` explanation and why it was insufficient;
- production checkpoint trace;
- actual root cause;
- last checkpoint reached before fix;
- production-coupled failing test;
- smallest implementation fix;
- P1-P15 results;
- previous H1-H13 regression results;
- before/after real Tauri trace;
- Human Intent Actions manual flow;
- light/dark results;
- lint/build/test results;
- diff check;
- Rust applicability;
- unrelated dirty files;
- SideX AI state classification;
- final recommendation:

    GO
    NARROW
    STOP / REDESIGN

## GO criterion

GO requires all of the following:

1. The exact real Tauri screenshot symptom is no longer reproducible.
2. The measured production path proves why it was happening.
3. Every load attempt terminates as READY or ERROR.
4. Storage failure is not disguised as successful fixture load.
5. Production-coupled tests cover the real classes/path.
6. Human Intent Actions still work.
7. READY and ERROR render correctly in light/dark themes.
8. lint/build/tests pass.
9. No unrelated subsystem was modified to mask the defect.

Success means:

> Runtime evidence, production-path tests, and the root-cause explanation all agree.
