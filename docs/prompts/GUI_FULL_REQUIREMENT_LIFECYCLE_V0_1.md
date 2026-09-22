# Mission: GUI Full Requirement Lifecycle v0.1

## Delegation

You are Claude/Codex acting as the implementation owner for one end-to-end product mission.

Your task is to make Sys Editor support a complete requirement lifecycle entirely from the GUI, using existing sys-platform semantics and validation as the authority.

Do not stop at partial UI scaffolding if the acceptance path is achievable.

Follow this execution order:

    Brainstorming
    → Writing plans
    → TDD
    → Implementation
    → Verification
    → only then GO / NARROW / STOP

Do not silently weaken the acceptance criteria.
Do not fabricate manual desktop evidence.

---

# Product objective

A user must be able to take one tiny requirement from plain-language intent to verified implementation without using CLI, editing JSON, or understanding internal manifests.

Target lifecycle:

    Open workspace
    → Create requirement
    → Edit requirement
    → Approve intent
    → Bind source operation
    → Draft Formal Spec
    → Platform validates candidate
    → Human reviews / approves Formal Spec
    → Implement code
    → Verify
    → Inspect governed / recovered / proof
    → Reach SYNCED
    → Break code or change requirement
    → See STALE / CONFLICTED / NOT_OBSERVED / non-green
    → Repair
    → Re-verify
    → Reach SYNCED again

This is the product milestone:

    HUMAN_INTENT_TO_VERIFIED_CODE_E2E = YES

---

# Canonical tiny requirement

Use one tiny rule for the acceptance path:

    A booking request must contain at least one seat.

Recommended source operation:

    BookingService.createBooking

Use the existing Java test/pilot workspace if available, but do not hard-code user-specific absolute paths into product code.

---

# Lifecycle states

The GUI must make the lifecycle state explicit.

Recommended conceptual states:

    NO_REQUIREMENT
    DRAFT_INTENT
    APPROVED_INTENT_UNFORMALIZED
    FORMAL_SPEC_DRAFT
    FORMAL_SPEC_APPROVED
    IMPLEMENTATION_UNVERIFIED
    VERIFIED_SYNCED
    STALE
    CONFLICTED
    NOT_OBSERVED

You may map these to existing internal types if equivalent states already exist.

Do not create duplicate state machines unnecessarily.

---

# Critical invariant

The GUI must never collapse distinct stages.

These are NOT equivalent:

    intent approved
    ≠ formal spec approved
    ≠ implementation exists
    ≠ verification passed

Every transition must be justified by either:

- explicit human action; or
- platform evidence.

Never let the UI infer a semantic state from labels, file presence, or optimistic assumptions.

---

# Human governance model

Preserve:

    User = intent + approval
    LLM = proposal / hypothesis generator
    Sys = semantic governor + verifier

Required transitions:

    DRAFT_INTENT
      --human approval-->
    APPROVED_INTENT_UNFORMALIZED

    APPROVED_INTENT_UNFORMALIZED
      --LLM proposes + sys-platform validates-->
    FORMAL_SPEC_DRAFT

    FORMAL_SPEC_DRAFT
      --human approval-->
    FORMAL_SPEC_APPROVED

    FORMAL_SPEC_APPROVED
      --verification run-->
    SYNCED / CONFLICTED / NOT_OBSERVED / other platform verdict

LLM output is never automatically governed.

---

# GUI-only requirement

The full happy path must be doable from GUI only.

The user must not need to:

- run sys CLI manually;
- edit manifest.json;
- edit project.json manually;
- construct Formal Spec files manually;
- configure hidden fixture state;
- inspect raw contract JSON.

Developer diagnostics may still exist, but they are not part of the user flow.

---

# Phase 1 — Requirement creation and editing

The existing workspace-owned requirement flow should remain:

    .sys/requirements/REQ-001.md

The user can:

- create requirement;
- edit it in the normal editor;
- save;
- see draft status;
- approve exact text.

Approval must be invalidated if the requirement text changes after approval.

If the file is dirty, do not approve stale disk text.

Choose one sound behavior:

    A. save before approve; or
    B. block approval until saved.

No stale-text approval.

---

