# Execution mode clarification

This prompt is for an implementation milestone in `nvxtien/sys-editor`.

The goal is to make the GUI ready for the new fail-closed governed semantics model being introduced in Sys Platform.

The backend soundness milestone is being developed separately in `nvxtien/sys-platform`.

Do not invent or duplicate backend semantics in the editor.

Proceed autonomously through:

    inspect current Semantic Workbench
    -> define soundness-aware read model
    -> write plan
    -> TDD
    -> implement UI states
    -> preserve fixture/live separation
    -> verify Tauri UX
    -> report

# Prompt: Implement Sys Semantic Soundness UX v0.1

Repository:

    nvxtien/sys-editor

Authoritative backend:

    nvxtien/sys-platform

Related backend milestone:

    GOVERNED_SEMANTIC_SOUNDNESS_FIREWALL_V0_1

## Product goal

Make Sys Editor clearly distinguish:

    meaning Sys supports exactly
    meaning Sys does not support
    meaning that is unresolved
    meaning recovered only partially
    meaning that requires human attention

The GUI must never make:

    parsed
    confirmed
    partially recovered
    unsupported

look equivalent to:

    governed exactly
    verified

This milestone is primarily a **trust UX milestone**.

It is not a semantic-engine milestone.

## Why this is needed now

The latest scalability proof found real cases where:

- governed rules were silently dropped;
- unsupported semantic vocabulary was accepted with the wrong meaning;
- parameter identity could produce false-green SYNCED results;
- quantified meaning could be weakened into a scalar statement.

The backend is being changed to fail closed.

The GUI must be able to represent that truthfully.

A trustworthy Sys Editor should answer:

    What meaning is governed exactly?
    What was rejected as unsupported?
    What remains unresolved?
    What source meaning was recovered?
    What comparison result is actually safe to trust?
    What needs my decision?

## Architecture boundary

Keep this strict:

    sys-platform
    = semantic authority

    sys-editor
    = projection + human interaction

The editor MAY:

- deserialize structured backend statuses;
- display governed/recovered/sync state;
- highlight unsupported/unresolved items;
- show source/evidence references;
- collect explicit human actions through typed APIs.

The editor MUST NOT:

- decide that a rule is supported;
- reinterpret unsupported rules;
- infer missing quantifiers;
- infer semantic identity;
- convert unknown into false;
- convert partial into verified;
- parse source code for semantic meaning;
- reconstruct backend classifications from prose.

## Target user mental model

The Workbench should make this distinction obvious:

    SUPPORTED EXACTLY
      Sys has a trusted governed representation.

    UNSUPPORTED
      Sys understands that the user stated something,
      but cannot represent it exactly.

    UNRESOLVED
      Sys cannot bind/resolve the intended semantic identity safely.

    RECOVERED PARTIALLY
      Source analysis is incomplete.

    VERIFIED / SYNCED
      Only when backend says the admitted governed meaning
      and recovered meaning match within supported scope.

Do not use wording that implies more certainty than the backend provides.

## Required UI hierarchy

The Sys Semantic Workbench should evolve toward these top-level sections:

    Project

    Governed Meaning
      Exact / admitted rules

    Unsupported Meaning
      Rules Sys refused to govern

    Unresolved Meaning
      Binding / human-intent questions

    Recovered Source Meaning
      Exact / partial / unknown

    Semantic Sync
      Synced / drifted / partial / conflicted

    Reviews
      Human attention required

    Evidence
      Why Sys says this

Exact labels may vary slightly to fit existing UI conventions, but the distinctions must remain.

## Do not merge categories

These are forbidden UI collapses:

    unsupported
    -> unresolved

    unresolved
    -> unknown

    partial
    -> synced

    confirmed human intent
    -> governed

    parsed
    -> supported

    no data
    -> empty success

## Read model

Extend the typed editor read model to represent, conceptually:

    SysSemanticDisposition {
      id
      title / display text
      state:
        SUPPORTED_EXACT
        UNSUPPORTED
        UNRESOLVED
      reason?
      evidenceRefs[]
      governedRef?
    }

    SysRecoveredState {
      state:
        AVAILABLE
        PARTIAL
        UNKNOWN
        NOT_RUN
        NOT_AVAILABLE
      operations[]
    }

    SysSyncState {
      state:
        SYNCED
        DRIFTED
        PARTIAL
        CONFLICTED
        NEVER_RUN
      items[]
    }

Reuse backend terminology exactly if the real contract uses equivalent names.

Do not create a second semantic vocabulary just for the GUI.

## Backend-contract strategy

This milestone must support two modes.

### Mode A — current fixture/test mode

Use deterministic fixture data to implement and test the UX states.

Fixture data must be clearly marked as fixture/demo.

Do not treat fixture semantics as product authority.

### Mode B — live contract mode

If the current Sys Platform `WorkspaceSnapshotV1` already exposes the required fields, consume them structurally.

