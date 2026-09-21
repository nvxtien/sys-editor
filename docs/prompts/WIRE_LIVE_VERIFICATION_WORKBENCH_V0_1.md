# Mission: Wire Live Verification Workbench v0.1

## Current state

The semantic backend is proven.

Production E2E verification is established across three representative semantic classes:

1. Precondition / collection
   - B1 -> SYNCED
   - B3 -> SYNCED

2. State / effect
   - standalone booking.status becomes CONFIRMED -> SYNCED

3. Relational / quantified
   - B2 DistinctBy(requestedSeats, Seat.id) -> SYNCED

Safety gates remain:

    MIS_RECOVERED = 0
    false_greens = 0
    infrastructure_failures = 0

sys-platform now exposes a structured live verification contract:

    verification.v0.1

Transport:

    spec-code-sync verification-v0.1 <manifest.json>

The contract has already proven live serialization for:

- B1 -> SYNCED
- B3 -> SYNCED
- B2 -> SYNCED
  - governed DISTINCT_BY
  - recovered EXISTS_DUPLICATE_BY
- standalone state/effect -> SYNCED
- B8 -> CONFLICTED
  - guard -> NOT_OBSERVED
  - reason -> WRONG_OPERATION_SCOPE
  - effect -> SYNCED

The contract is:

- structured;
- versioned;
- deterministic;
- machine-readable;
- free of prose parsing;
- free of domain-specific transport logic;
- free of semantic inference in the transport layer.

sys-editor already has a fixture-backed Semantic Verification Workbench with:

- VerificationProject / VerificationRule / VerificationObligation contract;
- disposition filtering;
- aggregate + obligation rendering;
- Governed / Recovered / Verification tabs;
- evidence rendering;
- source navigation;
- soundness-aware visual states;
- FixtureVerificationDataProvider;
- placeholder LivePlatformVerificationDataProvider.

The remaining product gap is ONLY live wiring.

## Mission

Wire sys-editor to consume sys-platform verification.v0.1 live output and make the live provider the real runtime path for the Cinema Booking pilot.

Target:

    sys-platform
      spec-code-sync verification-v0.1 <manifest>
            ↓
      structured VerificationProject JSON
            ↓
    sys-editor
      LivePlatformVerificationProvider
            ↓
      existing VerificationProject UI contract
            ↓
      Semantic Verification Workbench

Success means the existing workbench renders real platform verification state without semantic reconstruction.

Do not ask for approval between small fixes.

---

# Product objective

Prove the full product path:

    governed intent
      ↓
    sys-platform semantic verification
      ↓
    verification.v0.1
      ↓
    sys-editor live provider
      ↓
    developer-visible semantic verification UI

On success:

    PRODUCT_VERIFICATION_E2E_PROVEN = YES

This is the integration milestone.

Do NOT expand backend semantic coverage.

Do NOT redesign the workbench unless a minimal integration change requires it.

---

# Critical architectural boundary

Required:

    sys-platform = semantic authority

    sys-editor = consumer / presentation layer

The editor may:

- execute/invoke the platform transport;
- read structured JSON;
- validate schema version;
- adapt wire DTOs into the existing UI-facing contract;
- format structured semantic objects deterministically;
- navigate anchors;
- surface transport/runtime errors.

The editor MUST NOT:

- derive verdicts;
- infer proof semantics;
- parse CLI prose;
- parse report prose;
- inspect Java to reconstruct meaning;
- infer dispositions from titles or summaries;
- invent missing obligations;
- silently replace live data with fixture data.

---

# First step: inspect existing integration path

Before coding, inspect current sys-editor architecture and determine the smallest live transport boundary.

Identify:

1. how sys-editor currently launches or communicates with local tools/processes;
2. whether sys-platform/spec-code-sync binary path is already configurable;
3. how project/workspace roots are represented;
4. where Cinema Booking manifest path should come from;
5. whether an existing process service, IPC layer, command runner, or backend bridge should be reused;
6. how cancellation, stderr, non-zero exit, and timeout are currently handled.

Use existing infrastructure.

Do not introduce a bespoke networking layer if process invocation or existing IPC is sufficient.

---

# Live provider responsibility

Implement LivePlatformVerificationProvider as a thin transport adapter.

