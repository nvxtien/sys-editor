# Execution mode clarification

This prompt is for an implementation agent that must **update `nvxtien/sys-editor`** and integrate it with the real state produced by `nvxtien/sys-platform`.

Do not turn this task into a conversational walkthrough with the prompt runner.

Proceed autonomously through:

    brainstorming
    -> integration-seam measurement
    -> writing plan
    -> TDD
    -> code changes
    -> verification
    -> real Tauri walkthrough
    -> report

Only stop for human input if repository state is unsafe or if Sys Platform does not expose enough structured machine-readable state to support a sound integration without inventing semantics.

# Prompt: Implement Sys Live Platform Integration v0.1

Repository:

    nvxtien/sys-editor

Related authoritative backend:

    nvxtien/sys-platform

This milestone follows:

- Sys Semantic Workbench Shell v0.1;
- Sys Human Intent Actions v0.1;
- the real Tauri rendering fix at commit `0b02ebca`.

## Goal

Replace the Cinema fixture as the **default product data source** with a typed adapter over real Sys Platform project state.

The GUI must continue to present:

- governed intent;
- unresolved intent;
- confirmed human intent;
- semantic sync state;
- reviews;
- evidence;

but those values must come from the actual opened Sys project rather than from a hard-coded Cinema snapshot.

The fixture remains available only for tests/demo fallback where explicitly selected.

## Product boundary

Keep this boundary strict:

    sys-platform
    = semantic/governance authority

    sys-editor
    = interaction / visualization shell

Therefore:

    Editor may deserialize trusted structured state.
    Editor may present trusted structured state.
    Editor may send explicit human actions through a typed boundary.

But:

    Editor may not reconstruct semantic meaning from source code.
    Editor may not classify semantic status itself.
    Editor may not infer unresolved intent.
    Editor may not parse human-readable CLI prose.
    Editor may not invent governed meaning.

## Integration principle

The preferred architecture is:

    Sys Editor
        ↓
    typed application adapter
        ↓
    stable machine-readable Sys Platform contract
        ↓
    Sys Platform

Not:

    Sys Editor
        ↓
    terminal text
        ↓
    regex/string scraping
        ↓
    reconstructed semantics

### Structured CLI transport is allowed only under this rule

If Sys Platform already exposes stable JSON machine output, it is acceptable for v0.1 to invoke the `sys` binary as a transport and deserialize that JSON into typed models.

That is **not** considered "CLI text parsing" if:

- the command is explicitly machine-readable;
- output is JSON only;
- the schema is validated;
- no human-facing prose is scraped;
- unknown/missing fields fail safely;
- semantic classifications are consumed, not recomputed.

Example acceptable shape:

    sys status --json
    sys intent --json
    sys review --json

provided those are real, stable outputs.

If the required state is not available as a structured machine contract, do **not** parse text output. Stop with:

    PLATFORM_API_GAP

and document exactly which typed fields are missing.

## Mandatory brainstorming gate

Before coding:

1. inspect the current Sys Editor snapshot and intent-action services;
2. inspect Sys Platform's current machine-readable JSON surfaces;
3. identify which real commands/APIs expose:
   - project identity;
   - governed requirement/spec state;
   - unresolved human intent;
   - confirmed human intent;
   - sync state;
   - review packet;
   - evidence;
   - proposal verification/human-approval state if already available;
4. record which required UI fields are directly available;
5. record which are unavailable;
6. determine the smallest sound transport:
   - existing structured JSON command;
   - existing Rust library/API seam;
   - existing file/schema contract;
7. prefer the lowest-coupling approach that does not duplicate semantic logic;
8. explicitly reject human-text scraping.

Do not choose the transport before measuring what Sys Platform actually exposes.

## Integration options, in preferred order

Evaluate in this order:

### Option A — stable structured application/library API

If Sys Platform already exposes a reusable Rust/application API that can be consumed cleanly by the Tauri backend without brittle repository-relative dependencies, prefer it.

### Option B — stable JSON machine contract

If the `sys` binary exposes the necessary data via JSON, use a typed sidecar/process adapter.

Requirements:

    spawn
    -> collect stdout
    -> parse JSON
    -> schema validate
    -> map structurally
    -> present

Do not parse stderr/stdout prose.

### Option C — versioned artifact/schema files

If Sys Platform persists a stable structured state file suitable for external readers, a read-only adapter may consume that.

Do not read undocumented internal files merely because they happen to exist.

### If none is sound

STOP / NARROW with:

    PLATFORM_API_GAP

Do not create a shadow semantic implementation in Sys Editor.

## Required typed boundary

Introduce one editor-facing service, conceptually:

    ISysPlatformService

with typed methods such as:

    detectProject(workspace)
    getProjectSnapshot(workspace)
    getIntentState(workspace)
    getReviewState(workspace)
    refresh(workspace)

Exact method names may differ.

The existing UI should consume a normalized editor model such as:

    SysProjectSnapshot

The transport adapter maps Sys Platform's structured contract into that model.

Views must not know whether data came from:

- a Rust library;
- a JSON subprocess;
- a structured artifact.

## Versioned contract

