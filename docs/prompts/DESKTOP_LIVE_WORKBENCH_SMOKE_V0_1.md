# Mission: Desktop Live Workbench Smoke v0.1

## Current state

The semantic backend is proven.

Representative semantic breadth is proven through live production paths:

- B1 -> precondition / collection -> SYNCED
- standalone state/effect -> SYNCED
- B2 -> relational / quantified -> SYNCED

The structured contract is proven:

    verification.v0.1

The contract includes:

- aggregate dispositions;
- obligation dispositions;
- structured governed semantics;
- structured recovered semantics;
- provenance;
- completeness;
- structured witness evidence;
- structured relational proof objects;
- source/spec anchors where available.

The live sys-editor provider path is implemented and proven at provider/decoder/formatter level.

B2 live explanation rendering is proven at provider/decoder/formatter level:

    Governed:
      DistinctBy(requested.seats, by=[id])

    Recovered:
      ExistsDuplicateBy(requestedSeats, by=[id])

    Witness:
      i ∈ [0, |requestedSeats|)
      j ∈ [i + 1, |requestedSeats|)
      requestedSeats[i].id == requestedSeats[j].id
      Return(true)
      provenance = DERIVED
      completeness = EXACT

    Proof:
      RELATIONAL_EQUIVALENCE
      VIOLATION_EQUIVALENCE
      result = PROVEN

      obligations:
        SAME_COLLECTION
        SAME_PROJECTION
        PAIRWISE_DOMAIN
        EQUALITY_PREDICATE
        CORRECT_POLARITY
        COMPATIBLE_FAILURE_EFFECT

The editor now also has deterministic formatters for:

    DISTINCT_BY
    EXISTS_DUPLICATE_BY
    STATE_MUTATION
    COLLECTION_EMPTINESS
    OR
    AND
    COMPARE
    FAILURE
    EFFECTS
    ATOM
    UNKNOWN
    witness structures
    relational proof structures

UTF-8 stdout chunk handling was fixed at the Rust Tauri process boundary and tested across split multi-byte sequences.

Safety invariants currently hold:

    DOMAIN_SPECIFIC_PROVIDER_LOGIC = 0
    DOMAIN_SPECIFIC_FORMATTER_LOGIC = 0
    UI_SEMANTIC_INFERENCE = 0
    PROSE_PARSING = 0
    SILENT_FIXTURE_FALLBACK = 0

The remaining unproven gap is real desktop runtime interaction.

## Mission

Run and verify the real desktop sys-editor with the real sys-platform binary and the real Cinema Booking manifest.

This mission is a smoke / product integration proof.

It must NOT add semantic capabilities.

It must NOT redesign the UI.

It must NOT weaken soundness to make the smoke pass.

Target end-to-end path:

    real user launches sys-editor desktop
      -> Verification view
      -> LivePlatformVerificationProvider
      -> Tauri task_spawn
      -> real spec-code-sync binary
      -> real verification.v0.1 JSON
      -> decoder / mapper
      -> existing VerificationProject model
      -> real rendered Verification Workbench
      -> user can inspect B2 / B8 / refresh / navigation / errors

On success:

    PRODUCT_VERIFICATION_E2E_PROVEN = YES

Do not ask for approval between small fixes.

---

# Precondition: reproducible checkpoints

Before smoke testing, verify both repositories are on reproducible states.

## sys-platform

The verification contract and proof-evidence changes must be committed.

Required changed implementation areas previously included:

    spec-code-sync/src/contract.rs
    spec-code-sync/src/main.rs
    spec-code-sync/src/comparator.rs

Do not include unrelated .DS_Store files.

Record the exact sys-platform commit SHA used for the smoke.

## sys-editor

The live provider, decoder, formatter, workbench, and UTF-8 transport changes must be committed.

Record the exact sys-editor commit SHA used for the smoke.

If either repository is dirty with unrelated changes:

- identify them;
- do not silently include them;
- proceed only if the smoke target itself is reproducible.

---

# Runtime configuration

Use live data.

Required settings:

    sys.verification.dataSource = live
    sys.verification.platformBinary = <real spec-code-sync binary>
    sys.verification.manifestPath = examples/cinema-booking-verification/manifest.json

