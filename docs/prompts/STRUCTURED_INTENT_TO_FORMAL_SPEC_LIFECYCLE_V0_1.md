# Mission: Structured Intent → Formal Spec Lifecycle v0.1

## Delegation

You are Claude/Codex acting as the implementation owner for one focused product mission.

Your task is to introduce a two-stage human-confirmed semantic lifecycle between natural-language requirements and governed Formal Specs.

The target product flow is:

    Raw Requirement
        ↓
    LLM proposes Structured Intent
        ↓
    Human reviews / confirms
        ↓
    Governed Structured Intent
        ↓
    Formal Spec candidate generation
        ↓
    Human reviews / confirms
        ↓
    Governed Formal Spec
        ↓
    Code / Verification

This mission is architectural, not cosmetic.

Follow:

    Brainstorming
    → Writing plans
    → TDD
    → Implementation
    → Verification
    → only then GO / NARROW / STOP

Do not silently weaken acceptance criteria.
Do not fabricate desktop evidence.

---

---

# Repository ownership and implementation boundary

This mission is now a **shared core architecture mission**, not an editor-owned workflow.

Create a dedicated reusable module:

    sys-core

Do NOT place lifecycle/domain logic inside `product-cli`.
Do NOT make `sys-editor` the owner of Structured Intent lifecycle state.

The intended architecture is:

    sys-editor
        = GUI client / presentation adapter

    product-cli
        = CLI client / presentation adapter

    sys-core
        = product lifecycle / application core
        = workspace-owned project state
        = requirement lifecycle
        = Structured Intent model
        = Structured Intent normalization orchestration
        = human confirmation transitions
        = exact-content approvals
        = staleness propagation
        = persistence under .sys/
        = Formal Spec generation orchestration
        = provider-agnostic proposal workflow
        = invocation/orchestration of sys-platform capabilities

    sys-platform
        = Formal Spec grammar
        = Formal Spec parser / validator
        = semantic authority
        = source/code semantic recovery
        = verification semantics
        = proof / evidence / verdict generation

The key rule is:

    sys-core orchestrates
    sys-platform certifies

Neither sys-editor nor product-cli may own lifecycle semantics.

Both must call the same reusable sys-core APIs so GUI and CLI cannot drift into separate implementations.

Required dependency direction:

    sys-editor ─┐
                ├──> sys-core ───> sys-platform
    product-cli ┘

Do NOT create:

    sys-editor -> product-cli

as the architectural path.

Do NOT make product-cli a library used by sys-editor.

The CLI is a client of sys-core, not the owner of sys-core.

---

## Required sys-core module

Create a dedicated `sys-core` module/package/crate/library in the appropriate repository structure after inspecting the current build system.

Do not assume its language or packaging blindly; choose the implementation form that integrates cleanly with the current sys-platform/product build.

The module must be independently reusable by:

- Sys Editor integration;
- product CLI;
- future non-GUI clients.

At minimum, sys-core should own APIs conceptually equivalent to:

    loadProject(workspace)
    createRequirement(...)
    normalizeRequirement(reqId, ...)
    approveStructuredIntent(reqId, exactContentIdentity)
    generateFormalSpec(reqId, ...)
    approveFormalSpec(reqId, exactContentIdentity)
    mark/recomputeStaleness(...)
    verifyRequirement(reqId, ...)

Exact API names may differ.

The important requirement is that lifecycle state transitions live in sys-core exactly once.

---

## Structured Intent ownership

Structured Intent is a first-class product lifecycle artifact owned by sys-core.

It is NOT:

- a sys-editor-only UI model;
- a product-cli-only command model;
- a sys-platform semantic verdict.

sys-core owns:

    Structured Intent Draft
    Structured Intent Approved
    exact-content identity
    provenance metadata
    UNKNOWN / INFERRED preservation
    downstream staleness rules

sys-editor renders and lets the user act on this state.

