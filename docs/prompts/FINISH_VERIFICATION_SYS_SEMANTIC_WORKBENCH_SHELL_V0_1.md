# Execution mode clarification

This prompt is for an implementation agent that must **finish verification for the existing Sys Semantic Workbench Shell v0.1 implementation in `nvxtien/sys-editor`**.

Do not redesign the feature.
Do not add new product scope.
Do not turn this into a conversational walkthrough.

Proceed autonomously through:

    inspect current implementation
    -> restore runnable dependency state
    -> run blocked verification
    -> fix only verification-discovered regressions
    -> rerun verification
    -> short manual walkthrough
    -> report

# Prompt: Finish Verification — Sys Semantic Workbench Shell v0.1

Repository:

    nvxtien/sys-editor

The implementation is already present.

Reported completed work:

- native Sys Activity Bar container;
- Semantic Workbench view;
- typed snapshot service;
- deterministic Cinema Booking fixture;
- Project, Intent, Semantic Sync, Reviews, Evidence sections;
- VS Code theme-token styling;
- registration in the main workbench contribution entry point.

Reported checks already completed:

    editor diagnostics: no errors
    git diff --check: PASS

Blocked checks:

    dependency installation exhausted available disk space
    therefore ESLint/build were not completed

## Goal

Finish the **verification phase only** for the existing milestone.

The milestone is not GO until the workbench can be verified against the repository's normal build/lint/test gates.

Do not use the disk-space failure as a reason to alter architecture or reduce acceptance criteria.

## Scope discipline

Allowed:

- free/recover enough local disk space to install dependencies;
- restore/reuse an existing dependency cache if safe;
- run the repository's normal build/lint/test commands;
- fix compilation, lint, type, registration, deterministic-rendering, or focused Sys-view defects discovered by verification;
- add a narrowly missing focused test only if required to verify an existing acceptance gate;
- update the milestone report with real evidence.

Not allowed:

- new GUI features;
- new Sys views;
- live sys-platform integration;
- CLI parsing;
- write/approval actions;
- rebranding;
- SideX agent redesign;
- semantic inference in UI;
- changing the Cinema semantic fixture to hide failures;
- weakening tests or acceptance gates.

## Working-tree safety

Before doing anything:

1. record `git status --short`;
2. record current branch and HEAD;
3. record all files already changed by the milestone;
4. do not overwrite unrelated work;
5. if cleanup is required for disk space, do not delete user source, repository history, or unrelated working data.

If dependency cleanup is needed, prefer removable build/cache artifacts over source or user data.

## Disk-space recovery

First diagnose the actual blocker.

Record:

    df -h
    du summary for the largest safe-to-remove build/cache directories relevant to this repo

Use the smallest safe cleanup necessary.

Examples of acceptable cleanup if present:

- stale `node_modules` from disposable/scratch worktrees;
- old build output;
- package-manager caches that can be restored;
- Tauri/Rust target artifacts from prior builds;
- temporary files created by the failed install.

Do not perform broad destructive cleanup outside relevant development caches/workspaces without evidence.

After cleanup, record free space again.

## Dependency restore

Use the repository's existing package-manager contract.

Do not change dependencies merely to make installation smaller.

Prefer the existing lockfile/install command already used by the repo.

If installation still fails for infrastructure reasons, report the exact failure and stop with:

    VERIFICATION_BLOCKED

Do not claim GO.

## Required verification gates

Run and record exact commands and results.

At minimum:

### V1 — dependency installation

Required:

    dependency restore/install completes successfully

### V2 — TypeScript/ESLint

Run the repository's normal lint command, expected from package scripts:

    npm run lint

Required:

    PASS

If lint reports pre-existing unrelated failures, identify them precisely and separate them from Sys changes.

Do not silently suppress rules.

### V3 — production build

Run:

    npm run build

Required:

    PASS

This is the key missing gate from the prior attempt.

### V4 — focused Sys tests

Run any tests added for the Sys workbench contribution.

If the repository has no general test script, execute the focused test mechanism used by the implementation.

Required coverage should still demonstrate:

