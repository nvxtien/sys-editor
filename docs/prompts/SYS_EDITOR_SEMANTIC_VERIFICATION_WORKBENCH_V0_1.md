# Mission: Sys Editor Semantic Verification Workbench v0.1

## Current platform state

The backend exit gate is complete.

Production E2E semantic proof is established across three representative semantic classes:

1. Precondition / collection
   - B1 -> SYNCED
   - B3 -> SYNCED

2. State / effect
   - standalone booking.status becomes CONFIRMED -> SYNCED

3. Relational / quantified
   - B2 DistinctBy(requestedSeats, Seat.id) -> SYNCED

The relational proof includes:

    Formal Spec
      -> governed identity projection
      -> governed DistinctBy
      -> generic relational kernel
      -> real Java recovery
      -> helper witness summary
      -> interprocedural witness transport
      -> recovered ExistsDuplicateBy
      -> proof-backed comparator
      -> SYNCED

Safety gates:

    MIS_RECOVERED = 0
    false_greens = 0
    infrastructure_failures = 0

Mutation detection is 100% for exercised proof mutations.

The backend should now be treated as sufficiently proven for representative semantic breadth.

This mission returns focus to sys-editor.

---

# Product thesis

sys-editor is not a code viewer.

It is the human interaction layer for governed software meaning.

Boundary:

    sys-platform
      = semantics
      = ontology
      = recovery
      = synchronization
      = verification
      = governance

    sys-editor
      = navigation
      = visualization
      = review
      = explanation
      = human approval

The GUI MUST NOT invent semantics.

The GUI presents semantic state produced by the platform.

---

# Mission

Build the first usable Semantic Verification Workbench in sys-editor.

The workbench must let a developer answer, quickly:

1. What does the governed intent say?
2. What meaning was recovered from the source?
3. Are they synchronized?
4. If not, why not?
5. What evidence supports the verdict?
6. What part is unknown, unsupported, conflicted, or not observed?
7. Where in source/spec should I inspect next?

The workbench should make semantic verification understandable without requiring the user to inspect raw JSON or internal compiler structures.

This is a product-facing mission, not a backend semantic expansion mission.

---

# Primary user flow

Target first workflow:

    open project
      -> open Verification / Semantics view
      -> see governed rules
      -> see disposition per rule
      -> select a rule
      -> inspect governed meaning
      -> inspect recovered meaning
      -> inspect proof obligations/evidence
      -> navigate to relevant source/spec
      -> understand why verdict is SYNCED / DRIFTED / CONFLICTED / PARTIAL / NOT_OBSERVED / UNSUPPORTED

Use the real Cinema Booking project as the first live data source.

---

# Required screen model

The first workbench should support a structure equivalent to:

    Cinema Booking — Semantic Verification

    B1  Requested seats non-empty              SYNCED
    B2  Seats distinct by Seat.id               SYNCED
    B3  Cardinality / empty-request rule        SYNCED

    B8
      status initialized CONFIRMED              SYNCED
      legacy status guard                       WRONG_OPERATION_SCOPE / NOT_OBSERVED

    Other governed rules
      hall consistency                          PARTIAL / UNSUPPORTED
      occupancy                                 UNSUPPORTED
      past-showtime                             UNSUPPORTED

Do not hard-code Booking rule names in shared UI logic.

Booking is only the pilot dataset.

---

# Core information architecture

Implement the workbench around these concepts:

    Project
      -> Governed Rule
          -> Proof Obligation(s)
              -> Disposition
              -> Governed Semantics
              -> Recovered Semantics
              -> Evidence
              -> Reasons
              -> Source Anchors
              -> Spec Anchors
              -> Completeness
              -> Provenance

The UI should work even when some fields are missing.

Missing data must be visible as missing/unsupported, never silently fabricated.

---

# Required dispositions

Support at least these UI states when present in platform data:

    SYNCED
    DRIFTED
    CONFLICTED
    PARTIAL
    NOT_OBSERVED
    UNSUPPORTED
    WRONG_OPERATION_SCOPE

Do not invent a new semantic verdict in the editor unless it is purely a presentation grouping.

The platform remains authoritative for semantic disposition.

---

# Required details panel

When a user selects a rule or obligation, show four clearly separated sections.

## 1. Governed

Example:

    DistinctBy(
      collection = requestedSeats,
      projection = Seat.id
    )

Provenance:

    SPECIFIED

## 2. Recovered

Example:

    ExistsDuplicateBy(
      collection = requestedSeats,
      projection = Seat.id
    )

Evidence may include:

    i ∈ [0, |requestedSeats|)
    j ∈ [i+1, |requestedSeats|)
    requestedSeats[i].id == requestedSeats[j].id
    Return(true)

Provenance:

    DERIVED

## 3. Verification

Example:

    violation(DistinctBy(requestedSeats, Seat.id))
      <=> ExistsDuplicateBy(requestedSeats, Seat.id)

    result = SYNCED

Show proof obligations only when available.

