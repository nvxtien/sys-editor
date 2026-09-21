# Mission: New Workspace → First Requirement Flow v0.1

## Delegation

You are Claude acting as the implementation owner for **one focused product sprint**.

Your job is to take this mission from investigation through implementation, tests, verification, and a clean commit.

Do not stop after analysis or a partial scaffold if the acceptance criteria are achievable.

Follow this execution order:

    Brainstorming
    → Writing plans
    → TDD
    → Implementation
    → Verification
    → only then GO / NARROW / STOP

Do not silently weaken acceptance criteria.
Do not fabricate desktop/manual evidence you did not actually observe.

---

# Product problem

Today a user can open a completely unrelated/new workspace in Sys Editor, for example:

    my-java21-app

but the SYS sidebar still shows product state from the Cinema Booking demo:

    SEMANTIC WORKBENCH
    Cinema Booking (Fixture)

and:

    VERIFICATION
    cinema-booking
    Data source: LIVE

That is incorrect product behavior.

The current UI is exposing fixture/demo configuration and a fixed verification manifest instead of representing the current workspace.

A brand-new workspace should not look as if it already contains Cinema Booking governed requirements.

This mission creates the first real workspace lifecycle:

    Open workspace
        ↓
    detect current workspace
        ↓
    detect whether this workspace has Sys project state
        ├─ no
        │   ↓
        │  empty-state onboarding
        │   ↓
        │  Create first requirement
        │
        └─ yes
            ↓
           load that workspace's Sys state

The product must stop treating the Cinema fixture as the implicit default.

---

# Product principle

The first question Sys asks in a new project should effectively be:

    What should this software do?

A new user must not need to know about:

- manifest.json;
- platformBinary;
- target_operation;
- verification.v0.1 wire format;
- fixture mode;
- semantic JSON;
- CLI commands.

Those are implementation/harness concepts, not first-use product UX.

---

# Mission

Implement one minimal but real vertical slice:

    open new workspace
    → Sys recognizes there is no governed project state
    → fixture/demo content is not shown as normal project state
    → user creates one tiny requirement from the GUI
    → requirement is persisted inside the current workspace
    → reopening / refreshing the workspace preserves that requirement
    → the UI clearly represents this workspace, not Cinema Booking

This sprint is primarily about **workspace ownership and first-requirement onboarding**.

Do not widen it into a full requirements editor, full ontology authoring UI, or arbitrary project setup wizard.

---

# Required UX

## State A — brand-new workspace

Example workspace:

    my-java21-app

When it has no Sys project state, SYS should show an empty state similar to:

    SYS

    No governed requirements yet.

    Create the first requirement for this workspace.

    [ Create first requirement ]
    [ Open demo ]              (optional; only if a demo entry already fits cleanly)

It must NOT show, as if belonging to the current project:

    Cinema Booking (Fixture)
    cinema-booking
    B1 / B2 / B8
    fixed live verification state from another manifest

The exact wording and layout may differ.

The semantic requirement is:

    CURRENT_WORKSPACE_HAS_NO_SYS_STATE
    → EMPTY_STATE

not:

    CURRENT_WORKSPACE_HAS_NO_SYS_STATE
    → CINEMA_FIXTURE

---

## State B — create first requirement

Click:

    Create first requirement

Present a minimal GUI form.

Required fields for v0.1:

    Requirement text

Optional if useful:

    short title / generated display id

A valid example:

    A booking request must contain at least one seat.

The user should be able to save it without editing JSON.

Do not require source binding in the very first form unless it is naturally available from the current implementation.

---

## State C — governed-intent review

After the requirement text is captured, the UI must make the governance boundary explicit.

At minimum show:

    Requirement
    <human-authored text>

    Status
    DRAFT / NEEDS REVIEW / equivalent

and require an explicit human action before representing the requirement as approved/governed.

Preferred:

    [ Approve governed intent ]
    [ Edit ]

Do not let an LLM, parser, or heuristic silently certify human intent.

If semantic formalization is not yet implemented for arbitrary new requirements, that is acceptable in this sprint.