Responsibilities:

1. locate/invoke the verification.v0.1 producer;
2. pass the selected project/manifest;
3. capture structured stdout or structured artifact;
4. reject unsupported schema versions;
5. deserialize into wire DTOs;
6. validate required structural fields;
7. map wire DTOs into the existing sys-editor VerificationProject contract;
8. preserve all semantic dispositions and obligation structure;
9. preserve semantic object structure;
10. preserve evidence/reason/provenance/completeness fields;
11. preserve source/spec anchors;
12. surface transport errors honestly.

No semantic inference.

---

# Preferred transport

Use the proven platform entrypoint:

    spec-code-sync verification-v0.1 <manifest.json>

unless repository inspection shows an already-better supported integration boundary.

If invoking the executable:

- use argument arrays, not shell-concatenated command strings;
- avoid shell injection;
- capture stdout separately from stderr;
- require exit code 0;
- parse stdout as JSON only;
- do not scrape mixed console text;
- support cancellation if existing process infrastructure supports it;
- impose a reasonable timeout if current conventions require one.

If the platform writes an artifact instead, consume the documented artifact directly.

Do not alter sys-platform semantics in this mission.

---

# Schema version

Accept only the supported contract version:

    verification.v0.1

If version differs:

    explicit unsupported-version error

Do not guess compatibility.

Do not silently coerce unknown versions.

If additive unknown JSON fields are present:

    ignore safely if the decoder architecture allows it

but required known fields must be validated.

---

# Contract mapping

Map the wire contract into the existing sys-editor UI model.

At minimum preserve:

    project ID
    stable rule IDs
    stable obligation IDs
    aggregate disposition
    obligation dispositions
    governed semantic object
    recovered semantic object
    reason codes
    evidence
    provenance
    completeness
    source anchors
    spec anchors

Do NOT map based on human-readable title text.

Do NOT special-case B1/B2/B3/B8 names.

---

# Semantic object handling

The provider should preserve structured semantic data.

Examples:

    DISTINCT_BY
    EXISTS_DUPLICATE_BY
    STATE_MUTATION

The editor may have deterministic formatters for known semantic kinds.

If an unknown semantic kind appears:

- keep the object structured;
- render a bounded unsupported/unknown semantic view;
- optionally expose debug JSON;
- do NOT infer its meaning.

Unknown semantic kind must not crash the entire project view.

---

# Disposition mapping

Use structured enum mapping only.

Expected live values include:

    SYNCED
    DRIFTED
    CONFLICTED
    PARTIAL
    NOT_OBSERVED
    UNSUPPORTED

Reason codes may include:

    WRONG_OPERATION_SCOPE

Do not convert reason codes into verdicts unless the existing UI contract intentionally separates them.

Example:

    disposition = NOT_OBSERVED
    reason = WRONG_OPERATION_SCOPE

must remain exactly that.

---

# Fixture policy

Fixture provider remains available for:

- tests;
- explicit demo/development mode;
- offline UI development.

It must NOT silently activate when live provider fails.

Required runtime behavior:

    live requested
    + live transport fails
    -> visible error state

NOT:

    live fails
    -> fixture appears as if live

If the product has an explicit developer toggle:

    Data source: Live | Fixture

that is acceptable.

The current default for the Cinema Booking integration target should become Live when configuration is available.

---

# Required live acceptance dataset

Using the real Cinema Booking project, verify the UI renders these values from the live contract.

## B1

    aggregate = SYNCED

## B3

    aggregate = SYNCED

## B2

    aggregate = SYNCED

Governed:

    DistinctBy(requestedSeats, Seat.id)

Recovered:

    ExistsDuplicateBy(requestedSeats, Seat.id)

Evidence includes:

    i ∈ [0, |requestedSeats|)
    j ∈ [i+1, |requestedSeats|)
    requestedSeats[i].id == requestedSeats[j].id
    Return(true)

The UI must render these from structured fields.

## State/effect

    aggregate = SYNCED

Governed meaning:

    booking.status becomes BookingStatus.CONFIRMED

Recovered meaning:

    booking.status = BookingStatus.CONFIRMED

## B8

    aggregate = CONFLICTED