Do not present internal implementation noise as user-facing proof unless it materially helps explain the verdict.

## 4. Evidence / Navigation

Show:

- source file
- source symbol
- source range if available
- formal spec document
- rule identifier
- related evidence/reason codes

Allow navigation when the current editor infrastructure supports it.

---

# Obligation-level UI

Compound rules must be decomposable in the UI.

Example:

    B8  CONFLICTED

      Guard obligation
        NOT_OBSERVED

      Effect obligation
        SYNCED

The aggregate verdict must remain visible.

Do not make a green sub-obligation appear as if the entire rule is green.

This distinction is critical.

---

# Soundness UX rules

The editor must never visually overstate certainty.

Required rules:

1. PARTIAL must not look equivalent to SYNCED.
2. NOT_OBSERVED must not be presented as disproven.
3. UNSUPPORTED must not be presented as conflict.
4. CONFLICTED must not hide independently SYNCED sub-obligations.
5. Derived semantics must be visually distinguishable from specified semantics.
6. Unknown/missing evidence must be explicit.
7. No semantic label may be inferred from display text alone.
8. The GUI must render backend reason/disposition fields rather than reconstructing them heuristically.
9. If required structured data is unavailable, show a bounded "data unavailable" state.
10. Never parse human-readable backend explanation strings to manufacture semantic objects.

---

# Platform contract first

Before implementing presentation logic, inspect the current integration contract between sys-editor and sys-platform.

Determine whether the editor can currently receive structured data for:

- governed rule id
- rule disposition
- obligation disposition
- governed semantic object
- recovered semantic object
- proof/reason codes
- provenance
- completeness
- evidence
- source anchors
- spec anchors

If the live API does not expose enough structured state:

DO NOT fake the UI with fixture-only semantic reconstruction.

Instead:

1. define the smallest versioned frontend contract required;
2. add an adapter boundary in sys-editor;
3. use a clearly labeled fixture/demo provider only for UI development;
4. record exactly which platform fields are still missing.

The editor may have:

    VerificationDataProvider

with implementations such as:

    LivePlatformVerificationProvider
    FixtureVerificationProvider

but both must emit the exact same UI-facing contract.

No semantic behavior belongs inside the provider.

---

# Suggested UI-facing contract

Use repository conventions where possible.

A shape equivalent to this is acceptable:

    VerificationProject {
      projectId
      rules[]
    }

    VerificationRule {
      id
      title
      aggregateDisposition
      obligations[]
      governed
      recovered
      reasons[]
      anchors[]
    }

    VerificationObligation {
      id
      kind
      disposition
      governed
      recovered
      evidence[]
      reasons[]
      completeness
      provenance
      anchors[]
    }

    SemanticView {
      kind
      summary
      structuredData?
    }

Do not blindly implement this exact schema if a better existing model already exists.

The objective is a stable presentation contract, not new semantic duplication.

---

# First live pilot

Use Cinema Booking.

At minimum demonstrate:

## B1 or B3

A simple collection/precondition rule:

    aggregate = SYNCED

## B2

Relational/quantified rule:

    aggregate = SYNCED

Details must expose enough information to understand:

    governed DistinctBy(requestedSeats, Seat.id)

versus:

    recovered ExistsDuplicateBy(requestedSeats, Seat.id)

with bounded witness evidence.

## State/effect rule

Show the proven standalone effect:

    booking.status becomes BookingStatus.CONFIRMED

versus recovered exact state mutation.

## Compound B8

Show:

    aggregate = CONFLICTED
    guard = NOT_OBSERVED / WRONG_OPERATION_SCOPE
    effect = SYNCED

This is important because it proves the UI can represent mixed outcomes soundly.

---

# Interaction requirements

Minimum interactions:

1. select a rule;
2. expand/collapse proof obligations;
3. switch between Governed / Recovered / Verification views;
4. inspect evidence;
5. navigate to source/spec anchor when available;
6. filter by disposition;
7. preserve selected rule when data refreshes if identity remains stable.

Do not add broad editing workflows yet.

No automatic "fix code" action in v0.1.

No semantic approval workflow unless the existing product already has a sound backend contract for it.

This milestone is primarily read/inspect/navigate.

---

# Visual hierarchy

Prioritize:

    verdict
    -> rule meaning
    -> mismatch/reason
    -> evidence
    -> implementation detail

Do not lead with raw JSON.

Raw structured semantic data may be available behind a secondary developer/debug affordance.

The main UX should use concise semantic formatting.

Example:

    Governed
    requestedSeats must be distinct by Seat.id

    Recovered
    duplicate exists when two requested seats share the same id

    Why SYNCED
    duplicate witness exactly represents violation of governed distinctness

    Evidence
    BookingService.hasDuplicate(...)

The UI may render canonical expressions beneath these summaries.

Summaries must come from deterministic formatting of semantic objects or platform-provided text, not free-form LLM inference.

---

# Non-goals

Do NOT:

