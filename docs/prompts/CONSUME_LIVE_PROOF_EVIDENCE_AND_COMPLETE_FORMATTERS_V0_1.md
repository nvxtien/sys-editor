# Mission: Consume Live Proof Evidence and Complete Formatters v0.1

## Current state

The backend semantic pipeline is proven across three representative semantic classes:

1. Precondition / collection
   - B1 -> SYNCED

2. State / effect
   - standalone booking.status becomes CONFIRMED -> SYNCED

3. Relational / quantified
   - B2 DistinctBy(requestedSeats, Seat.id) -> SYNCED

The live verification contract is proven:

    verification.v0.1

The contract now includes structured proof evidence for B2.

Live B2 contains:

    governed:
      DISTINCT_BY(requestedSeats, id)
      provenance = SPECIFIED
      completeness = EXACT

    recovered:
      EXISTS_DUPLICATE_BY(requestedSeats, id)
      provenance = DERIVED
      completeness = EXACT

    witness:
      EXISTS_WITNESS
      i ∈ [0, Cardinality(requestedSeats))
      j ∈ [i + 1, Cardinality(requestedSeats))
      requestedSeats[i].id == requestedSeats[j].id
      Return(true)
      provenance = DERIVED
      completeness = EXACT

    proof:
      kind = RELATIONAL_EQUIVALENCE
      relation = VIOLATION_EQUIVALENCE
      result = PROVEN

      obligations:
        SAME_COLLECTION
        SAME_PROJECTION
        PAIRWISE_DOMAIN
        EQUALITY_PREDICATE
        CORRECT_POLARITY
        COMPATIBLE_FAILURE_EFFECT

Binder identities are structural and stable:

    operation
    scope
    ordinal

Dependent binder references use binderId, not displayName.

The contract is additive and remains:

    verification.v0.1

The live provider path in sys-editor is already implemented at provider/decoder level.

The remaining editor gaps are:

1. consume the newly available B2 witness and proof objects;
2. render them deterministically;
3. add deterministic formatters for semantic kinds that currently fall back to "Unsupported semantic kind";
4. fix UTF-8 stdout chunk decoding at the process boundary;
5. preserve all existing soundness invariants.

This mission does NOT prove desktop visual E2E. That remains a separate final smoke mission.

---

# Mission

Update sys-editor so the existing live Semantic Verification Workbench consumes and renders the full structured proof-evidence contract without reconstructing semantics.

Target:

    sys-platform verification.v0.1
      -> LivePlatformVerificationProvider
      -> wire decoder
      -> UI contract
      -> deterministic semantic/proof formatters
      -> existing Verification Workbench

Primary success case:

    select B2
      -> Governed tab renders DistinctBy(...)
      -> Recovered tab renders ExistsDuplicateBy(...)
      -> Evidence renders exact bounded ExistsWitness
      -> Verification tab renders RELATIONAL_EQUIVALENCE /
         VIOLATION_EQUIVALENCE with structured obligations
      -> no prose parsing
      -> no semantic inference

Do not ask for approval between small implementation steps.

---

# Critical boundary

sys-platform remains the semantic authority.

sys-editor may:

- decode structured fields;
- preserve stable IDs;
- deterministically format structured semantic objects;
- deterministically format structured evidence;
- deterministically format proof objects;
- render known enums and operators;
- display bounded raw JSON for unknown kinds;
- navigate anchors;
- surface infrastructure errors.

sys-editor MUST NOT:

- infer missing semantic fields;
- derive witness structure from EXISTS_DUPLICATE_BY;
- reconstruct binders from strings;
- synthesize Return(true);
- infer polarity from prose;
- derive proof obligations;
- inspect Java to fill missing contract data;
- parse human-readable summaries for semantics.

Formatting is not semantic inference.

---

# Primary B2 rendering target

## Governed view

Render structured:

    DISTINCT_BY

as an equivalent deterministic view such as:

    DistinctBy(requestedSeats, by=[id])

or:

    requestedSeats must be distinct by id

Canonical structured form should remain available.

Do not derive Seat.id from source or title text.

Use the wire projection directly.

## Recovered view