Obligations:

    guard
      disposition = NOT_OBSERVED
      reason = WRONG_OPERATION_SCOPE

    effect
      disposition = SYNCED

The UI must not display B8 as green.

---

# Source/spec navigation

Wire anchors from the live contract.

For source anchors:

- file/path;
- symbol if present;
- range if present.

For spec anchors:

- document/path;
- rule ID;
- range if present.

Use existing navigation services.

If range is unavailable:

    open the file/document without inventing a range.

If an anchor cannot be resolved:

    show a bounded navigation error.

Do not synthesize paths from rule names.

---

# Refresh behavior

The workbench should support refreshing live verification data.

Requirements:

- rerun/reload the live contract;
- preserve selected rule when stable ID still exists;
- preserve selected obligation when stable ID still exists;
- gracefully clear selection if the object disappeared;
- avoid duplicate simultaneous runs if existing architecture has a single-flight convention.

Do not use title matching for selection persistence.

---

# Runtime error UX

Handle at least:

1. executable not found;
2. manifest not found;
3. non-zero platform exit;
4. invalid JSON;
5. unsupported schema version;
6. malformed required fields;
7. timeout/cancellation;
8. missing anchor;
9. empty rule set.

Errors must be visible and distinguishable from semantic dispositions.

Example:

    PLATFORM_EXECUTION_ERROR

is not:

    CONFLICTED

Do not mix infrastructure failure with semantic verification state.

---

# Soundness UX invariants

The existing soundness rules remain mandatory:

1. PARTIAL != SYNCED
2. NOT_OBSERVED != disproven
3. UNSUPPORTED != CONFLICTED
4. green sub-obligation != green aggregate
5. SPECIFIED != DERIVED
6. missing evidence is explicit
7. unknown semantic kind is explicit
8. transport error is not a semantic verdict
9. reason codes are not inferred from prose
10. live vs fixture data source is visible in development/debug context when ambiguity is possible

---

# TDD requirements

Add or update tests for at least:

1. verification.v0.1 deserialization;
2. unsupported schema version;
3. B1 live mapping;
4. B3 live mapping;
5. B2 DISTINCT_BY mapping;
6. B2 EXISTS_DUPLICATE_BY mapping;
7. B2 witness evidence mapping;
8. state/effect mapping;
9. B8 aggregate CONFLICTED mapping;
10. B8 guard NOT_OBSERVED + WRONG_OPERATION_SCOPE;
11. B8 effect SYNCED;
12. stable rule ID preservation;
13. stable obligation ID preservation;
14. source anchor mapping;
15. spec anchor mapping;
16. unknown semantic kind handling;
17. invalid JSON failure;
18. non-zero process exit failure;
19. live provider does not fall back silently to fixture;
20. refresh preserves selected rule by stable ID;
21. refresh preserves selected obligation by stable ID;
22. transport error does not become semantic disposition;
23. provider contains no Booking-specific branch;
24. provider contains no semantic inference from text.

Use injected/mock process transport where appropriate.

Do not require the entire platform binary for every unit test.

Also add one integration probe that consumes real verification.v0.1 output.

---

# Real product E2E probe

Run:

    real Cinema Booking project
      ↓
    sys-platform verification.v0.1
      ↓
    LivePlatformVerificationProvider
      ↓
    Semantic Verification Workbench

Verify structurally that UI-facing data contains:

    B1 SYNCED
    B3 SYNCED
    B2 SYNCED
    state/effect SYNCED
    B8 CONFLICTED
      guard NOT_OBSERVED / WRONG_OPERATION_SCOPE
      effect SYNCED

If GUI automation is practical in the repository, exercise the view.

If GUI automation is not practical, prove:

- live provider output equals the existing UI contract;
- workbench tests render that contract correctly;
- one manual/demo launch path is documented.

Do not claim visual E2E automation if only provider-level integration was tested.

---

# Do not reopen backend semantic scope

Do NOT:

- implement B4-B10;
- change B2 proof semantics;
- add time semantics;
- add occupancy semantics;
- redesign verification.v0.1;
- change comparator logic merely for editor convenience;
- move semantic formatting rules into platform transport;
- add AI explanation;
- add auto-fix;
- add approval workflows.