Use the actual repository-supported settings mechanism.

Do not hard-code local absolute paths into production source.

For the smoke report, record the resolved paths used.

Fixture mode must remain disabled for the primary smoke.

---

# Build the real platform binary

Build or locate the real spec-code-sync executable from the committed sys-platform state.

Use normal repository build instructions.

Verify:

    <binary> verification-v0.1 <manifest>

returns valid verification.v0.1 JSON and exit code 0 before launching desktop.

Do not substitute mocked output.

---

# Launch the real desktop application

Launch the actual Tauri desktop application.

Do not count:

- unit tests;
- provider tests;
- browser-only component tests;
- static rendering;
- fixture mode

as desktop smoke success.

The Tauri process boundary must participate.

Record:

- launch command;
- OS/runtime environment;
- sys-editor commit;
- sys-platform commit;
- platform binary path;
- manifest path.

---

# Primary desktop acceptance scenario

Perform this exact user flow in the desktop application.

## 1. Open Verification view

Confirm:

- view loads;
- data source is LIVE;
- no fixture indicator is shown as the active source;
- no infrastructure error appears.

## 2. Rule list

Confirm real live rules appear.

At minimum:

    B1
    B2
    state/effect rule
    B8

If B3 is present, render it normally but do not count it as independent semantic breadth.

## 3. B2 governed semantics

Select B2.

Open Governed view.

Verify the UI shows the structured governed relation equivalent to:

    DistinctBy(requested.seats, by=[id])

No raw-only unsupported fallback for this known kind.

## 4. B2 recovered semantics

Open Recovered view.

Verify:

    ExistsDuplicateBy(requestedSeats, by=[id])

is rendered from live data.

## 5. B2 witness evidence

Inspect rule evidence.

Verify visible live structured witness:

    i ∈ [0, |requestedSeats|)
    j ∈ [i + 1, |requestedSeats|)
    requestedSeats[i].id == requestedSeats[j].id
    Return(true)

Also confirm:

    provenance = DERIVED
    completeness = EXACT

If the exact typography differs, semantic structure must still be visible.

## 6. B2 verification proof

Open Verification tab.

Verify visible:

    RELATIONAL_EQUIVALENCE
    VIOLATION_EQUIVALENCE
    PROVEN

and the six proof obligations:

    SAME_COLLECTION
    SAME_PROJECTION
    PAIRWISE_DOMAIN
    EQUALITY_PREDICATE
    CORRECT_POLARITY
    COMPATIBLE_FAILURE_EFFECT

The UI must NOT render the governed and recovered predicates as direct equality.

It must preserve violation polarity.

## 7. B8 mixed outcome

Select B8.

Verify the aggregate verdict is:

    CONFLICTED

Verify the guard obligation reflects live data.

For the current canonical pilot manifest, expected live state has previously been observed as:

    guard = NOT_OBSERVED
    reason = WRONG_OPERATION_SCOPE

The effect obligation must be whatever the live contract returns for the exact committed manifest.

Do not hard-code SYNCED or NOT_OBSERVED.

Record the observed effect disposition.

The aggregate must never appear green merely because one child obligation is green.

## 8. Refresh

With a rule selected, click Refresh.

Verify:

- real platform invocation occurs again;
- UI reloads live data;
- selected rule remains selected if stable ID still exists;
- selected obligation remains selected if stable ID still exists;
- no duplicate concurrent run occurs;
- no fixture fallback occurs.

If possible, observe/log the process invocation count.

## 9. Source navigation

Use at least one live source anchor.

Verify:

- source file opens;
- symbol/range is honored if available;
- file-only open is used when range is unavailable;
- no path is guessed from rule title.

Record the anchor used.

## 10. Spec navigation

Use at least one live spec anchor.

Verify:

- spec file opens;
- rule anchor/range is used if available;
- opaque/unavailable range is not guessed.

Record the anchor used.

---

# Infrastructure-error acceptance scenario

Prove infrastructure failures remain separate from semantic verdicts.

Use ONE safe negative test.

Preferred:

    temporarily set manifest path to a known nonexistent file

or:

    temporarily set platform binary path to a known nonexistent file

Then refresh.

