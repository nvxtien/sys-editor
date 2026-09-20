# Execution mode clarification

This prompt is for an implementation agent that must **update the `nvxtien/sys-editor` codebase**.

Do not turn this task into a conversational walkthrough with the prompt runner.

Proceed autonomously through:

    brainstorming
    -> writing plan
    -> TDD
    -> code changes
    -> verification
    -> report

Only stop for human input if repository state is unsafe/ambiguous in a way that cannot be resolved from the codebase, tests, or this prompt.

# Prompt: Implement Sys Semantic Workbench Shell v0.1

Repository:

    nvxtien/sys-editor

This repository is a fork of SideX and is intended to become the human-facing GUI shell for Sys Platform.

## Product boundary

Keep the architectural boundary explicit:

    nvxtien/sys-platform
    = semantic/governance core
      - human intent / Formal Spec
      - governed ontology
      - recovered ontology
      - semantic comparison
      - verification
      - proposal / approval state

    nvxtien/sys-editor
    = human interaction / visualization shell
      - navigation
      - semantic status
      - intent visibility
      - review/evidence presentation
      - source navigation

The editor must not become a second semantic engine.

Durable invariant:

> Sys Editor may present trusted meaning. Sys Editor may not invent trusted meaning.

For this milestone, all Sys surfaces are **read-only**.

No human approval, requirement mutation, semantic inference, code proposal apply, or governance write is in scope.

## Why this milestone exists

User feedback says the CLI is still difficult to use.

The product problem is not merely command discoverability. Sys currently asks humans to understand a chain such as:

    requirement
    -> unresolved intent
    -> governed meaning
    -> recovered source meaning
    -> semantic mismatch
    -> verification
    -> human decision

That is too much context to keep mentally while navigating CLI output.

The GUI should reduce cognitive load by making the semantic state continuously visible.

This milestone tests whether a user can open a project and answer, without CLI knowledge:

1. What does the system mean?
2. What is unresolved?
3. What differs from source?
4. What evidence is available?
5. What requires attention?

Do not solve broader IDE UX yet.

## SideX reuse strategy

SideX is the shell, not the product semantics.

Preserve upstream structure as much as possible.

Prefer adding Sys as workbench contributions under a dedicated namespace such as:

    src/vs/workbench/contrib/sys/

Avoid invasive edits to:

    src/vs/base/
    src/vs/platform/
    src/vs/editor/

unless the existing workbench extension points are genuinely insufficient.

Follow existing VS Code/SideX contribution patterns for:

- activity bar / view containers;
- views;
- editor panes;
- commands;
- context keys;
- icons;
- services / dependency injection;
- styling.

Do **not** introduce React merely for Sys views. SideX already uses the VS Code workbench architecture; reuse its DOM/workbench patterns.

Do not rewrite existing explorer, editor, terminal, Git, search, themes, or tabs.

Do not rebrand the whole fork in this milestone.

Do not remove or redesign SideX's existing AI agent in this milestone.

## Goal

Add the first visible Sys product surface:

> A read-only **Sys Semantic Workbench** that lives inside the SideX/VS Code-style workbench and presents a bounded Cinema Booking semantic snapshot.

The primary deliverable is a new **Sys** Activity Bar entry with a semantic workspace that clearly separates:

    Governed Intent
    Recovered Meaning
    Semantic Sync
    Unresolved Intent
    Reviews
    Evidence

The UI should feel native to the existing workbench, not like an embedded unrelated web app.

## Information architecture

### Activity Bar

Add a new top-level activity entry:

    Sys

Opening it should show a Sys view container.

Minimum sections:

    Project
    Intent
    Semantic Sync
    Reviews
    Evidence

Exact labels may be refined if existing workbench conventions require it, but the semantic distinction must remain.

### Project summary

At the top, show a compact read-only summary equivalent to:

    Project: Cinema Booking

    Governed intent: AVAILABLE
    Recovered source meaning: PARTIAL
    Sync: PARTIAL / UNKNOWN
    Unresolved intent: 2
    Reviews requiring attention: 1