If the soundness-firewall backend fields are not yet available, keep the live adapter behavior explicit:

    PLATFORM_API_GAP

for those specific sections.

Do not scrape CLI prose.

Do not fabricate unsupported/unresolved states from rule text.

## Important sequencing rule

The GUI may be completed before the backend firewall lands, but only if:

- fixture-backed UI states are isolated;
- live mode never fabricates missing backend data;
- the typed model can accept the future structured backend fields without redesign;
- the report names exactly which backend fields are still missing.

Success in fixture mode does NOT imply live GO.

## Status presentation

Use native SideX/VS Code visual language.

Each semantic item should communicate:

- status text;
- concise explanation;
- evidence availability;
- whether the user can act;
- whether the item participates in verification.

Recommended visual semantics:

    Exact governed
      status badge + normal text

    Unsupported
      explicit "Unsupported by current semantic model"

    Unresolved
      explicit "Needs binding / clarification"

    Partial recovery
      explicit "Source meaning partially recovered"

    Unknown
      explicit "Source meaning unknown"

Avoid alarming colors for ordinary unsupported cases.

Do not use color alone.

## Verification eligibility

This is a critical UX rule.

An item that is:

    UNSUPPORTED
    UNRESOLVED

must not visually appear inside a "verified" bucket.

Where useful, show:

    Verification eligibility:
      NOT ELIGIBLE

An exact governed rule can show:

    Verification eligibility:
      ELIGIBLE

But do not compute eligibility in the GUI if the backend already provides it.

If backend does not provide it, derive only from explicit disposition fields with a trivial mapping, not from semantic content.

Document that mapping.

## Project summary

Update the summary to show separate counts when available:

    Governed exactly: N
    Unsupported: N
    Unresolved: N
    Recovered exact: N
    Recovered partial/unknown: N
    Reviews requiring attention: N

Do not combine unsupported and unresolved into one number.

Do not count rejected rules as governed coverage.

## Soundness-focused review view

Add or evolve the review surface so a user can inspect one semantic issue.

Example:

    Rule
      Booking code must be unique

    Status
      UNSUPPORTED

    Why
      Current governed semantic model has no exact uniqueness representation.

    Effect
      This rule is not included in verification.

    Source / evidence
      <structured refs if backend provides them>

    Action
      None / clarify / wait for model support

The GUI must not suggest an invented rewrite such as:

    booking.code != "unique"

## Human-intent distinction

Preserve existing Human Intent behavior:

    CONFIRMED HUMAN INTENT
    !=
    GOVERNED

A confirmed clarification may still be:

    not governed
    unsupported
    awaiting admission

The UI must be able to show that sequence without collapsing states.

## Recovered meaning section

If structured recovered semantic payload is available from Sys Platform, display it directly.

If it is not yet available:

    Recovered Source Meaning
    Backend structured state not available yet.

Do not reconstruct it from sync rows.

Do not reconstruct it from review prose.

## Live failure behavior

Critical invariant:

    backend ERROR
    !=
    fixture READY

In live mode, if the new soundness fields are missing:

    show explicit integration gap

Do not silently substitute fixture values.

## Required TDD / acceptance gates

### U1 — exact governed item

Fixture/backend item:

    SUPPORTED_EXACT

renders as governed and eligible for comparison.

### U2 — unsupported item

Item:

    UNSUPPORTED

renders in Unsupported Meaning.

It does not appear as governed exact.

### U3 — unresolved item

Item:

    UNRESOLVED

renders separately from Unsupported.

### U4 — no parsed=supported collapse

A fixture includes:

    parsed = true
    disposition = UNSUPPORTED

GUI must show UNSUPPORTED.

### U5 — confirmed != governed

Confirmed human intent that is not governed remains visibly distinct.

### U6 — unsupported not verified

An unsupported rule cannot render as:

    SYNCED
    VERIFIED
    PROVED

even if another project-level sync status is green.

### U7 — partial recovery stays partial

Backend says:

    PARTIAL

GUI says:

    PARTIAL

No optimistic promotion.

### U8 — unknown stays unknown

Backend says:

    UNKNOWN

GUI says:

    UNKNOWN

### U9 — absence semantics

Distinguish:

    NOT_RUN
    NOT_AVAILABLE
    AVAILABLE with zero items

### U10 — counts are semantically correct

Project summary counts:

    exact
    unsupported
    unresolved

separately.

### U11 — evidence preservation

Evidence/source references supplied by backend survive the adapter and are available to the view.

Do not invent missing evidence.

### U12 — unsupported reason visible

A reason/code supplied by backend is visible in detail view.

No GUI-generated semantic explanation beyond presentation wording.

### U13 — fixture/live isolation

Live missing fields do not fall back to fixture state.

### U14 — versioned live contract

Unknown incompatible schema version:

    ERROR / UNSUPPORTED_VERSION

not best-effort rendering.

### U15 — backend gap explicit