product-cli prints/prompts and lets the user act on this state.

Both must call sys-core.

---

## Human confirmation ownership

Human confirmation is a lifecycle/domain transition owned by sys-core.

The GUI may expose a button:

    Confirm intent

The CLI may expose a command:

    sys intent approve REQ-001

But both must execute the same sys-core transition.

Likewise for Formal Spec approval.

Do not duplicate approval logic in GUI and CLI.

---

## Persistence ownership

sys-core owns the canonical persistence model under the workspace:

    .sys/...

sys-editor and product-cli must not independently decide file layout or mutate project lifecycle files directly, except through sys-core APIs/adapters.

The exact on-disk layout may evolve, but one source of truth must exist.

Potential conceptual layout:

    .sys/
      project.json
      requirements/
      intents/
      specs/
      proposals/

Reuse existing compatible artifacts where possible.

Do not duplicate old state if migration is sufficient.

---

## LLM/provider orchestration ownership

The provider-specific transport may remain in the existing SideX/editor infrastructure where necessary, but the product-level orchestration contract belongs to sys-core.

Meaning:

    normalize this requirement
    generate a Formal Spec from approved Structured Intent

must be sys-core use cases.

Provider adapters may be injected/called through a narrow interface.

Do NOT hard-wire sys-core to a specific GUI transport, localhost port, SideX UI class, or model vendor.

Preferred boundary:

    sys-core use case
        -> ProposalProvider interface
        -> editor/CLI/server adapter
        -> selected LLM

This keeps sys-core provider-agnostic and allows future CLI execution.

If the current architecture requires a transitional adapter, document it clearly and do not bake the editor dependency into sys-core.

---

## CLI parity requirement

This mission must explicitly prove that the lifecycle is not GUI-only.

At minimum, design and test sys-core so product-cli can expose the same lifecycle.

Preferred CLI surface, if feasible in this mission:

    sys requirement create ...
    sys intent normalize REQ-001
    sys intent show REQ-001
    sys intent approve REQ-001
    sys spec generate REQ-001
    sys spec show REQ-001
    sys spec approve REQ-001
    sys verify REQ-001

Exact command names may differ.

If full CLI wiring is too broad, it is acceptable to wire a minimal representative subset, but sys-core must be independently reusable and CLI integration must be demonstrated by at least one real lifecycle operation.

Do not claim architecture independence based only on interfaces with no CLI consumer.

---

## Editor responsibility after this change

sys-editor should become a thin client for lifecycle state.

It may own:

- views;
- buttons;
- editor opening/navigation;
- user dialogs;
- rendering;
- provider selection UX;
- transport adapters.

It must NOT own:

- Structured Intent lifecycle rules;
- approval truth;
- staleness truth;
- .sys canonical persistence semantics;
- Formal Spec lifecycle truth.

If current editor code owns these today, migrate the logic into sys-core rather than wrapping it in place.

---

## product-cli responsibility after this change

product-cli should become a thin command adapter.

It may own:

- argument parsing;
- terminal prompts;
- stdout/stderr formatting;
- exit codes.

It must NOT own:

- lifecycle rules;
- Structured Intent schema authority;
- approval rules;
- staleness propagation;
- persistence semantics.

Do not put sys-core inside product-cli.

---

## sys-platform responsibility

sys-platform remains the semantic authority.

It owns:

- canonical Formal Spec grammar;
- parser;
- validation;
- ontology/semantic compilation;
- source recovery;
- semantic comparison;
- proof/evidence;
- verification verdict.

Do NOT move these into sys-core.

sys-core may call sys-platform, but must not reimplement its semantic authority.

---

## Required implementation decision before coding

Before editing code, inspect the repositories/build structure and write down:

    SYS_CORE_LOCATION:
    ...

    SYS_CORE_LANGUAGE/PACKAGING:
    ...

    DEPENDENCY_DIRECTION:
    sys-editor -> sys-core
    product-cli -> sys-core
    sys-core -> sys-platform

    MIGRATION_TARGETS:
    editor-owned lifecycle logic to move
    cli-owned lifecycle logic to move