Do not invent status values. For v0.1, these come from the bounded fixture defined below.

### Intent

Show human-authoritative meaning, not source code.

For Cinema Booking, expose at least:

    createBooking

    - requestedSeats must contain at least one seat
    - requestedSeats must contain distinct seats
    - every requested seat hall must match the showtime hall
    - showtime must not be in the past under Asia/Ho_Chi_Minh
    - each (showtime, seat) may have at most one CONFIRMED booking
    - successful booking is CONFIRMED

Also show unresolved intent separately:

    customer validation
    status transition rules

Do not collapse unresolved intent into verification UNKNOWN.

These are different concepts.

### Semantic Sync

Show governed meaning beside recovered source meaning.

The user should be able to see a compact table/list equivalent to:

    Rule                         Governed     Recovered     State
    ----------------------------------------------------------------
    non-empty seats              KNOWN        UNKNOWN       PARTIAL
    distinct seats               KNOWN        UNKNOWN       PARTIAL
    hall consistency             KNOWN        UNKNOWN       PARTIAL
    past showtime                KNOWN        UNKNOWN       PARTIAL
    seat exclusivity             KNOWN        UNKNOWN       PARTIAL

Use existing status/icon conventions where possible.

Do not make red/error styling imply that source is wrong when the state is only unsupported/unknown.

### Reviews

Show at least one read-only review item derived from the measured Cinema pilot:

    Hall consistency

    Governed:
      seat.hallName == showtime.hallName

    Recovered:
      UNKNOWN

    State:
      PARTIAL / UNKNOWN

    Evidence:
      source recovery could not recover the guard

This milestone is read-only, so do not show functional Approve/Reject buttons.

If buttons/commands are visually required by an existing component, they must be disabled and clearly labelled as not yet available.

### Evidence

Expose source-oriented evidence without making source the primary model.

At minimum show:

    operation: createBooking
    source paths recovered: 6
    fully recovered guards: 0
    false greens: 0

Provide a source location link only if a stable location exists in the fixture.

If no valid source location is available, do not invent one.

## Center workspace

The Sys Activity Bar views are required.

In addition, implement one central **Semantic Workspace** surface if the existing workbench architecture supports it cleanly without broad framework changes.

Preferred layout:

    Governed Intent      Semantic State       Recovered Meaning
    ------------------------------------------------------------
    rule / invariant     PARTIAL / UNKNOWN    recovered evidence

A simpler single-column native workbench editor/view is acceptable for v0.1 if it keeps the information clear.

Do not build a complex graph visualization in this milestone.

Do not build an ontology graph explorer yet.

## Data boundary

Do not hard-code Cinema text directly across UI components.

Introduce one small typed application-facing model in Sys Editor, conceptually:

    SysProjectSnapshot {
      project
      operations[]
      governedRules[]
      unresolvedIntent[]
      syncItems[]
      reviews[]
      evidence
    }

Exact type names are flexible.

The UI must consume this model through a small read-only service boundary.

For v0.1, use a deterministic fixture-backed provider.

Example boundary:

    ISysSemanticSnapshotService
        getSnapshot(): Promise<SysProjectSnapshot>

or an equivalent existing workbench service pattern.

The important architectural seam is:

    UI
    -> typed read-only Sys snapshot service
    -> fixture now
    -> sys-platform adapter later

Do not let views read fixture files directly.

Do not let multiple views each invent their own data shape.

## Fixture

Create one deterministic fixture for the Cinema Booking pilot.

Prefer a location such as:

    src/vs/workbench/contrib/sys/test/fixtures/
    or
    src/vs/workbench/contrib/sys/common/

according to repository conventions.

It must encode the measured state from the completed Cinema pilot, including:

- `createBooking`;
- governed Cinema rules;
- unresolved human intent:
  - customer validation;
  - status transition rules;
