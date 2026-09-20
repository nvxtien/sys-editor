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

# Prompt: Implement Sys Human Intent Actions v0.1

Repository:

    nvxtien/sys-editor

This milestone follows the completed read-only Sys Semantic Workbench Shell v0.1.

## Goal

Turn the existing read-only `Unresolved Intent` surface into a small **human decision workspace**.

A user must be able to:

1. select an unresolved intent item;
2. enter a clarification;
3. review exactly what they entered;
4. explicitly confirm the clarification;
5. leave the item unresolved instead;
6. replace a previously confirmed clarification only after seeing old vs new meaning.

This milestone is about **human-owned intent interaction in the GUI**.

It is NOT about new semantic inference.

## Product boundary

Keep the architecture explicit:

    nvxtien/sys-platform
    = semantic/governance authority

    nvxtien/sys-editor
    = interaction / visualization shell

Durable invariants:

    GUI may present trusted meaning.
    GUI may collect human meaning.
    GUI may not invent human meaning.
    GUI confirmation != governed spec approval.

The editor must never silently promote an entered clarification into governed authority.

For this milestone, the GUI owns only the **interaction state** around unresolved intent.

## Existing product state

The current Sys Semantic Workbench already displays:

- project summary;
- governed intent;
- unresolved intent;
- semantic sync;
- review state;
- evidence;
- deterministic Cinema Booking fixture.

Known unresolved items include:

    customer validation
    status transition rules

The current milestone adds actions to those items.

## Critical governance distinction

Preserve this flow:

    UNRESOLVED
        ->
    human enters clarification
        ->
    CANDIDATE
        ->
    human explicitly confirms
        ->
    CONFIRMED HUMAN INTENT

But:

    CONFIRMED HUMAN INTENT
    !=
    GOVERNED SPEC

The existing Sys Platform governance flow remains the authority that turns confirmed meaning into governed meaning.

The GUI must communicate this distinction clearly.

Recommended wording:

    Confirmed intent
    Not yet governed

Do not display:

    Approved
    Governed

unless the underlying authoritative state actually says so.

## No invented interpretation

If the human types:

    Vietnam

the GUI must not silently transform it into:

    Asia/Ho_Chi_Minh

unless that exact transformation comes from an authoritative backend result.

For this milestone's local action service, reflect the user's words exactly.

Likewise, do not generate:

- validation rules;
- status transition policies;
- implementation mechanisms;
- suggested business meaning.

The UI may provide neutral examples/placeholders only if they are clearly non-authoritative and not inserted into the user's value.

## UX target

Selecting an unresolved item should open/focus a native workbench detail view equivalent to:

    Unresolved Intent

    Customer validation

    Current state:
      UNRESOLVED

    Why unresolved:
      The specification defines customer.name and customer.phone
      but does not define validation semantics.

    Your clarification:
      [................................................]

    [Leave unresolved]
    [Review clarification]

After entering text:

    Proposed human meaning

      <exact user text>

    This confirmation records your intended meaning.
    It does not yet make the rule governed.

    [Back]
    [Confirm intent]

After confirmation:

    Status:
      CONFIRMED HUMAN INTENT

    Meaning:
      <exact user text>

    Governance:
      NOT YET GOVERNED

    [Replace clarification]

The exact visual treatment should follow existing SideX/VS Code workbench conventions.

## Replacement flow

For an already confirmed item, changing intent must never overwrite silently.

Required flow:

    Existing confirmed meaning:
      <old>

    Proposed replacement:
      <new>

    [Cancel]
    [Confirm replacement]

After confirm:

    confirmed meaning = <new>

If declined/cancelled:

    confirmed meaning remains <old>

No state loss is allowed.

## Leave unresolved

The user must be able to deliberately keep the item unresolved.

Required:

    status = UNRESOLVED
    leftOpenByHuman = true

The UI should explain:

    No default was applied.

Do not remove the item from the unresolved list merely because the user opened it.

If the user later adds a clarification, the item can move through candidate -> confirmed.

## Scope: UI action state only

This milestone should introduce a typed action/state service behind the GUI.

Conceptually:

    ISysIntentActionService

    getIntentItems()
    proposeClarification(id, text)
    confirmClarification(id)
    leaveUnresolved(id)
    proposeReplacement(id, text)
    confirmReplacement(id)
    cancelReplacement(id)

Exact names may differ.

The existing semantic snapshot service should remain the read model.

The action service may update a deterministic local fixture-backed intent state for v0.1.