Do not start by copying code into a new folder.

First define the clean module boundary and migrate one source of truth.

---

## Required architectural tests

Add tests proving:

1. sys-core lifecycle can run without sys-editor;
2. sys-core lifecycle can run without product-cli;
3. sys-editor uses sys-core for at least one lifecycle transition;
4. product-cli uses sys-core for at least one lifecycle transition;
5. approval behavior is identical through GUI adapter and CLI adapter;
6. staleness behavior is identical through GUI adapter and CLI adapter;
7. persistence format is shared;
8. no duplicate lifecycle implementation remains in sys-editor/product-cli;
9. sys-core does not implement Formal Spec parser semantics already owned by sys-platform;
10. sys-core has no dependency on a concrete GUI/provider vendor.

---

## Required final ownership report

    PRIMARY_CORE_MODULE:
    sys-core

    SYS_CORE_CREATED:
    YES | NO

    SYS_CORE_LOCATION:
    ...

    SYS_CORE_LANGUAGE/PACKAGING:
    ...

    SYS_EDITOR_ROLE:
    thin GUI client | explain deviations

    PRODUCT_CLI_ROLE:
    thin CLI client | explain deviations

    STRUCTURED_INTENT_OWNER:
    sys-core

    HUMAN_CONFIRMATION_OWNER:
    sys-core

    PERSISTENCE_OWNER:
    sys-core

    FORMAL_SPEC_GENERATION_ORCHESTRATION_OWNER:
    sys-core

    FORMAL_SPEC_VALIDATION_OWNER:
    sys-platform

    VERIFICATION_SEMANTICS_OWNER:
    sys-platform

    CLI_PARITY_DEMONSTRATED:
    YES | NO

    GUI_PARITY_DEMONSTRATED:
    YES | NO

    DUPLICATE_LIFECYCLE_LOGIC:
    0 | explain


# Product thesis

Sys should not jump directly from free-form natural language to Formal Spec.

These are distinct artifacts:

    raw requirement
    ≠ structured intent
    ≠ formal spec

The lifecycle must make those boundaries explicit.

The user should not be forced to author Formal Spec grammar from scratch.

The model may propose structure, but the user must confirm meaning before Formal Spec generation.

---

# Core invariant

Formal Spec generation MUST consume the human-confirmed Structured Intent, not the original raw requirement.

Verification MUST consume the human-approved Formal Spec, not the latest LLM draft.

Required:

    RAW_REQUIREMENT
      → STRUCTURED_INTENT_DRAFT
      → HUMAN_CONFIRMED_STRUCTURED_INTENT
      → FORMAL_SPEC_DRAFT
      → HUMAN_APPROVED_FORMAL_SPEC
      → VERIFICATION

Forbidden:

    RAW_REQUIREMENT
      → LLM
      → FORMAL_SPEC
      → AUTO-APPROVED

---

# Lifecycle states

Use existing types where possible; do not create a duplicate state machine if one already exists.

Conceptually:

    DRAFT_REQUIREMENT
    STRUCTURED_INTENT_DRAFT
    STRUCTURED_INTENT_APPROVED
    FORMAL_SPEC_DRAFT
    FORMAL_SPEC_APPROVED
    IMPLEMENTATION_UNVERIFIED
    VERIFIED_SYNCED
    STALE
    CONFLICTED
    NOT_OBSERVED

Each transition must be caused by either:

- explicit human approval; or
- sys-platform evidence.

Never infer lifecycle state from file existence alone.

---

# Human governance model

Preserve:

    User = intent + approval
    LLM = proposal / hypothesis generator
    Sys = semantic governor + verifier

LLM output can never itself become governed.