- six recovered paths;
- zero fully recovered guards;
- `false_greens = 0`;
- hall consistency recovered as UNKNOWN / PARTIAL;
- no claim that Cinema rules are verified;
- no invented source semantics.

The fixture is a GUI/product fixture, not a new semantic oracle.

## Do not integrate Sys Platform yet by parsing CLI text

Do not implement:

    spawn sys
    -> scrape human-readable terminal output
    -> reconstruct semantic model in GUI

That would create a fragile second parser and violate the semantic boundary.

Also do not make the GUI call the SideX AI agent to summarize CLI output.

For this milestone:

    deterministic typed fixture
    -> typed read-only service
    -> GUI

is preferred.

A later milestone may add a typed Sys Platform adapter/API.

If the existing repository already contains a clean typed IPC/plugin seam that can consume a deterministic JSON snapshot without parsing text, it may be reused, but do not broaden scope into full cross-repo integration.

## Visual language

Use existing SideX/VS Code theme tokens and Codicons.

Do not hard-code light/dark colors.

Minimum semantic visual distinction:

    GOVERNED / KNOWN
    PARTIAL / UNKNOWN
    UNRESOLVED INTENT
    REVIEW ATTENTION
    EVIDENCE

Use text labels together with icons/color; do not rely on color alone.

Do not use alarming error red for merely unsupported or unresolved semantics unless existing workbench accessibility conventions require it.

## Cognitive-load principle

The GUI should answer semantic questions directly.

Avoid dumping:

- raw internal JSON;
- full ontology serialization;
- compiler IR;
- long provenance chains;
- path IDs without context.

Default view:

    human-readable meaning first

Expandable detail:

    evidence / provenance second

Raw fixture/debug data should not be the primary UI.

## Required interaction behavior

Even though v0.1 is read-only, these navigation interactions are required:

1. Clicking an operation focuses its semantic summary.
2. Clicking an unresolved intent item shows why it is unresolved.
3. Clicking a sync item shows governed vs recovered meaning.
4. Clicking a review item opens/focuses the review detail.
5. Clicking evidence shows the measured evidence associated with that semantic item.

If stable source location is available, clicking it should use the existing editor navigation service.

Do not implement a parallel navigation system.

## Mandatory brainstorming gate

Before production edits:

1. inspect SideX workbench contribution patterns;
2. find the smallest existing Activity Bar / view-container example;
3. find a native tree/list view example;
4. find an editor-pane or detail-view example if a center workspace is feasible;
5. identify existing DI/service patterns;
6. identify test conventions for workbench contributions;
7. verify whether adding Sys can be isolated under `workbench/contrib/sys`;
8. record which upstream files must be touched for contribution registration.

If implementing the central workspace would require invasive core changes, keep v0.1 to native sidebar/detail views and report that choice.

Do not modify workbench core merely to match a mockup.

## Reuse-before-reimplementation gate

Use this order:

1. existing SideX workbench contribution mechanisms;
2. existing VS Code-style view container/tree/list/editor patterns;
3. existing command/context-key/DI mechanisms;
4. existing Codicons/theme tokens;
5. custom infrastructure only if the above are insufficient.

Do not add a new UI framework.

## TDD / acceptance gates

Write focused tests before or alongside production changes according to repository conventions.

### G1 — Sys Activity Bar entry

Required:

    Sys entry exists
    opening it shows the Sys view container

### G2 — project semantic summary

Required:

    project name visible
    governed/recovered/sync/unresolved/review summary visible

### G3 — governed intent

Required:

    createBooking governed rules are visible
    rules are not read from source-code parsing in the UI

### G4 — unresolved intent is distinct

Required:

    customer validation
    status transition rules

appear as unresolved human intent.

Forbidden:

    rendering them as code verification UNKNOWN only

### G5 — semantic sync

Required:

    governed and recovered states are visible together
    hall consistency is PARTIAL/UNKNOWN, not VERIFIED

### G6 — review detail

Required:

    governed:
      seat.hallName == showtime.hallName

    recovered:
      UNKNOWN

    state:
      PARTIAL / UNKNOWN