Render structured:

    EXISTS_DUPLICATE_BY

as an equivalent deterministic view such as:

    ExistsDuplicateBy(requestedSeats, by=[id])

Again, use only structured wire fields.

## Evidence view

Render the exact EXISTS_WITNESS.

Required user-visible information:

    i ∈ [0, |requestedSeats|)
    j ∈ [i + 1, |requestedSeats|)
    requestedSeats[i].id == requestedSeats[j].id
    Return(true)

Also surface, where appropriate:

    provenance = DERIVED
    completeness = EXACT

Do not hard-code i/j semantics.

Display names may be used only for presentation.

All dependency resolution must originate from binderId references.

## Verification view

Render the structured proof:

    RELATIONAL_EQUIVALENCE
    VIOLATION_EQUIVALENCE
    result = PROVEN

and the structured obligations:

    SAME_COLLECTION
    SAME_PROJECTION
    PAIRWISE_DOMAIN
    EQUALITY_PREDICATE
    CORRECT_POLARITY
    COMPATIBLE_FAILURE_EFFECT

A deterministic summary is acceptable, for example:

    violation(DistinctBy(requestedSeats, id))
      <=> ExistsDuplicateBy(requestedSeats, id)

    PROVEN

but it must be generated from structured proof fields, not from a prewritten B2 string.

---

# Complete deterministic semantic formatters

The current editor only formats:

    DISTINCT_BY
    EXISTS_DUPLICATE_BY
    STATE_MUTATION

Add deterministic formatters for the live semantic kinds already emitted by the platform and currently falling back to unsupported display.

At minimum:

    COLLECTION_EMPTINESS
    OR
    COMPARE
    FAILURE
    EFFECTS

Also support the newly transported structured kinds:

    EXISTS_WITNESS
    RELATIONAL_EQUIVALENCE

If the actual wire names differ, use the actual contract enum/tag names.

Do not invent semantic meaning beyond the structured fields.

---

# Formatter design

Prefer small pure functions.

Examples:

    formatSemanticObject(...)
    formatSemanticExpression(...)
    formatEvidence(...)
    formatProof(...)
    formatBinderDomain(...)
    formatDisposition(...)
    formatReason(...)

Do not create Booking-specific branches.

Bad:

    if rule.id === "B2" ...

Bad:

    if title.includes("duplicate") ...

Good:

    switch semantic.kind

Unknown kind:

    Unsupported semantic kind: <kind>

with bounded structured JSON or debug detail.

Unknown kind must not crash the view.

---

# COLLECTION_EMPTINESS

Format only from structured fields.

Expected equivalent output:

    isEmpty(requestedSeats)

or repository-appropriate canonical formatting.

Do not infer null semantics unless represented in the object.

---

# OR

Format recursively from structured children.

Equivalent:

    A OR B

Preserve grouping.

Do not flatten in a way that changes precedence.

---

# COMPARE

Format structured operands + comparison operator.

Examples:

    a == b
    a != b
    count > 0

Only support operators represented by the contract.

Unknown operator must fail boundedly.

---

# FAILURE

Format structured failure semantics.

Equivalent:

    Failure(BookingRejectedException)

Only if the exception/type is present in the structured object.

Do not infer failure from surrounding rule disposition.

---

# EFFECTS

Format ordered effects.

Preserve effect order if contract order is semantically meaningful.

Equivalent:

    Effects[
      booking.status = BookingStatus.CONFIRMED
    ]

Do not collapse multiple effects into one summary that loses information.

---

# EXISTS_WITNESS formatter

Render from structured evidence.

Required support:

- binders;
- binderId;
- displayName;
- Range;
- Literal;
- Cardinality;
- Add;
- BinderRef;
- IndexedAccess;
- Property;
- Equal;
- Return(true);
- provenance;
- completeness.

Binder references must resolve by binderId.

If a binder reference cannot be resolved:

    show explicit unresolved binder reference

Do not guess by display name.

---

# RELATIONAL_EQUIVALENCE formatter

Render:

- proof kind;
- relation;
- result;
- governed semantic ref/object;
- recovered semantic ref/object;
- obligations.