Do not let individual views mutate fixture objects directly.

## Persistence for v0.1

Use the smallest deterministic persistence mechanism consistent with the existing workbench test setup.

Preferred order:

1. existing workspace/storage service already used by SideX;
2. existing local state service;
3. a small deterministic in-memory test implementation plus workbench storage-backed production implementation.

Do not create a new database.

Do not write directly into `sys-platform` project files in this milestone.

Do not parse CLI output.

This is still a GUI interaction milestone; live Sys Platform integration comes later.

## Required state model

Use one explicit typed state model.

Conceptually:

    IntentItem {
      id
      title
      question / reason
      status
      confirmedMeaning?
      candidateMeaning?
      leftOpenByHuman
      governanceState
    }

Recommended statuses:

    UNRESOLVED
    CANDIDATE
    CONFIRMED

Do not add broad semantic/governance state machines beyond the interaction need.

Governance should remain separate, e.g.:

    NOT_GOVERNED
    GOVERNED

For the v0.1 fixture-backed path, confirmed clarifications remain:

    NOT_GOVERNED

unless an authoritative source explicitly says otherwise.

## Required integration with existing Semantic Workbench

The read-only workspace must now react to intent state changes.

Examples:

Before:

    Unresolved intent: 2

After confirming one item:

    Unresolved intent: 1
    Confirmed human intent: 1

But do not change governed-intent counts.

The Intent section should visually distinguish:

    Governed rules
    Unresolved human intent
    Confirmed human intent (not yet governed)

Do not merge them.

## Required Cinema flow

Use the existing Cinema Booking fixture.

### C1 — customer validation

Initial:

    UNRESOLVED

Human enters:

    Customer name must not be empty and phone must not be empty.

GUI must:

    store exactly that text
    show it for review
    require explicit confirmation

After confirmation:

    CONFIRMED HUMAN INTENT
    NOT YET GOVERNED

### C2 — status transition rules

Initial:

    UNRESOLVED

Human chooses:

    Leave unresolved

Required:

    remains UNRESOLVED
    leftOpenByHuman = true
    no default applied

### C3 — replacement

For C1, human later proposes:

    Customer name must not be empty.

Required:

    old meaning shown
    new meaning shown
    explicit confirmation required

If confirmed:

    new meaning replaces old

If cancelled:

    old meaning remains unchanged

## Native workbench behavior

Keep implementation inside the existing Sys contribution area where possible:

    src/vs/workbench/contrib/sys/

Use existing:

- workbench views;
- commands;
- DI;
- storage;
- context keys;
- theme tokens;
- Codicons;
- accessibility patterns.

Do not introduce React or another UI framework.

Do not modify Monaco/editor core for this milestone.

## Accessibility

Required:

- keyboard reachable actions;
- visible focus state;
- buttons have understandable labels;
- text area/input has an accessible label;
- state is not conveyed by color alone;
- confirmation dialog/detail makes the authority distinction readable.

Use existing VS Code accessibility conventions.

## Mandatory brainstorming gate

Before production edits:

1. inspect the current Sys workbench implementation;
2. identify how unresolved intent is currently represented;
3. find the smallest existing native form/input pattern in SideX/VS Code;
4. find the existing storage service suitable for small workspace state;
5. find command/action registration patterns;
6. identify how the current project summary computes unresolved count;
7. record all upstream/core files that would need touching;
8. confirm the milestone can remain isolated under the Sys contribution namespace plus minimal registration.

If the current view architecture cannot support editable native controls cleanly without broad core changes, choose the narrowest native detail/editor surface already supported and document why.

## Reuse-before-reimplementation gate

Use, in order:

1. existing Sys snapshot service/model;
2. existing SideX workbench storage;
3. existing input/form controls;
4. existing command/action framework;
5. existing notification/dialog mechanism if needed;
6. custom infrastructure only if necessary.

Do not create a second persistence framework.

## TDD / acceptance gates

Write focused tests before or alongside production changes according to repository conventions.

### H1 — unresolved item opens detail

Selecting `customer validation` exposes:

    status = UNRESOLVED
    reason/question visible
    clarification input visible

### H2 — candidate text is exact

Human enters arbitrary text.

Required:

    candidateMeaning == exact entered text

Forbidden:

    automatic rewriting
    normalization into a different business meaning
    LLM transformation

Whitespace-only handling may follow existing input validation conventions, but do not alter substantive content.

### H3 — clarification is not confirmation

Entering text alone must not make the item confirmed.

Required:

    status = CANDIDATE