No claim that source or spec is wrong.

### G7 — evidence

Required:

    recovered paths = 6
    fully recovered guards = 0
    false_greens = 0

### G8 — navigation

Required:

    selecting semantic items updates/focuses the corresponding detail

No dead placeholder navigation for the core v0.1 path.

### G9 — deterministic rendering

Same fixture produces structurally stable ordering and labels.

Do not depend on object/hash iteration order.

### G10 — theme compatibility

Required:

    no hard-coded color assumptions
    usable in at least existing light and dark theme test/manual check

### G11 — no semantic logic in UI

Add a falsification test or code-structure assertion where practical:

    the view layer consumes typed snapshot data

and does not:

    infer hall equality
    derive unresolved intent
    classify verification
    parse Formal Spec
    parse Java

### G12 — SideX core regression

Required:

    editor still opens
    explorer works
    terminal registration/build remains intact
    existing TypeScript/Rust checks remain green

Use the smallest existing automated smoke coverage where available.

## Manual product validation

After automated verification, perform a short manual run of the editor with the Cinema fixture.

A human should be able to answer from the GUI:

1. What is governed for `createBooking`?
2. What intent is unresolved?
3. Which semantic rules are not recovered from source?
4. Is hall consistency proven wrong, or merely unknown?
5. How many source paths were recovered?
6. Are there any false greens?

Record the answers in the report.

This manual validation is a product UX check, not a replacement for automated tests.

## Non-goals

Do NOT implement in this milestone:

- write/approval actions;
- human intent editing;
- spec approval;
- proposal generation;
- proposal apply;
- source mutation;
- Sys Platform live integration;
- CLI output parsing;
- SideX agent redesign;
- agent orchestration;
- ontology graph visualization;
- semantic search;
- cross-object semantic fix;
- collection/time/concurrency semantics;
- IDE-wide rebranding;
- updater changes;
- extension-host changes;
- debugger work.

Do not let this milestone become a SideX cleanup project.

## Upstream-fork discipline

Because this repository is a fork, record every touched upstream/core file.

Prefer:

    new Sys contribution files
    + minimal registration changes

over broad edits.

Create a short architecture note describing the fork boundary and where future Sys contributions should live.

The design goal is to keep future upstream merges feasible.

## Deliverables

Create/update:

- `docs/architecture/SYS_SEMANTIC_WORKBENCH_SHELL_V0_1.md`
- `docs/reports/SYS_SEMANTIC_WORKBENCH_SHELL_V0_1.md`
- Sys workbench contribution code under a dedicated namespace
- typed read-only snapshot model/service
- deterministic Cinema Booking fixture
- focused tests for G1-G12

If `docs/prompts/` or `docs/architecture/` does not yet exist, create the required directories/files through normal repository paths.

## Report requirements

The report must include:

- brainstorming conclusion;
- SideX contribution patterns reused;
- files changed;
- upstream/core files touched;
- written implementation plan actually followed;
- TDD evidence;
- G1-G12 results;
- screenshot or textual manual walkthrough evidence if the repo's test environment supports it;
- light/dark theme verification;
- build/lint/test results;
- Rust checks if Rust files were touched;
- unrelated dirty files;
- explicit non-goals preserved;
- UX observations from the Cinema walkthrough;
- final recommendation:

    GO
    NARROW
    STOP / REDESIGN

## GO criterion

GO requires:

1. Sys appears as a native workbench surface, not a separate web page.
2. A non-CLI user can understand the Cinema project's governed meaning, unresolved intent, semantic sync state, review state, and evidence.
3. The GUI does not invent semantic meaning.
4. The view layer consumes one typed read-only model through one service boundary.
5. Existing SideX editor fundamentals remain working.
6. Changes remain isolated enough that the fork can still reasonably track upstream.

Success for v0.1 is not "we built a new IDE."

Success is:

> A human can open Sys Editor and understand the semantic state of a project without knowing the Sys CLI.