Known relation:

    VIOLATION_EQUIVALENCE

must not be displayed as direct equality.

Preferred rendering:

    violation(<governed>) <=> <recovered>

Do not render:

    <governed> == <recovered>

This polarity distinction is a soundness requirement.

---

# Provenance and completeness

Render structured values where present.

At minimum support:

    SPECIFIED
    OBSERVED
    DERIVED
    INFERRED

and:

    EXACT
    PARTIAL
    UNKNOWN

Use existing UI badges/styles if available.

Do not visually make:

    DERIVED == SPECIFIED

or:

    PARTIAL == EXACT

---

# Live B8 behavior

Do not change platform semantics.

Render whatever the live contract actually supplies.

Important: previous runs disagreed on B8 effect:

- one run reported effect NOT_OBSERVED;
- a later repository run reported effect SYNCED.

Do not encode either expected value in shared formatter/provider logic.

For this mission:

    B8 aggregate must render from live contract
    guard must render from live contract
    effect must render from live contract

No fixture expectation may override it.

If the live acceptance probe reports:

    B8 aggregate = CONFLICTED
    guard = NOT_OBSERVED / WRONG_OPERATION_SCOPE
    effect = SYNCED

render exactly that.

If another authoritative manifest produces a different effect result, preserve that result and report the manifest difference.

---

# B3 clarification

Do not claim B3 as an independent semantic breadth proof.

The current pilot manifest previously used B3 text equivalent to B1.

Render B3 normally if present, but product/report language must not count it as a separate semantic class.

Representative breadth remains:

    B1 -> precondition / collection
    standalone state/effect -> state/effect
    B2 -> relational / quantified

---

# UTF-8 stdout chunking bug

The current Tauri task transport receives stdout in chunks.

Known issue:

    stdout chunks are decoded independently

Therefore a multi-byte UTF-8 code point split across chunk boundaries can be corrupted.

Fix this boundary using a stateful streaming decoder.

Preferred equivalent:

    const decoder = new TextDecoder("utf-8")

    decoder.decode(chunk, { stream: true })

and final flush:

    decoder.decode()

Use repository/runtime-compatible implementation.

Do not concatenate shell strings.

Preserve existing:

- stdout/stderr separation;
- shell:false;
- exit-code validation;
- timeout/kill behavior.

Add a test where a multi-byte character is intentionally split across chunk boundaries.

The reconstructed stdout must equal the original UTF-8 string exactly.

---

# Live provider behavior

Preserve existing provider invariants:

    dataSource = live by default

Fixture is used only when explicitly configured.

Required:

    live failure
    -> infrastructure error

Forbidden:

    live failure
    -> silent fixture fallback

Keep provider domain-generic.

---

# Error model

Preserve infrastructure errors separately from semantic dispositions.

Existing codes include:

    CONFIG_MISSING
    EXECUTABLE_NOT_FOUND
    MANIFEST_NOT_FOUND
    PLATFORM_EXECUTION_ERROR
    INVALID_JSON
    UNSUPPORTED_SCHEMA_VERSION
    MALFORMED_CONTRACT
    EMPTY_RULE_SET
    TIMEOUT

CANCELLED may remain defined but unused if cancellation still is not wired.

Do not turn any transport error into:

    CONFLICTED
    PARTIAL
    NOT_OBSERVED
    UNSUPPORTED

---

# Refresh behavior

Preserve:

- stable rule selection by ID;
- stable obligation selection by ID;
- vanished selections cleared safely;
- stale expanded obligations pruned;
- single-flight live loads.

No title matching.

No B-rule special cases.

---

# Navigation

Do not expand navigation scope beyond the existing implementation.

Preserve:

- source anchor open;
- spec anchor open;
- bounded failure when anchor open fails;
- file-only open when range is unavailable.

Do not parse opaque range strings into guessed locations.

Desktop navigation verification remains part of the later smoke mission.

---

# TDD requirements

Add/update tests for at least:

1. EXISTS_WITNESS wire decoding.
2. RELATIONAL_EQUIVALENCE wire decoding.
3. binder structural IDs preserved.
4. BinderRef resolves by binderId.
5. duplicate display names do not break binder resolution.
6. outer range formatting.
7. dependent inner range formatting.
8. indexed-access property formatting.
9. equality predicate formatting.
10. Return(true) formatting.
11. provenance DERIVED rendering.
12. completeness EXACT rendering.
13. VIOLATION_EQUIVALENCE renders with violation polarity.
14. proof obligations render deterministically.
15. DISTINCT_BY formatter.
16. EXISTS_DUPLICATE_BY formatter.
17. COLLECTION_EMPTINESS formatter.
18. OR formatter preserves grouping.
19. COMPARE formatter.
20. FAILURE formatter.
21. EFFECTS formatter preserves order.
22. unknown semantic kind remains bounded.
23. unknown proof/evidence kind remains bounded.
24. B1 no longer requires "Unsupported semantic kind" for supported objects.
25. B2 full live evidence maps into UI contract.
26. B2 Verification view no longer says "No proof obligation available".
27. live B8 values are mapped without hard-coded expected effect.
28. fixture remains explicit-only.
29. live failure never falls back to fixture.
30. infrastructure errors remain non-semantic.
31. UTF-8 multi-byte code point split across chunks decodes correctly.
32. normal ASCII/chunk transport remains unchanged.
33. refresh stable rule ID behavior remains green.
34. refresh stable obligation ID behavior remains green.
35. no Booking-specific branch in provider/formatter.
36. no semantic inference from title/summary/prose.

Use the real verification.v0.1 output for at least one integration probe.

---

# Real live probe

Run:

    real Cinema Booking manifest
      -> spec-code-sync verification-v0.1
      -> live wire decoder
      -> UI contract
      -> semantic/evidence/proof formatters

Verify structurally:

## B1

Supported semantic objects no longer fall back unnecessarily to:

    Unsupported semantic kind

## B2

Must produce from live structured fields:

    Governed:
      DistinctBy(requestedSeats, by=[id])

    Recovered:
      ExistsDuplicateBy(requestedSeats, by=[id])

    Evidence:
      i ∈ [0, |requestedSeats|)
      j ∈ [i+1, |requestedSeats|)
      requestedSeats[i].id == requestedSeats[j].id
      Return(true)
      DERIVED
      EXACT

    Verification:
      RELATIONAL_EQUIVALENCE
      VIOLATION_EQUIVALENCE
      PROVEN

      obligations:
        SAME_COLLECTION
        SAME_PROJECTION
        PAIRWISE_DOMAIN
        EQUALITY_PREDICATE
        CORRECT_POLARITY
        COMPATIBLE_FAILURE_EFFECT

No line above may be reconstructed from prose.

## State/effect

Must still render the structured state mutation.

## B8

Must render exactly the live aggregate and obligation values produced by the chosen manifest.

Report the manifest path used.

Do not silently switch manifests to obtain expected colors.

---

# Non-goals

Do NOT:

- change sys-platform semantics;
- change verification verdicts;
- modify comparator logic;
- rewrite B8 spec;
- implement B4-B10;
- add time semantics;
- add occupancy semantics;
- add AI explanation;
- add auto-fix;
- add approval workflows;
- redesign the workbench;
- add desktop automation in this mission;
- claim desktop rendered E2E.

This mission is live proof consumption + deterministic presentation only.

---

# Hard safety gates

Required:

    DOMAIN_SPECIFIC_PROVIDER_LOGIC = 0
    DOMAIN_SPECIFIC_FORMATTER_LOGIC = 0
    UI_SEMANTIC_INFERENCE = 0
    PROSE_PARSING = 0
    SILENT_FIXTURE_FALLBACK = 0

The editor must preserve:

    Unknown > unjustified interpretation

If the contract lacks a field:

    show missing/unsupported

Do not derive it.

---

# Success condition

Call success only if:

1. live EXISTS_WITNESS is decoded and rendered;
2. live RELATIONAL_EQUIVALENCE proof is decoded and rendered;
3. B2 can be explained entirely from structured contract data;
4. supported live semantic kinds no longer fall back unnecessarily;
5. B1 supported objects render deterministically;
6. state/effect still renders correctly;
7. B8 renders actual live data with no expectation override;
8. UTF-8 chunk decoding is safe across multi-byte split boundaries;
9. fixture remains explicit-only;
10. no domain-specific formatter/provider logic exists;
11. no prose parsing exists;
12. no UI semantic inference exists;
13. tests pass;
14. real live provider/decoder/formatter probe passes.