Required transitions:

    Raw requirement
      --LLM normalize-->
    Structured Intent Draft

    Structured Intent Draft
      --human confirm-->
    Structured Intent Approved

    Structured Intent Approved
      --Formal Spec generation-->
    Formal Spec Draft

    Formal Spec Draft
      --human approve-->
    Formal Spec Approved

    Formal Spec Approved
      --verification-->
    SYNCED / CONFLICTED / NOT_OBSERVED / other platform verdict

---

# Phase 1 — Raw requirement

Keep the existing requirement flow.

Example:

    A booking request must contain at least one seat.

Requirement remains free-form human-authored text.

Do not require the user to know the Formal Spec grammar at this stage.

The existing exact-text approval behavior may remain, but do not treat raw requirement approval as equivalent to structured intent approval.

---

# Phase 2 — Normalize into Structured Intent

Add a GUI action:

    [ Normalize intent ]

This sends the raw requirement, plus any authoritative source binding already known, to the selected model.

The model should return a Structured Intent candidate.

The candidate must remain human-readable and easier to review than a Formal Spec DSL.

Recommended conceptual shape:

    Intent
      A booking request must contain at least one seat.

    Scope
      Booking creation

    Operation
      BookingService.createBooking

    Inputs
      requestedSeats

    Constraints
      requestedSeats must contain at least one element

    Failure behavior
      Reject the booking request

    Unknowns
      exception type
      exact error message

The exact schema may differ after inspecting existing Sys models.

Do not force YAML/JSON into the GUI unless that is already the product convention.

---

# Structured Intent semantics

Structured Intent is not Formal Spec.

It is a human-reviewable semantic normalization layer.

It should expose at least:

- intent statement;
- scope;
- bound operation if available;
- inputs / entities;
- constraints;
- effects / outcomes if present;
- failure behavior if present;
- unresolved / unknown facts.

Use the smallest schema that preserves meaning without pretending to formalize what is not known.

---

# Provenance

Every field in Structured Intent should preserve provenance where meaningful.

Allowed conceptual provenance:

    SPECIFIED
    OBSERVED
    DERIVED
    INFERRED
    UNKNOWN

Important:

- user text facts may be SPECIFIED;
- source binding may be OBSERVED / USER_BOUND / equivalent existing provenance;
- deterministic consequences may be DERIVED;
- model-added interpretation must be INFERRED;
- missing information should remain UNKNOWN.

Do not silently promote INFERRED to SPECIFIED.

Do not erase UNKNOWN by guessing.

---

# Example provenance behavior

Raw requirement:

    A booking request must contain at least one seat.

Possible Structured Intent:

    constraint:
      requestedSeats non-empty
      provenance: SPECIFIED

    operation:
      BookingService.createBooking
      provenance: USER_BOUND or OBSERVED

    exception type:
      UNKNOWN

If the model proposes:

    exception type = IllegalArgumentException

without support from the requirement or code, mark it:

    INFERRED

and require human review before it can become governed.

---

# Phase 3 — Human confirmation of Structured Intent

The user must explicitly confirm the candidate.

GUI actions:

    [ Confirm intent ]
    [ Edit ]
    [ Regenerate ]

Before confirmation:

    Structured Intent: Draft

After confirmation:

    Structured Intent: Approved

Approval must bind to the exact Structured Intent content reviewed by the user.

If the Structured Intent changes later:

    approval becomes stale / invalidated

Do not preserve a boolean approval across changed content.

---

# Phase 4 — Formal Spec generation

Formal Spec generation must consume:

    human-confirmed Structured Intent
    + authoritative operation binding
    + canonical sys-platform Formal Spec grammar/template

It must NOT consume the raw requirement as the semantic source of truth once Structured Intent is approved.

The raw requirement may still be included as traceability context, but generation authority is:

    approved Structured Intent

Required invariant:

    FORMAL_SPEC_SOURCE = APPROVED_STRUCTURED_INTENT

---

# Canonical Formal Spec template