# Phase 2 — Source operation binding

The user must be able to bind the requirement to a source operation from GUI.

Preferred UX:

    [ Bind source operation ]

The binding must be explicit and reviewable.

If a current text field is retained temporarily, the UI must clearly say whether it is:

- syntactic only;
- source-resolved;
- authoritative.

Preferred product direction:

    source operation binding
    → resolved against current workspace
    → one unambiguous operation identity
    → persisted as project state

Do not silently guess an operation from natural-language requirement text.

If multiple candidates exist:

    AMBIGUOUS

If none:

    NOT_FOUND

Never select the first candidate heuristically.

---

# Phase 3 — Draft Formal Spec

The user clicks:

    Draft spec from request

The current one-shot generation pipeline should be used:

    requirement text
    + selected model
    + authoritative operation binding
    → dedicated one-shot endpoint
    → candidate Formal Spec
    → temp .sys/proposals/*.spec
    → sys-platform validation
    → candidate accepted for review

Requirements:

- provider text preserved exactly before validation;
- no editor semantic rewriting;
- no markdown-fence cleanup that changes meaning;
- no guessed Operation;
- no fake success;
- governed state unchanged on invalid draft.

If the platform rejects the candidate:

    show a bounded validation error
    keep the prior governed state unchanged
    allow retry / edit

---

# Phase 4 — Formal Spec review and approval

A platform-valid candidate is still only a draft.

The user must be able to:

    review candidate
    edit if allowed
    approve explicitly

The UI should show:

    Formal Spec: Draft

and after approval:

    Formal Spec: Approved

Approval must refer to the exact approved Formal Spec content.

If the Formal Spec changes later:

    approval becomes stale / invalidated

Do not represent a changed spec as still approved.

---

# Phase 5 — Open implementation

After Formal Spec approval, the GUI must provide:

    [ Open source ]

Use the authoritative source binding / platform anchor.

Navigation preference:

    platform-observed source span
    → language symbol provider fallback
    → file-level fallback

No text-search guessing.

The user then implements manually.

For the canonical requirement, a valid implementation may resemble:

    if (requestedSeats.isEmpty()) {
        throw new IllegalArgumentException(...);
    }

But do not hard-code B1-specific logic in the editor.

---

# Phase 6 — Verification

Provide a GUI action:

    [ Verify ]

The GUI must invoke the existing sys-platform verification flow for THIS workspace and THIS requirement.

Do not use the global Cinema Booking manifest as implicit project state.

Preferred flow:

    current workspace Sys state
    → generated / resolved platform verification input
    → sys-platform
    → structured verification contract
    → Sys Editor rendering

The user should not manage manifest paths manually for normal product flow.

If a manifest is still internally required, generate/resolve it deterministically from current project state.

Do not expose it as required user setup.

---

# Phase 7 — Verification result UX

For each requirement show:

    Intent: Approved
    Formal Spec: Approved
    Source: <binding>
    Verification: SYNCED | CONFLICTED | NOT OBSERVED | ...

For non-green results, the GUI must let the user answer:

    What was governed?
    What was recovered?
    Why are they not equivalent?
    What evidence supports the verdict?

Reuse existing structured verification UI:

    Governed
    Recovered
    Verification
    Evidence / Navigation

Do not parse prose to reconstruct structured semantics.

---

# Phase 8 — Staleness

The lifecycle must react correctly to changes.

## Requirement changes

If approved requirement text changes:

    intent approval invalidated
    downstream Formal Spec approval must become stale / invalid

Do not let old Formal Spec remain silently authoritative.

## Formal Spec changes

If approved Formal Spec changes:

    Formal Spec approval invalidated
    verification result becomes stale

## Source changes

If source changes after a verification result:

    verification must become stale or require re-run

Do not continue displaying SYNCED as current without indicating staleness.

Use existing source digest / observed span identity where available.

---

# Phase 9 — Non-green mutation proof

The acceptance path must prove that verification is semantic, not keyword-based.

Start from SYNCED.

Then introduce one incorrect implementation mutation.

Examples:

    if (!requestedSeats.isEmpty()) {
        throw ...
    }

or remove the guard entirely.

Run Verify again.

Expected:

    result is non-green

Then repair the implementation.

Run Verify again.

Expected:

    SYNCED

Required milestone:

    MUTATION_DETECTED = YES

---

# Workspace ownership

All state must belong to the current workspace.

Required:

    <workspace>/.sys/...

Forbidden:

    external demo state presented as current project state
    implicit shared global project state
    cross-workspace leakage

Opening workspace B must never show workspace A's requirement lifecycle.

---

# Demo policy

Cinema Booking remains allowed only as explicit demo/test mode.

Required invariant:

    SILENT_FIXTURE_FALLBACK = 0

No product code path may silently switch to fixture when real project state is missing or broken.

---

# Persistence model

Reuse the existing workspace-owned state where possible.

Likely artifacts:

    .sys/project.json
    .sys/requirements/REQ-001.md
    .sys/proposals/...
    .sys/specs/...   (only if existing architecture uses this)

Do not introduce a database.

Do not create duplicate sources of truth.

Formal Spec ownership must be clear:

    candidate draft
    ≠ approved governed Formal Spec

---

# Error states

Differentiate at least:

    NO_WORKSPACE
    NO_SYS_PROJECT_YET
    MALFORMED_SYS_PROJECT
    IO_ERROR
    OPERATION_NOT_BOUND
    OPERATION_NOT_FOUND
    OPERATION_AMBIGUOUS
    PROVIDER_REQUEST_FAILED
    PROVIDER_INVALID_DRAFT
    FORMAL_SPEC_VALIDATION_FAILED
    FORMAL_SPEC_NOT_APPROVED
    VERIFICATION_NOT_CONFIGURED
    PLATFORM_EXECUTION_ERROR

Infrastructure errors must never appear as semantic verdicts.

---

# Required TDD coverage

Add or extend tests for at least:

1. create requirement;
2. exact-text human approval;
3. approval invalidated after edit;
4. no stale-disk approval from dirty editor;
5. source binding persisted;
6. no guessed source binding;
7. Formal Spec generation uses authoritative operation;
8. invalid provider draft does not mutate governed state;
9. valid platform-validated draft enters Draft state;
10. Formal Spec approval explicit;
11. Formal Spec approval invalidated on spec edit;
12. verification can run from project state without manual manifest editing;
13. SYNCED renders from structured platform result;
14. non-green result renders without prose inference;
15. source/spec/requirement changes mark downstream state stale;
16. mutation changes SYNCED → non-green;
17. repair changes non-green → SYNCED;
18. workspace isolation;
19. no fixture fallback;
20. infrastructure failure never becomes semantic verdict.

Prefer pure model/service tests plus focused GUI/view tests.

Do not rely only on brittle DOM snapshots.

---

# Full desktop acceptance scenario

Use real Tauri desktop.

Open a clean workspace.

## Step 1

Create REQ-001.

Enter:

    A booking request must contain at least one seat.

Save.

Expected:

    Intent: Draft

## Step 2

Approve intent.

Expected:

    Intent: Approved
    Formal Spec: Not created

## Step 3

Bind:

    BookingService.createBooking

Expected:

    source binding visible and persisted

## Step 4

Click:

    Draft spec from request

Expected:

    provider request succeeds
    platform validation succeeds
    candidate visible as Formal Spec Draft

## Step 5

Approve Formal Spec.

Expected:

    Formal Spec: Approved

## Step 6

Open source.

Implement the rule manually.

Save.

## Step 7

Click Verify.

Expected:

    Verification: SYNCED

Open details.

Confirm governed / recovered / proof are understandable.

## Step 8

Break implementation.

Verify.

Expected:

    non-green

## Step 9

Repair implementation.

Verify.

Expected:

    SYNCED

This entire path must use GUI only.

---

# Product acceptance gate

Success requires:

    GUI_REQUIREMENT_CREATION = YES
    HUMAN_INTENT_APPROVAL = YES
    SOURCE_BINDING = YES
    FORMAL_SPEC_DRAFT = YES
    PLATFORM_DRAFT_VALIDATION = YES
    HUMAN_FORMAL_SPEC_APPROVAL = YES
    OPEN_IMPLEMENTATION = YES
    GUI_VERIFICATION = YES
    SYNCED_RESULT = YES
    MUTATION_DETECTED = YES
    REPAIR_TO_SYNCED = YES
    STALENESS_HANDLING = YES
    SILENT_FIXTURE_FALLBACK = 0
    CROSS_WORKSPACE_STATE_LEAK = 0
    FAKE_GOVERNED_STATUS = 0
    FAKE_VERIFICATION_VERDICT = 0

On full success report:

    GUI_FULL_REQUIREMENT_LIFECYCLE_PROVEN

---

# Scope control

Allowed:

- project lifecycle UI;
- requirement approval hardening;
- source binding resolution;
- candidate Formal Spec review/approval;
- project-owned verification setup;
- structured verification rendering;
- staleness tracking;
- focused supporting platform/editor glue;
- tests and harnesses directly needed for this lifecycle.

Do NOT:

- redesign the entire ontology model;
- add unrelated semantic classes;
- broaden language support beyond what the acceptance path needs;
- build a general workflow engine;
- add AI auto-fix;
- add multiple providers beyond what already exists;
- weaken sys-platform validation;
- bypass source recovery;
- make the editor a second semantic authority.

---

# Stop / narrow conditions

## CHECKPOINT_REACHED

Implementation/tests are complete but real desktop provider replay cannot be performed.

## PLATFORM_CONTRACT_GAP

The current sys-platform CLI/contract cannot express the lifecycle state needed by GUI without a deliberate platform change.

## SOURCE_BINDING_GAP

The GUI cannot resolve an operation soundly without new platform/editor support.

## STALENESS_MODEL_GAP

The existing persisted model cannot represent approval/verification staleness soundly.

## NARROW_REQUIRED

A bounded subset is complete but full lifecycle cannot be proven without a separate foundational change.

Do not call full success.

## STOP_UNSOUND

Any apparent solution would require:

- guessing operation identity;
- accepting unvalidated LLM output;
- silently preserving approval after content changes;
- fixture fallback;
- fake verification;
- editor-side semantic invention.

---

# Engineering hygiene

Before finalizing:

- inspect git status and diff;
- remove temporary logging;
- do not include unrelated changes;
- run relevant TypeScript tests;
- run relevant Rust/Go/platform tests where toolchain is available;
- record environment blockers separately;
- run lint/type/build for changed areas;
- keep working tree clean;
- commit intended changes.

Do not claim tests passed if they were blocked by missing toolchain/network.

---

# Required final report

RESULT:
GUI_FULL_REQUIREMENT_LIFECYCLE_PROVEN |
CHECKPOINT_REACHED |
PLATFORM_CONTRACT_GAP |
SOURCE_BINDING_GAP |
STALENESS_MODEL_GAP |
NARROW_REQUIRED |
STOP_UNSOUND

SYS_EDITOR_COMMIT:
...

SYS_PLATFORM_COMMIT:
...

WORKSPACE:
...

REQUIREMENT:
...

INTENT_APPROVAL:
PASS | FAIL

SOURCE_BINDING:
PASS | FAIL

FORMAL_SPEC_DRAFT:
PASS | FAIL

PLATFORM_DRAFT_VALIDATION:
PASS | FAIL

FORMAL_SPEC_APPROVAL:
PASS | FAIL

OPEN_SOURCE:
PASS | FAIL

VERIFY_FROM_GUI:
PASS | FAIL

FIRST_SYNCED:
PASS | FAIL

MUTATION_RESULT:
...

REPAIR_RESULT:
...

STALENESS_RESULT:
...

SILENT_FIXTURE_FALLBACK:
0 | explain

FAKE_GOVERNED_STATUS:
0 | explain

FAKE_VERIFICATION_VERDICT:
0 | explain

CROSS_WORKSPACE_STATE_LEAK:
0 | explain

AUTOMATED_TESTS:
commands + counts + failures/skips

MANUAL_TAURI_EVIDENCE:
...

ENVIRONMENT_BLOCKERS:
...

NEXT_PRODUCT_GAP:
...

Stop only when the full GUI lifecycle is proven or a sound stop condition is reached.
