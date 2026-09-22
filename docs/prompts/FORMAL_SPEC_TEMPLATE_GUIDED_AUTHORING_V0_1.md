# Mission: Formal Spec Template-Guided Authoring v0.1

## Delegation

You are Claude/Codex acting as the implementation owner for one focused product mission.

Your task is to make Formal Spec creation in Sys Editor guided by a canonical template instead of requiring users to memorize the grammar.

The user should be able to either:

    Create Formal Spec from template

or:

    Draft with AI

Both paths must create the same kind of artifact:

    FORMAL_SPEC_DRAFT

and both must still be validated by sys-platform before they can move forward.

Follow:

    Brainstorming
    → Writing plans
    → TDD
    → Implementation
    → Verification
    → only then GO / NARROW / STOP

Do not weaken parser/validation rules.
Do not fabricate evidence.

---

# Product objective

Requirements are natural language.

Formal Specs are structured artifacts with a grammar.

The product should therefore behave like this:

    Requirement
    = free-form human text

    Formal Spec
    = grammar-guided structured artifact

The user must not be expected to remember or reconstruct the Formal Spec grammar manually.

When a user creates a Formal Spec, Sys Editor should show a canonical template derived from the actual sys-platform grammar.

---

# Core UX

After intent approval and authoritative source binding:

    [ Create Formal Spec ]

The user should then get two choices:

    [ Use template ]
    [ Draft with AI ]

Both produce:

    FORMAL_SPEC_DRAFT

Neither path automatically approves or governs the spec.

---

# Canonical template source

Do NOT invent the template in Sys Editor.

Find the real Formal Spec grammar/parser/examples in sys-platform.

The template must be derived from that source of truth.

At minimum, current evidence proves that valid specs require:

    Requirement:
    Operation:

but do not assume those are the only required fields.

Inspect:

- parser implementation;
- grammar definitions;
- accepted fixtures;
- existing tests;
- example specs.

Document the canonical minimal valid structure before implementing UI.

---

# Template behavior

When the user chooses:

    Use template

open a new Formal Spec draft pre-populated with a valid skeleton.

Conceptually:

    Requirement:
    <current requirement text>

    Operation:
    <authoritative bound operation>

    <other required sections from actual grammar>

Use the exact grammar and section names required by sys-platform.

Do not hard-code BookingService.createBooking.

Do not guess missing fields.

---

# Pre-filled authoritative fields

If the requirement text is approved and the source operation binding is authoritative, prefill those exact values.

Example conceptually:

    Requirement:
    A booking request must contain at least one seat.

    Operation:
    BookingService.createBooking

The exact formatting must match the real grammar.

The user should not need to retype values that Sys already knows authoritatively.

---

# Missing binding behavior

A Formal Spec requires an Operation declaration.

If the current requirement has no authoritative source operation binding:

    block template creation

and show a bounded message such as:

    Bind this requirement to a source operation before creating a Formal Spec.

Do not let:

    Use template

or:

    Draft with AI

invent an Operation.

No heuristic source search.
No model-invented class/method.
No "best guess" binding.

---

# AI drafting behavior

The existing:

    Draft spec from request

flow should use the same canonical structure.

Generation input should include:

- approved requirement text;
- authoritative operation binding;
- canonical Formal Spec grammar/template;
- instruction to return only Formal Spec text;
- no markdown fences;
- no explanation.

The model produces a candidate only.