Do not invent the grammar in Sys Editor.

Find the real Formal Spec grammar/parser/examples in sys-platform.

The generation path should use the canonical structure required by sys-platform.

At minimum current evidence shows:

    Requirement:
    Operation:

but inspect the parser and accepted examples for the full minimal valid structure.

The model should return only candidate Formal Spec text.

No markdown fences.
No explanatory prose.
No guessed fields.

---

# Phase 5 — Human confirmation of Formal Spec

A platform-valid candidate is still only a draft.

The user must explicitly approve it.

GUI:

    Formal Spec: Draft

    [ Approve Formal Spec ]
    [ Edit ]
    [ Regenerate ]

After approval:

    Formal Spec: Approved

Approval must bind to exact content.

If the Formal Spec changes:

    approval invalidated
    downstream verification marked stale

---

# Traceability

The product must preserve traceability across all three layers:

    Raw Requirement
    → Structured Intent
    → Formal Spec

At minimum the user should be able to inspect:

    source requirement
    normalized structured intent
    approved formal spec

Do not duplicate meaning invisibly across unrelated files.

Keep IDs stable.

A useful conceptual link:

    REQ-001
      raw requirement
      structured intent
      formal spec

---

# Staleness rules

## Raw requirement changes

If raw requirement changes after Structured Intent approval:

    Structured Intent becomes stale
    Formal Spec becomes stale
    verification becomes stale

Do not silently preserve downstream approvals.

## Structured Intent changes

If approved Structured Intent changes:

    Structured Intent approval invalidated
    Formal Spec approval invalidated / stale
    verification stale

## Formal Spec changes

If approved Formal Spec changes:

    Formal Spec approval invalidated
    verification stale

Required principle:

    downstream artifact cannot remain authoritative when its upstream meaning changes

---

# Source binding

If a Formal Spec requires an Operation identity, that identity must come from an authoritative source binding.

No model-generated operation may become authoritative automatically.

If binding is missing:

    block Formal Spec generation

with a bounded state such as:

    OPERATION_BINDING_REQUIRED

Structured Intent normalization may still proceed without binding if the schema can represent:

    Operation: UNKNOWN

But Formal Spec generation must not guess.

---

# AI normalization prompt

The normalization prompt should explicitly require:

- preserve user meaning;
- separate supported facts from inferred facts;
- preserve unknowns;
- do not invent operation identity;
- do not invent implementation details;
- return Structured Intent only;
- no Formal Spec syntax at this stage;
- no approval language;
- no verification claims.

Do not ask the model to collapse uncertainty.

---

# AI Formal Spec prompt

The Formal Spec generation prompt should explicitly require:

- consume approved Structured Intent;
- use authoritative operation binding exactly;
- use canonical Formal Spec grammar;
- return only candidate Formal Spec text;
- no markdown fences;
- no explanatory prose;
- preserve unknowns according to grammar capability;
- do not invent missing facts.

The output is still only:

    FORMAL_SPEC_DRAFT

until the human approves it.

---

# Persistence model

Use workspace-owned state only.

Possible conceptual layout:

    .sys/
      requirements/
        REQ-001.md
      intents/
        REQ-001.intent.json
      specs/
        REQ-001.spec
      proposals/
        ...

The exact layout should reuse existing project conventions where possible.

Do not introduce a database.

Do not create duplicate sources of truth.

Clearly separate:

    draft proposal
    approved artifact

---

# GUI experience

For a requirement row, the user should eventually see something like:

    REQ-001
    A booking request must contain at least one seat.

    Requirement: Saved
    Structured Intent: Approved
    Formal Spec: Draft
    Source: BookingService.createBooking
    Verification: Not run

Possible actions:

    [ Review intent ]
    [ Review spec ]

Before normalization:

    Structured Intent: Not created
    [ Normalize intent ]

After Structured Intent approval:

    Formal Spec: Not created
    [ Generate Formal Spec ]