On success report:

    LIVE_PROOF_EVIDENCE_CONSUMPTION_V0_1_PROVEN

Also report:

    B2_LIVE_EXPLANATION_RENDERING_PROVEN = YES

Do NOT report:

    PRODUCT_VERIFICATION_E2E_PROVEN = YES

because desktop rendered interaction is still untested.

The next mission after success is:

    DESKTOP_LIVE_WORKBENCH_SMOKE_V0_1

---

# Stop conditions

## SUCCESS

    LIVE_PROOF_EVIDENCE_CONSUMPTION_V0_1_PROVEN

## WIRE_CONTRACT_GAP

If the new verification.v0.1 fields cannot be mapped without missing information:

    LIVE_PROOF_WIRE_CONTRACT_GAP

List exact missing fields.

## FORMATTER_MODEL_GAP

If structured semantic/evidence objects cannot be rendered without introducing a larger generic expression model:

    VERIFICATION_FORMATTER_MODEL_GAP

Identify the smallest missing generic formatter abstraction.

## TRANSPORT_DECODING_GAP

If the Tauri task API cannot safely preserve arbitrary UTF-8 output:

    LIVE_TRANSPORT_UTF8_GAP

## STOP_UNSOUND_UI

If implementation would require:

- semantic reconstruction;
- prose parsing;
- domain-specific branch logic;
- silent fixture fallback;
- guessed binder identity;
- guessed polarity;

stop immediately.

---

# Required final report

WORKBENCH_RESULT:
LIVE_PROOF_EVIDENCE_CONSUMPTION_V0_1_PROVEN |
LIVE_PROOF_WIRE_CONTRACT_GAP |
VERIFICATION_FORMATTER_MODEL_GAP |
LIVE_TRANSPORT_UTF8_GAP |
STOP_UNSOUND_UI |
CHECKPOINT_REACHED

DATA_SOURCE:
...

CONTRACT_VERSION:
...

MANIFEST_USED:
...

WIRE_DECODER:
...

B2_GOVERNED_RENDER:
...

B2_RECOVERED_RENDER:
...

B2_WITNESS_RENDER:
...

B2_PROOF_RENDER:
...

B2_PROOF_OBLIGATIONS:
...

BINDER_RESOLUTION:
...

PROVENANCE_RENDER:
...

COMPLETENESS_RENDER:
...

COLLECTION_EMPTINESS_FORMATTER:
...

OR_FORMATTER:
...

COMPARE_FORMATTER:
...

FAILURE_FORMATTER:
...

EFFECTS_FORMATTER:
...

UNKNOWN_KIND_BEHAVIOR:
...

B1_LIVE:
...

B2_LIVE:
...

STATE_EFFECT_LIVE:
...

B8_LIVE:
...

UTF8_STREAM_DECODING:
...

FIXTURE_FALLBACK_BEHAVIOR:
...

REFRESH_BEHAVIOR:
...

ERROR_MODEL:
...

TESTS:
...

REAL_LIVE_PROBE:
...

DOMAIN_SPECIFIC_PROVIDER_LOGIC:
0 | explain

DOMAIN_SPECIFIC_FORMATTER_LOGIC:
0 | explain

UI_SEMANTIC_INFERENCE:
0 | explain

PROSE_PARSING:
0 | explain

SILENT_FIXTURE_FALLBACK:
0 | explain

B2_LIVE_EXPLANATION_RENDERING_PROVEN:
YES | NO

PRODUCT_VERIFICATION_E2E_PROVEN:
NO

NEXT_PRODUCT_GAP:
...

NEXT_RECOMMENDED_STEP:
DESKTOP_LIVE_WORKBENCH_SMOKE_V0_1 | explain

Stop after live proof evidence is correctly consumed and rendered at the provider/decoder/formatter level, or a stop condition is reached.