### H4 — explicit confirmation

Only explicit confirmation changes:

    CANDIDATE -> CONFIRMED

### H5 — confirmed != governed

After H4:

    confirmation state = CONFIRMED
    governance state = NOT_GOVERNED

The GUI must show the distinction.

### H6 — leave unresolved

Required:

    status remains UNRESOLVED
    leftOpenByHuman = true
    no candidate/confirmed meaning invented

### H7 — replacement requires explicit confirmation

Old confirmed meaning must remain until replacement is confirmed.

### H8 — cancelled replacement preserves all old state

Required:

    old confirmedMeaning preserved
    old governance state preserved
    no expressibility/metadata loss if such metadata exists in the local model

### H9 — summary counts update correctly

After confirming one of two unresolved items:

    unresolved = 1
    confirmed human intent = 1

Governed count must not change.

### H10 — deterministic persistence

Reload/reopen within the supported workbench lifecycle must restore the same intent interaction state.

Do not depend on map/object iteration order for rendering.

### H11 — no semantic inference in UI

Add a structural or focused test where practical proving the action layer does not:

    parse Java
    parse Formal Spec
    map "Vietnam" -> timezone
    generate business rules
    choose implementation mechanisms

### H12 — theme/accessibility regression

Check at least one dark and one light theme.

Required:

    editable controls readable
    focus visible
    status distinctions understandable

### H13 — SideX regression

Required:

    npm run lint
    npm run build
    git diff --check

and focused Sys tests green.

If Rust/Tauri files are changed, run the relevant Rust checks.

## Manual UX validation

After automated gates pass, run the real Tauri app and perform:

    Sys
    -> Cinema Booking
    -> Unresolved Intent
    -> customer validation
    -> enter clarification
    -> review
    -> confirm
    -> verify NOT YET GOVERNED

Then:

    status transition rules
    -> Leave unresolved
    -> verify it remains visible as unresolved

Then:

    replace customer validation clarification
    -> verify old/new are both visible
    -> cancel
    -> old meaning remains

Repeat key readability check in light and dark themes.

Ask the human to answer:

1. Did you understand what was unresolved?
2. Did you understand that your clarification was not governed yet?
3. Did you understand what would change before confirming a replacement?
4. Could you leave an item unresolved without Sys inventing a default?

Record the result.

## Non-goals

Do NOT implement:

- live `sys-platform` integration;
- governed-spec approval;
- code approval;
- proposal generation;
- proposal apply;
- source mutation;
- semantic inference;
- LLM suggestions for unresolved intent;
- automatic business-rule completion;
- CLI output parsing;
- ontology graph visualization;
- semantic diff for code proposals;
- source-evidence navigation;
- SideX agent redesign;
- IDE-wide rebranding.

Do not combine the next milestones into this one.

## Fork discipline

Record all touched upstream/core files.

Prefer:

    Sys contribution files
    + minimal registration wiring

Do not opportunistically refactor SideX.

Keep future upstream merges feasible.

## Deliverables

Create/update:

- `docs/architecture/SYS_HUMAN_INTENT_ACTIONS_V0_1.md`
- `docs/reports/SYS_HUMAN_INTENT_ACTIONS_V0_1.md`
- typed intent action/state model
- typed action service
- deterministic persistence
- native workbench interaction UI
- focused tests H1-H13

## Report requirements

The report must include:

- brainstorming conclusion;
- existing Sys view/state reused;
- storage mechanism chosen;
- files changed;
- upstream/core files touched;
- implementation plan actually followed;
- TDD evidence;
- H1-H13 results;
- Cinema C1-C3 results;
- exact lint/build/test results;
- light/dark theme validation;
- manual UX validation;
- any state-loss defect found and fixed;
- unrelated dirty files;
- explicit non-goals preserved;
- final recommendation:

    GO
    NARROW
    STOP / REDESIGN

## GO criterion

GO requires:

1. a human can resolve or deliberately leave unresolved intent directly in the GUI;
2. candidate clarification is distinct from confirmed intent;
3. confirmed intent is visibly distinct from governed meaning;
4. replacement is explicit and non-destructive;
5. the GUI never invents business meaning;
6. state survives the supported workbench lifecycle deterministically;
7. light/dark theme and accessibility checks pass;
8. lint/build/focused tests pass;
9. SideX core behavior remains intact.

Success is not "the GUI edits the spec."

Success is:

> A human can make an explicit intent decision in Sys Editor without the GUI silently turning that decision into governed truth.