If JSON/process transport is used, define and validate a small contract version.

Conceptually:

    {
      "schemaVersion": 1,
      ...
    }

Unknown future major schema:

    -> explicit ERROR / UNSUPPORTED_VERSION

Do not silently deserialize incompatible data into defaults.

Missing required fields:

    -> ERROR / PARTIAL only if the backend explicitly marks them optional

Never:

    missing field
    -> guessed semantic value

## Project detection

When a workspace/folder is opened, Sys Editor should determine whether it is a Sys-managed project.

Required outcomes:

    SYS_PROJECT
    NOT_SYS_PROJECT
    ERROR

Do not treat "not configured" as an error.

For a non-Sys project, show a neutral empty state equivalent to:

    This workspace is not initialized for Sys.

Do not auto-run `sys init` in this milestone.

## Real project selection

For v0.1, integration is scoped to the currently opened workspace root.

Do not add multi-root project management unless SideX already makes it trivial and the current architecture requires it.

If there are multiple workspace folders and the integration cannot choose safely:

    show explicit selection / unsupported state

Do not guess.

## Read model requirements

For a real Sys project, populate the existing Semantic Workbench from authoritative backend fields.

At minimum:

### Project

- project/workspace identity;
- governed intent availability;
- recovered meaning state;
- sync state;
- unresolved intent count;
- confirmed intent count if backend exposes it;
- review attention count.

### Governed Intent

Human-authoritative rules/operations already represented by Sys Platform.

Do not derive them from source files in the editor.

### Unresolved Intent

Use Sys Platform's actual unresolved-intent register.

Do not reuse Cinema fixture values for a real project.

### Confirmed Human Intent

Use actual backend state.

Preserve:

    CONFIRMED HUMAN INTENT
    !=
    GOVERNED SPEC

### Semantic Sync

Use backend-provided classifications.

Do not recompute:

    KNOWN
    UNKNOWN
    PARTIAL
    SYNCED
    DRIFTED
    CONFLICTED

inside the GUI.

### Reviews

Use real review packet / structured review state where available.

### Evidence

Use structured evidence references/fields supplied by Sys Platform.

Do not invent source locations.

## Human intent actions

The GUI currently supports:

    propose clarification
    confirm clarification
    leave unresolved
    replace clarification

This milestone must determine which of these actions Sys Platform already supports through a structured write contract.

### If a real write API exists

Wire the action through it.

After successful write:

    refresh from backend
    render backend truth

Do not optimistically treat local state as authoritative.

### If a real write API does not exist

Keep the action disabled for live projects with explicit wording:

    Available after Sys Platform write API is connected.

The fixture/demo mode may keep local actions for tests.

Do not write directly into undocumented Sys Platform files.

Do not call a human-facing interactive CLI and simulate keystrokes.

Do not create a second governance store in Sys Editor.

## Read-after-write invariant

Whenever an action is wired:

    user action
    -> backend command/API
    -> backend success
    -> fresh authoritative read
    -> UI update

Never:

    user action
    -> local GUI mutation
    -> assume backend accepted

This is required for human/governance trust.

## Errors

The Semantic Workbench must have explicit states:

    DETECTING
    LOADING
    READY
    NOT_SYS_PROJECT
    ERROR

Every async attempt must terminate.

Never infinite loading.

Error examples:

- `sys` executable not found;
- invalid JSON;
- unsupported schema version;
- command non-zero exit;
- workspace unavailable;
- backend state inconsistent.

Show concise user-facing error text plus Retry.

Keep detailed diagnostics in logs.

## Sys binary discovery, if process transport is used

Do not hard-code one machine-specific absolute path.

Preferred discovery order:

1. explicit Sys Editor setting;
2. workspace/repository-known development binary if safely discoverable;
3. PATH lookup.

Record which path was selected in diagnostics.

Do not search arbitrary filesystem locations.

## Security

If spawning `sys`:

- invoke only known fixed commands;
- pass workspace path as a distinct argument, not shell-concatenated text;
- do not invoke through `sh -c` merely for convenience;
- do not pass secrets;
- cap output reasonably;
- handle malformed output safely.

## Fixture mode

Retain the Cinema fixture for:

- unit tests;
- deterministic UI development;
- explicit demo mode if currently useful.

But it must no longer silently activate when live backend loading fails.

Critical rule:

    live backend ERROR
    !=
    fixture READY

Fixture use must be explicit.

## Source evidence navigation

Do not implement full source evidence navigation in this milestone.

However, preserve source/evidence identifiers in the typed model so a later milestone can navigate them.

Do not throw useful backend evidence away.

## TDD / acceptance gates

Write focused tests against the real adapter/service boundary.

### I1 — non-Sys workspace

Given a workspace without Sys metadata:

    state = NOT_SYS_PROJECT

No Cinema fixture appears.

### I2 — real structured snapshot

Given valid backend structured output:

    project model populated
    governed rules populated
    sync states preserved exactly

### I3 — no semantic recomputation

Backend says:

    PARTIAL

GUI model must say:

    PARTIAL

even if local code could "infer" something else.

### I4 — unresolved intent from backend