If the firewall contract fields are absent:

    PLATFORM_API_GAP

or equivalent explicit UI state.

### U16 — no semantic logic in views

Structural/focused test where practical:

    no Formal Spec parsing
    no Java parsing
    no business-rule classification
    no semantic keyword interpretation

inside Sys Editor view/service code.

### U17 — deterministic ordering

Same snapshot renders semantic items in stable order.

### U18 — keyboard/accessibility

All semantic status groups and detail actions are keyboard reachable.

Status is not color-only.

### U19 — dark/light theme

Readability verified in both themes.

### U20 — SideX regression

Required:

    npm run lint
    npm run build
    git diff --check

and focused Sys tests.

If Rust/Tauri integration changes, run relevant Rust checks.

## Required fixture scenarios

Create/update deterministic fixtures for at least these cases:

### F1 — exact rule

    source account balance >= amount

    SUPPORTED_EXACT

### F2 — unsupported uniqueness

    booking code must be unique

    UNSUPPORTED

### F3 — unresolved binding

A semantic reference cannot be bound exactly.

    UNRESOLVED

### F4 — confirmed but not governed

Human clarification exists but has not passed governed admission.

### F5 — partial recovery

Governed rule exact; source meaning partially recovered.

### F6 — live contract missing fields

Structured backend snapshot lacks the new soundness section.

Required:

    explicit backend gap

No fixture substitution.

## Real Tauri walkthrough

After automated tests pass, run the actual Tauri app.

Walk through:

1. Open Sys Activity Bar.
2. Open the deterministic fixture/demo workspace.
3. Verify exact governed rules.
4. Verify unsupported rules are visibly separate.
5. Verify unresolved rules are visibly separate.
6. Verify confirmed human intent remains not governed.
7. Verify partial/unknown recovered state.
8. Verify review detail explains that unsupported meaning is excluded from verification.
9. Check dark theme.
10. Check light theme.

If current Sys Platform backend already exposes the new firewall fields, additionally run one live workspace and compare the UI with `sys workspace snapshot --json`.

If it does not, record:

    LIVE_INTEGRATION_PENDING_BACKEND_CONTRACT

Do not call live GO.

## Architecture seam

Maintain:

    Sys Platform structured contract
        ↓
    Sys Platform Adapter
        ↓
    Sys Editor Read Model
        ↓
    Semantic Workbench Views

Views must not understand transport.

Views must not understand Formal Spec syntax.

Views must not understand Java syntax.

## Fork discipline

Prefer changes under:

    src/vs/workbench/contrib/sys/

plus minimal registration/wiring.

Do not opportunistically refactor SideX.

Record every non-Sys contribution file touched.

## Non-goals

Do NOT implement:

- new Sys Platform semantics;
- semantic admission rules;
- parser changes;
- CanonicalRef;
- quantifiers;
- membership;
- uniqueness;
- validation semantics;
- source recovery;
- source navigation;
- proposal apply;
- generic chat/agent UI;
- IDE-wide rebranding;
- automatic rule rewriting;
- LLM semantic suggestions.

This milestone is visual truthfulness and contract readiness.

## Deliverables

Create/update:

- `docs/architecture/SYS_SEMANTIC_SOUNDNESS_UX_V0_1.md`
- `docs/reports/SYS_SEMANTIC_SOUNDNESS_UX_V0_1.md`
- soundness-aware typed read model
- fixture scenarios F1-F6
- Semantic Workbench UI states
- focused U1-U20 tests

## Report requirements

The report must include:

- current GUI baseline;
- current backend fields available/missing;
- typed model changes;
- exact/unsupported/unresolved UX;
- confirmation-vs-governance behavior;
- recovered-state behavior;
- fixture/live isolation result;
- U1-U20 results;
- real Tauri walkthrough;
- dark/light validation;
- lint/build/test results;
- Rust checks if applicable;
- all files changed;
- non-Sys core files touched;
- unrelated dirty files;
- explicit backend gaps;
- final recommendation:

    GUI_READY_FOR_SOUNDNESS_CONTRACT
    NARROW
    PLATFORM_API_GAP
    STOP / REDESIGN

## GO criterion

Call:

    GUI_READY_FOR_SOUNDNESS_CONTRACT

only if:

1. Exact governed meaning, unsupported meaning, and unresolved meaning are visibly distinct.
2. Unsupported/unresolved items cannot look verified.
3. Confirmed human intent remains distinct from governed meaning.
4. Partial/unknown recovered meaning remains honest.
5. Empty/not-run/not-available states remain distinct.
6. Fixture mode and live mode never silently substitute for each other.
7. The GUI contains no semantic inference logic.
8. The typed model can consume the backend soundness contract without architectural redesign.
9. Tauri walkthrough passes.
10. lint/build/focused tests pass.

Success means:

> Sys Editor can faithfully show what Sys knows, what Sys does not know, and what Sys refuses to claim — without becoming a semantic authority itself.