In that case store/display the requirement as human-authored governed-intent input with an honest status such as:

    DRAFT
    UNFORMALIZED
    NEEDS SEMANTIC FORMALIZATION

Do NOT pretend it is EXACT or VERIFIED unless the platform actually produced that evidence.

---

# Workspace persistence

Create a minimal project-local Sys state.

Choose the smallest maintainable representation.

Examples of acceptable directions:

    .sys/
      project.json
      requirements.json

or:

    .sys/
      requirements/
        <requirement-id>.json

The exact shape is yours to design after inspecting the codebase.

Requirements:

1. State belongs to the opened workspace.
2. It must not live only in browser memory.
3. It must survive:
   - view refresh;
   - Sys Editor restart;
   - workspace reopen.
4. It must not overwrite normal source files.
5. It must be deterministic and inspectable.
6. The current workspace must be the authority for selecting this state.
7. Opening a second workspace must not reuse the first workspace's state.

Do not introduce a database for this.

---

# Workspace identity

Use the editor/workbench workspace APIs already available in the codebase.

Do not derive the active project from:

- the Cinema manifest path;
- process cwd unless it is already the editor's authoritative workspace root;
- a hard-coded path;
- the title bar text;
- the last workspace used by Sys.

If there are multiple workspace folders, either:

- support them correctly; or
- explicitly stop with a bounded unsupported state for v0.1.

Never silently pick the wrong folder.

---

# Existing Semantic Workbench behavior

The current Semantic Workbench shows:

    Cinema Booking (Fixture)

in a real unrelated workspace.

Fix this product behavior.

The preferred outcome is one of:

### Option 1 — project-aware replacement

The Semantic Workbench becomes workspace-aware and shows the new-project empty state.

### Option 2 — separate onboarding surface

A project-aware Sys Project / Requirements view owns onboarding, while the old fixture Semantic Workbench is explicitly marked and moved behind demo/development mode.

What is NOT acceptable:

    new workspace
    → automatically display Cinema Booking fixture as normal user data

Fixture/demo data must be opt-in.

---

# Existing Verification behavior

The Verification view may currently be configured globally with:

    sys.verification.platformBinary
    sys.verification.manifestPath

This sprint does NOT need to redesign the entire live verification configuration.

However:

- a new workspace with no Sys project state must not present another project's verification results as if they belong to this workspace;
- if the configured manifest is external/unrelated, the UI must clearly separate it from current-project state or hide/disable verification until the workspace is configured.

A safe v0.1 empty state is acceptable:

    Verification is not configured for this workspace.

Do not fabricate a semantic verdict.

Do not silently fall back to fixture.

---

# First requirement model

Keep the model deliberately small.

Recommended conceptual model:

    SysProject {
        version
        workspace identity / relative root metadata as needed
        requirements[]
    }

    Requirement {
        id
        text
        status
        createdAt?
        updatedAt?
    }

Keep timestamps only if they add product value and do not hurt determinism in tests.

The requirement id must be stable after creation.

Do not use the requirement text itself as the only identity.

Do not put semantic meaning in an opaque random id.

---

# Human governance invariant

This sprint must preserve:

    User = intent + approval
    LLM = proposal / hypothesis generator
    Sys = semantic governor + verifier

If no formal semantic compilation path exists for arbitrary user-entered requirements yet:

    human text captured
    ≠ formal semantic object
    ≠ verified requirement

Represent this honestly.

Do not auto-label new text as:

    SPECIFIED / EXACT / SYNCED

unless the existing platform actually establishes that.

---

# Minimal vertical acceptance scenario

Use a clean temporary workspace/project.

Example:

    my-java21-app/

with ordinary Java files but no Sys metadata.

## Scenario 1 — first open

Open it in Sys Editor.

Expected:

    workspace name = my-java21-app
    Sys has no governed requirements
    empty-state onboarding visible

Forbidden:

    Cinema Booking (Fixture) presented as this project's state
    cinema-booking verification results presented as this project's state

## Scenario 2 — create requirement