Real backend unresolved items appear.

Fixture unresolved items do not leak into live mode.

### I5 — confirmed intent distinction

Backend confirmed intent renders as:

    CONFIRMED HUMAN INTENT
    NOT YET GOVERNED

when that is the actual backend state.

### I6 — schema version

Supported schema:

    accepted

Unsupported major schema:

    ERROR

### I7 — malformed JSON

    -> ERROR

No partial best-effort semantic reconstruction.

### I8 — backend non-zero exit

    -> ERROR

Include sanitized backend diagnostic.

### I9 — binary not found

    -> explicit ERROR / setup guidance

No fixture fallback.

### I10 — refresh

Backend state changes between reads.

After refresh:

    GUI shows new authoritative state

### I11 — no infinite loading

Every adapter call terminates into:

    READY
    NOT_SYS_PROJECT
    ERROR

### I12 — read-after-write

If one write action is supported:

    write
    -> reread
    -> UI reflects reread

Test that local optimistic state is not authoritative.

If no write API exists, test that live action is disabled.

### I13 — unknown backend field preservation

The adapter must ignore forward-compatible optional fields safely while retaining required evidence fields.

Do not fail simply because a newer backend adds optional fields.

### I14 — deterministic ordering

Same backend snapshot produces stable ordering of:

- operations;
- intent items;
- sync items;
- reviews.

### I15 — fixture/live separation

Test explicitly:

    backend failure
    != fixture fallback

### I16 — no prose scraping

Add a structural/falsification test where practical proving that the adapter consumes JSON/schema, not line-based human text/regex extraction.

### I17 — theme/UI regression

Existing light/dark workbench rendering remains readable.

### I18 — SideX regression

Required:

    npm run lint
    npm run build
    git diff --check

and focused Sys tests.

If Rust/Tauri files are changed, run relevant Rust checks.

## Real integration pilot

Use one actual Sys-managed workspace.

Preferred:

    the Cinema Booking pilot workspace already used by Sys Platform

or another existing deterministic Sys project.

Do not fabricate backend state.

Manual walkthrough:

1. Open the real project in Sys Editor.
2. Open Sys Activity Bar.
3. Verify project is detected as Sys-managed.
4. Confirm the GUI is not showing hard-coded Cinema fixture data unless that real project actually is Cinema.
5. Compare one project-level status with Sys Platform's own structured output.
6. Compare one unresolved/confirmed intent item.
7. Compare one semantic sync item.
8. Compare one review/evidence item if available.
9. Refresh after an external Sys Platform state change.
10. Verify the GUI updates from authoritative reread.

Record exact evidence.

## Architecture requirement

Create one durable architecture seam:

    Sys Platform Contract
        ↓
    Sys Platform Adapter
        ↓
    Sys Editor Read Model
        ↓
    Workbench Views

Do not allow:

    Workbench View
        ↓
    process/file/CLI parsing directly

Only the adapter knows transport.

## Non-goals

Do NOT implement:

- general source navigation;
- semantic code diff;
- proposal application;
- agent orchestration;
- SideX AI integration;
- ontology graph visualization;
- collection/time/concurrency semantics;
- business-rule inference;
- IDE-wide rebranding;
- auto-init;
- multi-project dashboard;
- speculative backend APIs.

If a backend API is missing, report it instead of inventing a shadow authority.

## Deliverables

Create/update:

- `docs/architecture/SYS_LIVE_PLATFORM_INTEGRATION_V0_1.md`
- `docs/reports/SYS_LIVE_PLATFORM_INTEGRATION_V0_1.md`
- typed platform contract models
- one transport adapter
- live project snapshot service
- fixture/live mode separation
- focused tests I1-I18

If a tiny Sys Platform schema document is required, add it only if it describes an existing structured contract or a narrowly agreed new machine contract. Do not redesign Sys Platform from this repo.

## Report requirements

The report must include:

- Sys Platform surfaces inspected;
- fields available vs missing;
- transport chosen and rejected alternatives;
- exact schema/versioning approach;
- files changed;
- production integration path;
- fixture/live separation;
- I1-I18 results;
- real workspace walkthrough;
- read-after-write result or explicit write-API gap;
- lint/build/test results;
- Rust checks if applicable;
- unrelated dirty files;
- explicit non-goals preserved;
- final recommendation:

    GO
    NARROW
    PLATFORM_API_GAP
    STOP / REDESIGN

## GO criterion

GO requires:

1. A real Sys-managed project loads into Sys Editor without hard-coded semantic fixture data.
2. Semantic status comes from Sys Platform, not GUI inference.
3. Structured machine contracts are used; no human CLI prose is scraped.
4. Live backend failure never silently falls back to fixture success.
5. Unsupported/malformed/version-mismatched contracts fail visibly.
6. At least the read path is authoritative and refreshable.
7. Any wired write action obeys read-after-write.
8. Existing Human Intent UI semantics do not regress.
9. Real Tauri walkthrough passes.
10. lint/build/focused tests pass.

Success is not:

    "the editor can run a sys command."

Success is:

> Sys Editor becomes a trustworthy visual projection of real Sys Platform state.