Flow:

    model candidate
    → exact candidate bytes
    → temp .sys/proposals/*.spec
    → sys-platform validate
    → FORMAL_SPEC_DRAFT

Do not rewrite model output semantically before validation.

---

# Manual authoring behavior

The user should be able to edit the Formal Spec as a normal text document.

The editor should start from a valid template skeleton.

The user may fill in semantic sections manually.

The user should not need to:

- know the entire grammar from memory;
- create section names from scratch;
- discover required headers via parser errors one by one.

---

# Validation UX

Add validation feedback that helps the user while preserving sys-platform as authority.

Good:

    missing Requirement:
    missing Operation:
    invalid section structure
    syntax valid

Better if available:

    Validated by Sys Platform

Do not introduce a second permissive parser in the editor.

Preferred layering:

    editor preflight
    → structural hints only

    sys-platform
    → authoritative parser/validator

The editor may detect obvious missing required headers for UX, but must not certify semantics.

---

# Status model

Keep distinct states:

    DRAFT_INTENT
    APPROVED_INTENT_UNFORMALIZED
    FORMAL_SPEC_DRAFT
    FORMAL_SPEC_APPROVED
    VERIFIED_SYNCED

Template creation means only:

    FORMAL_SPEC_DRAFT

It does NOT mean:

    approved
    specified exact
    verified
    synced

---

# Exact-content approval

Formal Spec approval must refer to the exact content the human reviewed.

If the spec changes afterward:

    approval becomes stale / invalidated

This should mirror the existing exact-text requirement approval behavior.

Do not preserve an approval boolean across content changes.

---

# Persistence

Use project-local state.

Possible layout, depending on existing architecture:

    .sys/specs/REQ-001.spec

or the current canonical Formal Spec location already used by the project.

Candidate proposals may remain under:

    .sys/proposals/

Do not create duplicate sources of truth.

Make the distinction clear:

    proposal
    ≠ approved Formal Spec

---

# Canonical user flow

Use this acceptance scenario:

## Step 1

Create requirement:

    A booking request must contain at least one seat.

Save and approve intent.

## Step 2

Bind authoritative source operation:

    BookingService.createBooking

## Step 3

Click:

    Create Formal Spec

Expected options:

    Use template
    Draft with AI

## Step 4A — manual template

Choose:

    Use template

Expected:

    a Formal Spec draft opens
    Requirement is prefilled exactly
    Operation is prefilled exactly
    all required grammar structure is present

The user fills any remaining semantic sections.

Run validation.

Expected:

    sys-platform validates or returns bounded errors

## Step 4B — AI draft

Choose:

    Draft with AI

Expected:

    prompt uses same canonical grammar/template
    requirement is exact
    operation is exact
    provider returns candidate
    candidate is passed unchanged to sys-platform
    validated draft is opened for human review

---

# Error behavior

Differentiate at least:

    INTENT_NOT_APPROVED
    OPERATION_NOT_BOUND
    OPERATION_NOT_AUTHORITATIVE
    TEMPLATE_SOURCE_UNAVAILABLE
    PROVIDER_REQUEST_FAILED
    PROVIDER_INVALID_DRAFT
    FORMAL_SPEC_VALIDATION_FAILED
    IO_ERROR

Do not map infrastructure errors to semantic states.

---

# Template versioning

If the Formal Spec grammar has a version, the template must be tied to that version.

Do not silently use an obsolete template against a newer parser.

Preferred:

    grammar version
    → template version
    → parser version

If no explicit version exists today, document that gap.

Do not invent a fake version number.

---

# Required tests

Add tests for at least:

1. canonical template is derived from actual grammar expectations;
2. template includes Requirement;
3. template includes Operation;
4. requirement text is inserted exactly;
5. authoritative operation is inserted exactly;
6. missing binding blocks template creation;
7. no operation is guessed;
8. manual template artifact is FORMAL_SPEC_DRAFT only;
9. AI path uses the same grammar contract;
10. provider text is preserved unchanged before validation;
11. invalid draft does not mutate governed state;
12. valid draft reaches review state;
13. Formal Spec approval is explicit;
14. editing approved spec invalidates approval;
15. template path and AI path converge on the same artifact/state model;
16. no Cinema/demo-specific logic;
17. Unicode/newlines survive intact;
18. platform parser remains authoritative.

---

# Scope constraints

Allowed:

- canonical template generation;
- template-based new spec action;
- AI drafting prompt reuse;
- exact-value prefill;
- formal spec draft persistence;
- validation feedback;
- exact-content approval state;
- focused tests.

Do NOT:

- weaken Formal Spec parser;
- add heuristic syntax repair;
- auto-approve template output;
- auto-approve AI output;
- guess operation identity;
- hard-code BookingService;
- build a visual DSL editor;
- redesign ontology semantics;
- add unrelated semantic classes.

---

# Product acceptance gate

Success requires:

    TEMPLATE_FROM_PLATFORM_GRAMMAR = YES
    REQUIREMENT_PREFILLED_EXACTLY = YES
    OPERATION_PREFILLED_EXACTLY = YES
    MANUAL_TEMPLATE_PATH = YES
    AI_DRAFT_PATH = YES
    SAME_DRAFT_ARTIFACT_MODEL = YES
    PLATFORM_VALIDATION = YES
    HUMAN_FORMAL_SPEC_APPROVAL = YES
    APPROVAL_INVALIDATED_ON_EDIT = YES
    OPERATION_GUESSING = 0
    FAKE_GOVERNED_STATUS = 0
    FAKE_VERIFICATION_VERDICT = 0

On full success:

    FORMAL_SPEC_TEMPLATE_GUIDED_AUTHORING_PROVEN

---

# Stop / narrow conditions

## PLATFORM_TEMPLATE_SOURCE_GAP

The grammar exists, but there is no stable canonical template/example source and deriving one safely requires a deliberate sys-platform change.

## OPERATION_BINDING_REQUIRED

The current requirement has no authoritative operation binding.

Do not guess.

## FORMAL_SPEC_PERSISTENCE_GAP

There is no sound existing place/state model for a manual/AI Formal Spec draft without introducing duplicate truth.

## CHECKPOINT_REACHED

Implementation/tests pass, but real desktop provider/template replay cannot be completed in the current environment.

## NARROW_REQUIRED

Manual template creation can be completed soundly, but AI-path convergence requires a separate change.

## STOP_UNSOUND

Any apparent solution requires:

- inventing grammar;
- guessing Operation;
- weakening parser validation;
- auto-approval;
- editor-side semantic invention.

---

# Engineering hygiene

Before finalizing:

- inspect git status/diff;
- remove debug logging;
- do not include unrelated changes;
- run focused TypeScript tests;
- run sys-platform grammar/parser/harness tests where available;
- run lint/build for changed areas;
- record toolchain/network blockers honestly;
- commit only intended files.

---

# Required final report

RESULT:
FORMAL_SPEC_TEMPLATE_GUIDED_AUTHORING_PROVEN |
PLATFORM_TEMPLATE_SOURCE_GAP |
OPERATION_BINDING_REQUIRED |
FORMAL_SPEC_PERSISTENCE_GAP |
CHECKPOINT_REACHED |
NARROW_REQUIRED |
STOP_UNSOUND

SYS_EDITOR_COMMIT:
...

SYS_PLATFORM_COMMIT:
...

CANONICAL_GRAMMAR_SOURCE:
...

CANONICAL_TEMPLATE:
...

TEMPLATE_VERSIONING:
...

REQUIREMENT_PREFILL:
PASS | FAIL

OPERATION_PREFILL:
PASS | FAIL

MANUAL_TEMPLATE_PATH:
PASS | FAIL

AI_DRAFT_PATH:
PASS | FAIL

SAME_DRAFT_ARTIFACT_MODEL:
PASS | FAIL

PLATFORM_VALIDATION:
PASS | FAIL

FORMAL_SPEC_APPROVAL:
PASS | FAIL

APPROVAL_INVALIDATION:
PASS | FAIL

OPERATION_GUESSING:
0 | explain

FAKE_GOVERNED_STATUS:
0 | explain

AUTOMATED_TESTS:
commands + counts + failures/skips

MANUAL_TAURI_EVIDENCE:
...

ENVIRONMENT_BLOCKERS:
...

NEXT_PRODUCT_GAP:
...

Stop only when template-guided Formal Spec authoring is proven or a sound stop condition is reached.