Click:

    Create first requirement

Enter:

    A booking request must contain at least one seat.

Save.

Expected:

    requirement appears in Sys UI
    text is exact / faithfully stored
    status is honest
    project-local persistence exists

## Scenario 3 — persistence

Close/restart or otherwise perform the strongest practical reload available.

Reopen the same workspace.

Expected:

    same requirement reappears
    same stable id
    no Cinema fixture substitution

## Scenario 4 — isolation

Open a second clean workspace.

Expected:

    it has its own empty state
    it does not show the requirement created in my-java21-app

This isolation test is mandatory.

---

# TDD requirements

Add tests before/with implementation for at least:

1. no Sys state → empty-state project model;
2. new requirement creation;
3. requirement persistence and reload;
4. stable requirement id after reload;
5. workspace A data does not appear in workspace B;
6. fixture is never selected merely because project state is absent;
7. verification/demo content is not misrepresented as current-workspace state;
8. malformed project-local Sys state produces a bounded infrastructure/configuration error, not fake semantic data;
9. no silent fixture fallback;
10. UI renders the new-project state without throwing.

Prefer pure tests for persistence/project-state logic plus focused workbench/view tests.

Do not make all product behavior depend on brittle DOM snapshots.

---

# Error handling

Differentiate clearly:

    NO_SYS_PROJECT_YET
    MALFORMED_SYS_PROJECT
    IO_ERROR
    UNSUPPORTED_MULTI_ROOT_WORKSPACE   (only if multi-root is intentionally not supported yet)

A malformed .sys state must not be treated as:

    no project
    fixture
    verified
    synced

A persistence error must be visible and bounded.

---

# Scope constraints

Allowed:

- add a small project-state model;
- add project-local persistence;
- add workspace-aware service/provider;
- add/modify the SYS sidebar view;
- add an onboarding empty state;
- add first-requirement form/action;
- explicitly separate demo/fixture mode;
- add focused tests;
- add minimal settings only when unavoidable.

Not allowed:

- redesigning verification semantics;
- changing sys-platform verdict logic;
- building a generic ontology editor;
- adding LLM-generated semantics and claiming them governed;
- auto-generating a manifest and claiming verification without user-visible governance;
- adding a database;
- depending on Cinema Booking paths;
- hard-coding my-java21-app;
- making fixture the fallback;
- adding Java-specific requirement logic;
- implementing B1/B2 domain behavior in the UI.

---

# Demo / fixture policy

Cinema Booking is valuable as a demo and regression harness.

It should remain available, but explicitly as demo/test data.

Good:

    Open Demo: Cinema Booking

or:

    sys.demoMode = true

or an equivalent explicit route.

Bad:

    no project state
    → automatically show Cinema Booking

Required invariant:

    SILENT_FIXTURE_FALLBACK = 0

---

# Verification boundary

This sprint may stop before arbitrary new requirement semantics can be verified.

That is acceptable.

The user journey proved by this sprint is:

    New workspace
    → own Sys project state
    → first human requirement
    → explicit governance status
    → durable persistence

The next sprint may extend that to:

    requirement
    → bind source operation
    → formalize governed semantics
    → implement
    → Verify
    → SYNCED

Do not fake those later stages here.

---

# Manual desktop acceptance

Run the real desktop application:

    npm run tauri dev

Use a clean workspace not named Cinema Booking and not containing the existing verification fixture.

Capture/record the following observations:

1. initial SYS view;
2. absence of Cinema fixture as current-project state;
3. create first requirement;
4. requirement appears;
5. reload/reopen;
6. requirement persists;
7. second workspace does not see it.

If you cannot perform real desktop interaction, say so explicitly and return CHECKPOINT_REACHED rather than fabricating proof.

---

# Existing known unrelated issues

Do not expand scope to fix unrelated issues unless they directly block this mission.

Known examples from prior work may include:

- source symbol navigation without a language provider;
- B8 WRONG_OPERATION_SCOPE rendering;
- pre-existing TypeScript errors outside changed files;
- skipped tests unrelated to this flow.