If contract data is missing, report the exact missing field instead of recomputing it in editor.

---

# Autonomous implementation loop

You are authorized to:

    inspect sys-editor integration infrastructure
      -> implement live transport adapter
      -> implement verification.v0.1 decoder
      -> wire LivePlatformVerificationProvider
      -> connect to existing workbench
      -> add error states
      -> add refresh behavior
      -> run unit/integration tests
      -> run live Cinema Booking probe

Do not ask for approval between small implementation steps.

Maximum 5 substantial fixes before reporting a structural blocker.

---

# Success condition

Call success only if:

1. LivePlatformVerificationProvider consumes real verification.v0.1 output;
2. no prose parsing is used;
3. no editor-side semantic inference is used;
4. fixture is not silently substituted for live data;
5. existing workbench renders live B1/B3/B2/state-effect/B8 correctly;
6. B8 aggregate/obligation distinction remains sound;
7. evidence/reasons/provenance/completeness survive mapping;
8. source/spec anchors survive mapping;
9. refresh uses stable IDs;
10. transport errors remain separate from semantic verdicts;
11. tests pass;
12. one real Cinema Booking live integration probe passes.

On success report:

    LIVE_VERIFICATION_WORKBENCH_V0_1_PROVEN
    PRODUCT_VERIFICATION_E2E_PROVEN = YES

---

# Stop conditions

## SUCCESS

    LIVE_VERIFICATION_WORKBENCH_V0_1_PROVEN

## EXECUTION_BOUNDARY_GAP

If sys-editor cannot safely invoke/read the platform output without a larger runtime boundary:

    LIVE_VERIFICATION_EXECUTION_BOUNDARY_GAP

## CONTRACT_MAPPING_GAP

If verification.v0.1 lacks a field required by the existing workbench and editor-side inference would otherwise be required:

    LIVE_VERIFICATION_CONTRACT_MAPPING_GAP

List exact missing fields.

## NAVIGATION_GAP

If live semantic rendering succeeds but source/spec navigation requires a larger editor infrastructure change:

    LIVE_VERIFICATION_NAVIGATION_GAP

Do not block semantic live rendering if navigation can remain a clearly reported secondary gap.

## STOP_UNSOUND_UI

If implementation would require:

- parsing prose;
- inferring verdicts;
- deriving semantic objects from text;
- silent fixture fallback;
- Booking-specific provider logic;

stop.

---

# Required final report

WORKBENCH_RESULT:
LIVE_VERIFICATION_WORKBENCH_V0_1_PROVEN |
LIVE_VERIFICATION_EXECUTION_BOUNDARY_GAP |
LIVE_VERIFICATION_CONTRACT_MAPPING_GAP |
LIVE_VERIFICATION_NAVIGATION_GAP |
STOP_UNSOUND_UI |
CHECKPOINT_REACHED

DATA_SOURCE:
LIVE | FIXTURE | MIXED

PLATFORM_ENTRYPOINT:
...

PROCESS_OR_IPC_BOUNDARY:
...

CONTRACT_VERSION:
...

WIRE_DECODER:
...

PROVIDER:
...

UI_CONTRACT_MAPPING:
...

B1_LIVE:
...

B3_LIVE:
...

B2_LIVE:
...

STATE_EFFECT_LIVE:
...

B8_LIVE:
...

EVIDENCE_LIVE:
...

REASONS_LIVE:
...

PROVENANCE_LIVE:
...

COMPLETENESS_LIVE:
...

SOURCE_NAVIGATION:
...

SPEC_NAVIGATION:
...

REFRESH_BEHAVIOR:
...

ERROR_HANDLING:
...

FIXTURE_FALLBACK_BEHAVIOR:
...

TESTS:
...

REAL_CINEMA_BOOKING_PROBE:
...

DOMAIN_SPECIFIC_PROVIDER_LOGIC:
0 | explain

UI_SEMANTIC_INFERENCE:
0 | explain

PROSE_PARSING:
0 | explain

PRODUCT_VERIFICATION_E2E_PROVEN:
YES | NO

NEXT_PRODUCT_GAP:
...

NEXT_RECOMMENDED_STEP:
...

Stop after the live Semantic Verification Workbench is genuinely proven or a stop condition is reached.