Keep the next action obvious.

---

# Canonical acceptance scenario

Use:

    A booking request must contain at least one seat.

## Step 1

Create requirement.

Expected:

    Raw Requirement = present

## Step 2

Click:

    Normalize intent

Expected:

    Structured Intent Draft appears

It includes:

    non-empty seat constraint

It does NOT invent:

    exception type
    exact error message
    operation identity if no authoritative binding exists

Unsupported facts are:

    INFERRED or UNKNOWN

## Step 3

Human reviews and clicks:

    Confirm intent

Expected:

    Structured Intent = Approved

## Step 4

Bind source operation if not already bound:

    BookingService.createBooking

Expected:

    authoritative binding visible

## Step 5

Click:

    Generate Formal Spec

Expected:

    generator consumes approved Structured Intent
    canonical grammar used
    authoritative operation inserted exactly
    sys-platform validates candidate
    Formal Spec Draft visible

## Step 6

Human reviews and clicks:

    Approve Formal Spec

Expected:

    Formal Spec = Approved

## Step 7

Continue to implementation / verification.

---

# Mutation / staleness acceptance

After both approvals:

1. edit raw requirement;
2. save;
3. verify Structured Intent becomes stale;
4. verify Formal Spec becomes stale;
5. verify old verification result is not shown as current.

Then restore / re-normalize / reapprove.

Repeat with a Formal Spec edit.

Required:

    STALENESS_PROPAGATION = YES

---

# Error states

Differentiate at least:

    REQUIREMENT_NOT_SAVED
    STRUCTURED_INTENT_NOT_CREATED
    STRUCTURED_INTENT_NOT_APPROVED
    STRUCTURED_INTENT_STALE
    OPERATION_BINDING_REQUIRED
    PROVIDER_REQUEST_FAILED
    PROVIDER_INVALID_STRUCTURED_INTENT
    FORMAL_SPEC_VALIDATION_FAILED
    FORMAL_SPEC_NOT_APPROVED
    FORMAL_SPEC_STALE
    IO_ERROR

Infrastructure errors must not become semantic verdicts.

---

# TDD requirements

Add tests for at least:

1. raw requirement remains free-form;
2. normalization creates Structured Intent Draft;
3. Structured Intent preserves supported facts;
4. model-added unsupported facts are marked INFERRED or UNKNOWN;
5. operation is never guessed;
6. explicit human confirmation required;
7. Structured Intent approval binds to exact content;
8. edit invalidates Structured Intent approval;
9. Formal Spec generation consumes approved Structured Intent, not raw requirement;
10. missing Structured Intent approval blocks Formal Spec generation;
11. missing operation binding blocks Formal Spec generation when required;
12. canonical grammar/template is used;
13. provider candidate remains draft until human approval;
14. Formal Spec approval binds to exact content;
15. edit invalidates Formal Spec approval;
16. upstream requirement edit marks downstream artifacts stale;
17. Structured Intent edit marks Formal Spec and verification stale;
18. Formal Spec edit marks verification stale;
19. no fixture fallback;
20. no fake governed status;
21. no fake verification verdict;
22. Unicode/newlines survive all transitions;
23. workspace isolation.

---

# Scope constraints

Allowed:

- Structured Intent schema/model;
- provenance/unknown representation;
- normalization prompt;
- review/confirm GUI;
- persistence;
- Formal Spec generation from approved Structured Intent;
- exact-content approvals;
- staleness propagation;
- focused tests;
- minimal platform/editor glue required for the lifecycle.

Do NOT:

- redesign the full ontology;
- replace Formal Spec;
- add a general workflow engine;
- make the model authoritative;
- guess missing source binding;
- auto-approve Structured Intent;
- auto-approve Formal Spec;
- collapse INFERRED into SPECIFIED;
- weaken sys-platform validation.

---

# Product acceptance gate