Record them, but do not let them derail the sprint.

---

# Safety gates

Required at completion:

    SILENT_FIXTURE_FALLBACK = 0
    CROSS_WORKSPACE_STATE_LEAK = 0
    FAKE_GOVERNED_STATUS = 0
    FAKE_VERIFICATION_VERDICT = 0
    DOMAIN_SPECIFIC_UI_LOGIC = 0
    HARD_CODED_PROJECT_PATHS = 0

And:

    CURRENT_WORKSPACE_OWNS_SYS_STATE = YES

---

# Success condition

Success requires all of the following:

1. a clean workspace opens with a Sys onboarding/empty state;
2. Cinema Booking is not presented as that workspace's project state;
3. the user can create one requirement using GUI only;
4. the requirement is stored in current-workspace Sys state;
5. it survives reload/reopen;
6. another workspace does not see it;
7. human governance status is represented honestly;
8. no semantic verdict is fabricated;
9. fixture/demo is opt-in only;
10. focused automated tests pass;
11. real desktop behavior is observed, or the report explicitly stops at CHECKPOINT_REACHED if manual interaction cannot be performed.

On full success report:

    FIRST_REQUIREMENT_WORKSPACE_FLOW_PROVEN

---

# Stop / narrow conditions

## CHECKPOINT_REACHED

Use when implementation/tests are complete but real desktop interaction could not be performed.

## WORKSPACE_API_GAP

Use when the current editor architecture cannot reliably identify the active workspace without a larger foundational change.

## PERSISTENCE_BOUNDARY_GAP

Use when writing project-local Sys state cannot be done through existing file/workspace services without adding unsafe filesystem shortcuts.

## NARROW_REQUIRED

Use when the full create-form flow is blocked, but the following can still be soundly completed:

    new workspace
    → empty state
    → no fixture substitution
    → project-local state detection

If narrowing, do not claim first-requirement creation is proven.

## STOP_UNSOUND

Use if success would require:

- global state masquerading as workspace state;
- fixture fallback;
- fake governed status;
- fake verification;
- hard-coded project paths.

---

# Engineering hygiene

Before finalizing:

- inspect git diff;
- remove temporary logging;
- do not commit .DS_Store;
- do not include unrelated changes;
- keep the working tree clean;
- run targeted lint/type checks for changed files;
- run relevant existing Sys verification tests;
- record any pre-existing failures separately.

Commit the intended changes.

Do not claim the whole repository is clean if unrelated pre-existing checks still fail.

---

# Required final report

RESULT:
FIRST_REQUIREMENT_WORKSPACE_FLOW_PROVEN |
CHECKPOINT_REACHED |
WORKSPACE_API_GAP |
PERSISTENCE_BOUNDARY_GAP |
NARROW_REQUIRED |
STOP_UNSOUND

SYS_EDITOR_COMMIT:
...

WORKSPACE_DETECTION:
...

NEW_WORKSPACE_UI:
...

FIXTURE_POLICY:
...

PROJECT_STATE_LOCATION:
...

PROJECT_STATE_FORMAT:
...

FIRST_REQUIREMENT_CREATED:
YES | NO

GOVERNANCE_STATUS:
...

PERSISTENCE_RELOAD:
PASS | FAIL | NOT_RUN

CROSS_WORKSPACE_ISOLATION:
PASS | FAIL | NOT_RUN

VERIFICATION_VIEW_BEHAVIOR_FOR_UNCONFIGURED_WORKSPACE:
...

SILENT_FIXTURE_FALLBACK:
0 | explain

FAKE_GOVERNED_STATUS:
0 | explain

FAKE_VERIFICATION_VERDICT:
0 | explain

DOMAIN_SPECIFIC_UI_LOGIC:
0 | explain

AUTOMATED_TESTS:
commands + counts + failures/skips

MANUAL_TAURI_EVIDENCE:
...

PRE_EXISTING_FAILURES:
...

NEXT_PRODUCT_GAP:
...

Stop after this workspace-first-requirement vertical slice is proven or a stop condition is reached.