- expand backend semantic coverage;
- implement B4-B10;
- add time semantics;
- add occupancy semantics;
- add new theorem proving;
- add Booking-specific UI branches;
- infer semantics from Java code in sys-editor;
- parse source code in sys-editor;
- reproduce semantic-core logic in TypeScript/React;
- hide unsupported states;
- make the GUI "all green";
- build a general IDE replacement;
- implement AI chat as the main feature;
- implement auto-fix flows.

This mission is about exposing already-proven platform meaning.

---

# Architecture boundary

Required:

    sys-platform
      -> structured verification contract
      -> sys-editor adapter
      -> presentation model
      -> UI

Forbidden:

    source/spec
      -> sys-editor inference
      -> verdict

Sys-editor never certifies correctness.

Sys-editor displays and navigates certified/recovered semantic evidence.

---

# TDD / verification requirements

Add tests for at least:

1. SYNCED rule rendering.
2. CONFLICTED rule rendering.
3. PARTIAL rule rendering.
4. NOT_OBSERVED rendering.
5. UNSUPPORTED rendering.
6. compound rule with mixed obligation dispositions.
7. specified vs derived provenance.
8. missing evidence.
9. missing anchors.
10. disposition filter.
11. stable rule selection across refresh.
12. B2 relational semantic formatting.
13. B8 aggregate-vs-obligation distinction.
14. provider contract parity between fixture and live adapter shape.
15. no UI-side semantic inference from display strings.

If snapshot testing is already used, use it selectively.

Prefer behavioral tests for critical soundness UX.

---

# Product acceptance scenario

The following scenario must be demonstrable:

1. Open Cinema Booking verification.
2. See B2 as SYNCED.
3. Select B2.
4. See governed:
       DistinctBy(requestedSeats, Seat.id)
5. See recovered:
       ExistsDuplicateBy(requestedSeats, Seat.id)
6. See bounded witness evidence.
7. See proof/reason explaining the polarity relation.
8. Navigate to BookingService.hasDuplicate or the relevant source anchor.
9. Return to rule list.
10. Select B8.
11. See aggregate CONFLICTED.
12. See effect obligation SYNCED.
13. See guard obligation NOT_OBSERVED / WRONG_OPERATION_SCOPE.
14. UI never implies B8 aggregate is SYNCED.

This is the primary v0.1 product proof.

---

# Autonomous implementation loop

You are authorized to:

    inspect current sys-editor architecture
    -> identify existing data/provider/UI boundaries
    -> choose the smallest integration design
    -> implement contract + adapter
    -> implement workbench
    -> add tests
    -> run real or fixture-backed pilot
    -> verify soundness UX

Do not ask for approval between small implementation steps.

Prefer reuse of existing sys-editor shell/components.

Avoid large visual redesign unless necessary.

Maximum 5 substantial implementation fixes before reporting a structural blocker.

---

# Stop conditions

## SUCCESS

Report:

    SEMANTIC_VERIFICATION_WORKBENCH_V0_1_PROVEN

only when:

- the workbench renders the representative proof states;
- B2 can be inspected end-to-end;
- B8 mixed obligations are represented soundly;
- no semantic inference exists in UI code;
- provider contract is explicit;
- tests pass.

## PLATFORM_CONTRACT_GAP

If the live platform cannot expose enough structured verification data:

report:

    PLATFORM_VERIFICATION_CONTRACT_GAP

Still implement the bounded UI/provider contract and fixture-backed workbench if useful, but clearly identify live missing fields.

Do NOT fake live integration.

## UI_ARCHITECTURE_GAP

If current sys-editor architecture cannot host the workbench without a larger redesign:

report:

    UI_ARCHITECTURE_GAP

and identify the smallest required boundary change.

## UNSOUND_UI

If implementation would require reconstructing semantic verdicts from text/source:

report:

    STOP_UNSOUND_UI

---

# Required final report

Report:

WORKBENCH_RESULT:
SEMANTIC_VERIFICATION_WORKBENCH_V0_1_PROVEN |
PLATFORM_VERIFICATION_CONTRACT_GAP |
UI_ARCHITECTURE_GAP |
STOP_UNSOUND_UI |
CHECKPOINT_REACHED

DATA_PROVIDER:
...

UI_CONTRACT:
...

LIVE_PLATFORM_FIELDS:
...

MISSING_PLATFORM_FIELDS:
...

RULE_LIST:
...

DETAIL_VIEW:
...

OBLIGATION_VIEW:
...

B2_DEMO:
...

B8_DEMO:
...

SOURCE_NAVIGATION:
...

SPEC_NAVIGATION:
...

FILTERING:
...

SOUNDNESS_UX:
...

TESTS:
...

DOMAIN_SPECIFIC_UI_LOGIC:
0 | explain

UI_SEMANTIC_INFERENCE:
0 | explain

NEXT_PRODUCT_GAP:
...

NEXT_RECOMMENDED_STEP:
...

Stop when the first sound Semantic Verification Workbench is demonstrated.