Verify the UI shows the appropriate infrastructure error, such as:

    MANIFEST_NOT_FOUND

or:

    EXECUTABLE_NOT_FOUND

and does NOT display:

    CONFLICTED
    PARTIAL
    NOT_OBSERVED
    UNSUPPORTED

for that runtime failure.

Restore valid configuration and verify the workbench recovers.

Do not use fixture fallback.

---

# UTF-8 runtime observation

The UTF-8 chunk fix is already unit-tested in Rust.

For desktop smoke, ensure the real live JSON containing non-ASCII symbols renders correctly if such data appears.

If the current manifest does not naturally emit multi-byte text, do not alter semantic data merely for this check.

The Rust test remains the primary UTF-8 proof.

Desktop smoke should at least show no encoding corruption in normal live use.

---

# Unsupported / unknown rendering

If the live contract contains an unknown semantic/evidence/proof kind:

- UI must remain usable;
- bounded raw JSON/debug detail is acceptable;
- no crash;
- no guessed semantics.

Do not create new semantic formatters in this smoke mission unless a trivial omission blocks rendering of a kind already intentionally supported.

If a materially new formatter is required, stop and report the gap rather than broadening scope.

---

# Runtime soundness gates

During the smoke, verify these remain true:

    DATA_SOURCE = LIVE
    SILENT_FIXTURE_FALLBACK = 0
    UI_SEMANTIC_INFERENCE = 0
    PROSE_PARSING = 0
    DOMAIN_SPECIFIC_PROVIDER_LOGIC = 0
    DOMAIN_SPECIFIC_FORMATTER_LOGIC = 0

Do not infer these solely from visual appearance.

Use the existing implementation/tests plus runtime observations.

---

# No semantic changes

This mission must not modify:

- sys-platform comparator semantics;
- semantic recovery;
- B2 proof rules;
- governed ontology;
- B8 intent;
- verification dispositions;
- verification.v0.1 meaning.

Allowed changes are only bounded runtime integration fixes required to make already-supported behavior work on desktop.

Examples of acceptable fixes:

- Tauri path/config wiring bug;
- desktop registration omission;
- view activation bug;
- process lifecycle bug;
- anchor-opening bug;
- refresh-state bug;
- display wiring bug.

If a fix changes semantic meaning:

    STOP_UNSOUND_SMOKE

---

# TDD / regression requirements

Before final success report, run the existing automated verification suite.

At minimum:

- all verification node tests;
- Rust UTF-8 transport tests;
- targeted TypeScript checks for verification files;
- targeted eslint for verification files;
- real-binary provider probe.

If repository-wide test/build is practical, run it.

Report exact commands and counts.

Do not claim clean full-project TypeScript if unrelated existing errors prevent it.

---

# Manual desktop evidence

Because this is a desktop smoke mission, automated provider tests are insufficient.

Record concrete evidence for the manual desktop run.

At minimum report:

1. desktop app launched successfully;
2. Verification view opened;
3. live data source shown;
4. B2 selected;
5. Governed view observed;
6. Recovered view observed;
7. Witness evidence observed;
8. Verification proof observed;
9. B8 aggregate/obligations observed;
10. Refresh executed successfully;
11. source anchor navigation executed;
12. spec anchor navigation executed;
13. negative infrastructure-error test executed;
14. valid configuration restored.

Screenshots are optional unless repository workflow already supports them.

Do not fabricate manual observations.

---

# Product E2E definition

Only set:

    PRODUCT_VERIFICATION_E2E_PROVEN = YES

if the following actual runtime chain was exercised:

    desktop sys-editor
      -> live provider
      -> Tauri transport
      -> real spec-code-sync
      -> real manifest
      -> verification.v0.1
      -> decoder
      -> UI model
      -> rendered workbench
      -> user interaction

Provider-level E2E alone is insufficient.

Unit tests alone are insufficient.

A browser mock is insufficient.

---

# Success condition

Call success only if:

1. actual Tauri desktop application launches;
2. Verification view uses LIVE source;
3. real platform binary executes through Tauri;
4. real verification.v0.1 is rendered;
5. B2 governed/recovered/witness/proof are visibly correct;
6. B8 aggregate + obligation state is visibly correct for the exact manifest;
7. refresh executes live again and preserves stable selection;
8. source navigation works or returns an honest bounded navigation error if the contract anchor itself is unavailable;
9. spec navigation works or returns an honest bounded navigation error if the contract anchor itself is unavailable;
10. one infrastructure-failure scenario is visibly distinct from semantic verdicts;
11. no fixture fallback occurs;
12. automated regression tests remain green;
13. no semantic change was required.

On success report:

    DESKTOP_LIVE_WORKBENCH_SMOKE_V0_1_PROVEN
    PRODUCT_VERIFICATION_E2E_PROVEN = YES

---

# Stop conditions

## SUCCESS

    DESKTOP_LIVE_WORKBENCH_SMOKE_V0_1_PROVEN

## DESKTOP_LAUNCH_GAP

If the actual Tauri app cannot launch due to environment/build/runtime issues unrelated to semantic logic:

    DESKTOP_LIVE_WORKBENCH_LAUNCH_GAP

Report exact failure.

## TAURI_TRANSPORT_GAP

If desktop launches but real platform invocation cannot flow through Tauri:

    DESKTOP_LIVE_TAURI_TRANSPORT_GAP

## VIEW_WIRING_GAP

If live provider succeeds but the desktop Verification view does not consume/render it:

    DESKTOP_LIVE_VIEW_WIRING_GAP

## NAVIGATION_GAP

If everything else works but source/spec navigation has a bounded editor integration issue:

    DESKTOP_LIVE_NAVIGATION_GAP

Do not downgrade the semantic live path if only navigation is missing.

## STOP_UNSOUND_SMOKE

Stop if success would require:

- fixture substitution;
- semantic inference;
- prose parsing;
- changing platform verdicts;
- changing spec intent;
- hard-coding B-rule outcomes;
- bypassing Tauri with a fake direct provider path.

---

# Required final report

SMOKE_RESULT:
DESKTOP_LIVE_WORKBENCH_SMOKE_V0_1_PROVEN |
DESKTOP_LIVE_WORKBENCH_LAUNCH_GAP |
DESKTOP_LIVE_TAURI_TRANSPORT_GAP |
DESKTOP_LIVE_VIEW_WIRING_GAP |
DESKTOP_LIVE_NAVIGATION_GAP |
STOP_UNSOUND_SMOKE |
CHECKPOINT_REACHED

SYS_EDITOR_COMMIT:
...

SYS_PLATFORM_COMMIT:
...

OS_RUNTIME:
...

LAUNCH_COMMAND:
...

DATA_SOURCE:
LIVE | explain

PLATFORM_BINARY:
...

MANIFEST:
...

CONTRACT_VERSION:
...

TAURI_TRANSPORT:
...

VERIFICATION_VIEW:
...

B1_DESKTOP:
...

B2_GOVERNED_DESKTOP:
...

B2_RECOVERED_DESKTOP:
...

B2_WITNESS_DESKTOP:
...

B2_PROOF_DESKTOP:
...

B2_PROOF_OBLIGATIONS_DESKTOP:
...

B8_DESKTOP:
...

B8_EFFECT_OBSERVED:
...

REFRESH_DESKTOP:
...

SOURCE_NAVIGATION_DESKTOP:
...

SPEC_NAVIGATION_DESKTOP:
...

INFRASTRUCTURE_ERROR_TEST:
...

UTF8_RUNTIME_OBSERVATION:
...

FIXTURE_FALLBACK:
0 | explain

UI_SEMANTIC_INFERENCE:
0 | explain

PROSE_PARSING:
0 | explain

DOMAIN_SPECIFIC_PROVIDER_LOGIC:
0 | explain

DOMAIN_SPECIFIC_FORMATTER_LOGIC:
0 | explain

AUTOMATED_TESTS:
...

MANUAL_DESKTOP_EVIDENCE:
...

SEMANTIC_CHANGES_REQUIRED:
0 | explain

PRODUCT_VERIFICATION_E2E_PROVEN:
YES | NO

NEXT_PRODUCT_GAP:
...

NEXT_RECOMMENDED_STEP:
...

Stop after the real desktop live path is genuinely exercised or a stop condition is reached.