- Sys Activity Bar registration;
- deterministic fixture/service;
- project summary;
- governed intent;
- unresolved intent separated from verification unknown;
- Semantic Sync state;
- review detail;
- evidence values;
- deterministic ordering;
- no semantic inference in view code where practically assertable.

### V5 — existing workbench smoke checks

Run the smallest existing automated checks available for:

- workbench contribution registration;
- editor startup/build;
- explorer/editor fundamentals if a smoke suite exists.

Do not create a broad new test framework if none exists.

### V6 — Rust checks only if Rust changed

If this milestone touched Rust/Tauri files:

    npm run rust:check

and, where appropriate:

    npm run rust:fmt
    npm run rust:clippy

If no Rust files changed, state explicitly:

    Rust verification not applicable to this milestone

### V7 — diff hygiene

Run:

    git diff --check

Required:

    PASS

### V8 — repository cleanliness / attribution

At the end:

    git status --short

Report:

- milestone files;
- unrelated dirty files;
- generated files intentionally left untracked, if any.

## Manual Cinema walkthrough

After automated gates pass, launch the app using the repository's normal development command if feasible.

Use the existing deterministic Cinema fixture.

Verify a human can answer from the GUI, without Sys CLI knowledge:

1. What operation is being governed?
   Expected:
       createBooking

2. What human intent is unresolved?
   Expected:
       customer validation
       status transition rules

3. Is hall consistency proven wrong?
   Expected:
       No.
       It is PARTIAL / UNKNOWN on the recovered side.

4. What does the governed side say?
   Expected:
       seat.hallName == showtime.hallName

5. How many source paths were recovered?
   Expected:
       6

6. How many fully recovered guards?
   Expected:
       0

7. Any false greens?
   Expected:
       0

Also inspect at least one existing light theme and one existing dark theme.

Record whether:

- text remains readable;
- status distinctions are understandable;
- no hard-coded light/dark assumptions are visible;
- unresolved/unknown is not styled as a proven error.

If launching the GUI is blocked by a separate environment limitation after build passes, record that limitation precisely. Do not substitute screenshots invented from source.

## Regression-fix rule

If build/lint/manual verification finds a defect, fix only the smallest defect required for the existing milestone.

Examples:

    missing import
    bad contribution registration
    type mismatch
    invalid Codicon/theme token
    unstable list ordering
    inaccessible label
    broken fixture binding

After any fix:

    rerun the focused failing gate
    then rerun lint + build
    then rerun affected focused tests

Do not opportunistically refactor SideX.

## Architecture invariants to re-check

Verification must confirm the implementation still obeys:

    sys-editor = presentation / interaction shell
    sys-platform = semantic authority

and:

    GUI may present trusted meaning
    GUI may not invent trusted meaning

Specifically verify the view layer does NOT:

- infer hall consistency;
- derive unresolved intent;
- parse Java;
- parse Formal Spec;
- classify semantic verification itself;
- reconstruct semantics from CLI text.

The typed snapshot service remains the only v0.1 semantic-data boundary.

## Report update

Update/create:

    docs/reports/SYS_SEMANTIC_WORKBENCH_SHELL_V0_1.md

The report must contain:

- prior verification blocker;
- disk-space diagnosis;
- cleanup performed;
- free space before/after;
- dependency-install result;
- exact lint result;
- exact build result;
- focused test results;
- smoke-check result;
- Rust check applicability/result;
- `git diff --check`;
- manual Cinema walkthrough;
- light/dark theme check;
- any defects found during verification and their fixes;
- unrelated dirty files;
- final recommendation:

    GO
    NARROW
    VERIFICATION_BLOCKED

## GO criterion

GO only if:

1. dependency installation succeeds;
2. lint succeeds for the milestone changes;
3. production build succeeds;
4. focused Sys verification succeeds;
5. existing workbench fundamentals remain intact to the extent covered by available smoke checks;
6. the Cinema GUI walkthrough is semantically truthful;
7. no semantic logic has migrated into the UI;
8. no unresolved infrastructure blocker remains.

If disk/resource limits still prevent lint/build after reasonable safe cleanup:

    VERIFICATION_BLOCKED

not GO.

Do not add features. Finish the evidence.