Success requires:

    RAW_REQUIREMENT_FREE_FORM = YES
    STRUCTURED_INTENT_DRAFT = YES
    STRUCTURED_INTENT_HUMAN_CONFIRMATION = YES
    STRUCTURED_INTENT_PROVENANCE = YES
    UNKNOWN_PRESERVED = YES
    OPERATION_GUESSING = 0
    FORMAL_SPEC_SOURCE_IS_APPROVED_INTENT = YES
    FORMAL_SPEC_PLATFORM_VALIDATED = YES
    FORMAL_SPEC_HUMAN_CONFIRMATION = YES
    EXACT_CONTENT_APPROVALS = YES
    STALENESS_PROPAGATION = YES
    SILENT_FIXTURE_FALLBACK = 0
    FAKE_GOVERNED_STATUS = 0
    FAKE_VERIFICATION_VERDICT = 0

On full success:

    STRUCTURED_INTENT_TO_FORMAL_SPEC_LIFECYCLE_PROVEN

---

# Stop / narrow conditions

## STRUCTURED_INTENT_MODEL_GAP

The current persisted model cannot represent Structured Intent + provenance soundly without a deliberate schema change.

## OPERATION_BINDING_REQUIRED

Formal Spec generation is blocked because no authoritative operation binding exists.

Do not guess.

## PLATFORM_FORMAL_SPEC_GAP

The current sys-platform grammar cannot represent the confirmed Structured Intent without dropping required meaning.

Do not silently discard semantics.

## CHECKPOINT_REACHED

Implementation/tests are complete but real desktop/provider replay cannot be performed.

## NARROW_REQUIRED

Structured Intent lifecycle is soundly complete, but Formal Spec generation integration requires a separate change.

## STOP_UNSOUND

Any apparent solution requires:

- model authority;
- hidden semantic invention;
- guessed operation identity;
- auto-approval;
- stale downstream approval;
- parser weakening.

---

# Engineering hygiene

Before finalizing:

- inspect git status/diff;
- remove temporary logs;
- avoid unrelated changes;
- run focused TypeScript tests;
- run relevant sys-platform tests;
- run lint/build;
- record environment/toolchain/network blockers honestly;
- commit only intended files.

---

# Required final report

RESULT:
STRUCTURED_INTENT_TO_FORMAL_SPEC_LIFECYCLE_PROVEN |
STRUCTURED_INTENT_MODEL_GAP |
OPERATION_BINDING_REQUIRED |
PLATFORM_FORMAL_SPEC_GAP |
CHECKPOINT_REACHED |
NARROW_REQUIRED |
STOP_UNSOUND

SYS_EDITOR_COMMIT:
...

SYS_PLATFORM_COMMIT:
...

RAW_REQUIREMENT:
...

STRUCTURED_INTENT_SCHEMA:
...

PROVENANCE_MODEL:
...

UNKNOWN_HANDLING:
...

STRUCTURED_INTENT_CONFIRMATION:
PASS | FAIL

FORMAL_SPEC_SOURCE:
approved structured intent | other — explain

OPERATION_SOURCE:
authoritative binding | missing | explain

FORMAL_SPEC_GENERATION:
PASS | FAIL

PLATFORM_VALIDATION:
PASS | FAIL

FORMAL_SPEC_APPROVAL:
PASS | FAIL

EXACT_CONTENT_APPROVAL:
PASS | FAIL

STALENESS_PROPAGATION:
PASS | FAIL

OPERATION_GUESSING:
0 | explain

FAKE_GOVERNED_STATUS:
0 | explain

FAKE_VERIFICATION_VERDICT:
0 | explain

AUTOMATED_TESTS:
commands + counts + failures/skips

MANUAL_TAURI_EVIDENCE:
...

ENVIRONMENT_BLOCKERS:
...

NEXT_PRODUCT_GAP:
...

Stop only when the two-stage human-confirmed lifecycle is proven or a sound stop condition is reached.
