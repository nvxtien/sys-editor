# Mission: Platform Observed Source Span v0.1

## Why this mission exists

`PLATFORM_ANCHOR_RANGE_V0_1` stopped at `RANGE_SOURCE_GAP`. Findings, verified in code:

- source/spec anchors in `verification.v0.1` are **authored input** in the manifest. `contract.rs` (`InputRule.source_anchor`,
  `InputRule.spec_anchor`) only forwards them. The platform observes nothing about them;
- source recovery is `reverse.Main` (Java) -> program IR JSON -> `semantic-core` -> `ontology-core` -> `spec-code-sync`
  (`spec-code-sync/src/pipeline.rs`);
- `JavaFrontend` already parses with javac (`JavacTask`, `CompilationUnitTree`, `Trees`), so exact method positions exist there;
- they are dropped: `SourcePositions` / `LineMap` are never used and `ProgramIr.Function(name, parameters, body)` has no
  position field. A search of `sys-platform` for `startLine`, `span`, `lineNumber` finds nothing;
- `Function.name` is `BookingService.createBooking`, the same string as the manifest `target_operation` and anchor label;
- no downstream serde struct uses `deny_unknown_fields`, so an added IR field is ignored by older readers.

Goal of the parent mission, unchanged:

    Anchor range = observed source location, not an authored or inferred one.

This mission makes the platform observe and carry the source span. The editor consuming it is a separate step
(see "Follow-up").

## Mission

Make the Java frontend record the source span of each function declaration, carry it to `spec-code-sync`, and emit it
as the `range` of the matching SOURCE anchor in `verification.v0.1`, only when it was observed.

It must NOT change verdicts, dispositions, comparator semantics, semantic recovery, proof rules, or B-rule intent.
It must NOT let the manifest author a range.

## Design

Preferred path (smallest that stays honest): the span rides the program IR only.

    JavaFrontend: trees.getSourcePositions() + unit.getLineMap()
      -> ProgramIr.Function gains `span` (additive, optional)
      -> JsonRenderer emits it
      -> spec-code-sync pipeline.rs already holds the program IR string; it reads functions[].span for the
         target operation and keeps it beside the recovered result
      -> contract.rs fills the SOURCE anchor `range` from that span

`semantic-core` and `ontology-core` do not need to change, since they ignore unknown fields. Do not thread the span
through them unless that turns out to be false; if it is false, record why.

Rules:

1. A span is emitted only when javac reported valid positions (`Diagnostic.NOPOS` means absent). Otherwise omit it.
2. Span means the method declaration, from the start of the modifiers or return type to the end of the signature/body
   (decide and record which: declaration name range vs whole method). For navigation, prefer the range of the
   method **name** identifier; record the choice and why.
3. Match a span to an anchor by the function identity the platform already has (`target_operation` /
   `Function.name`), never by searching text or comparing labels loosely. If more than one function matches
   (overloads), emit no range and record it.
4. The manifest may still carry `symbol`/`file`. The platform ignores any `range` the manifest supplies and
   overwrites it with the observed span, or drops it if none was observed. Record this decision.
5. Range shape (additive, structured; 1-based line and column):

       "range": { "startLine": 29, "startColumn": 19, "endLine": 29, "endColumn": 32 }

   `Anchor.range` is currently `Option<String>`. Choose either a new structured field or a structured replacement,
   keep old readers working, and record the compatibility reasoning. The editor decoder currently reads `range` as an
   optional string, so a bare object would make it reject the contract today. Verify the decoder behavior before
   choosing, and do not break the editor.
6. No Java-specific or rule-specific logic in `spec-code-sync` beyond reading a generic `span` from the IR.
7. Spec anchors: only add a spec range if the spec parser already retains positions. If it does not, leave spec
   anchors unchanged and report it. Do not widen scope to build one.

## Work

### sys-platform

1. Add the span to `ProgramIr.Function` and `JsonRenderer`; populate it in `JavaFrontend.lowerFunction`.
2. In `pipeline.rs`, keep the target function span from the program IR; pass it to the contract builder.
3. In `contract.rs`, set the SOURCE anchor range from the observed span. Ignore any manifest-authored range.
4. Tests:
   - frontend: a fixture with a known method declaration yields the expected line and columns;
   - overloads: two functions with the same name yield no range;
   - contract: anchor with observed span, anchor without, manifest-authored range ignored, serialization unchanged
     when absent;
   - existing suites still pass, including the golden verification output where it applies.
5. Commit only intended platform changes. Do not include `.DS_Store`.

### sys-editor (only what is needed to keep it working)

1. Confirm the current decoder does not reject the new `range` shape; if it would, make the minimal decoder change
   so an object range is accepted and, for now, ignored by navigation.
2. Refresh the golden `verification-v0.1.cinema.json` only from real platform output. Do not hand-edit it.

## Verification

Automated (exact commands and counts):

- sys-platform: new tests, existing suite;
- sys-editor: all verification node tests, Rust UTF-8 tests, targeted `tsc` and eslint for changed files;
- real-binary probe: `spec-code-sync verification-v0.1 <manifest>` exits 0, and the B2 SOURCE anchor now carries a
  range that points at `createBooking` in `BookingService.java`.

Independent check of the observed span: read the actual line/column from the file and confirm the emitted range
covers `createBooking`. Report the file line and the emitted range side by side. Do not rely on the emitted value alone.

Regression: verdicts for B1, B2, B3, B8 and STATE_EFFECT are identical before and after, including B8 CONFLICTED.

## Follow-up (separate mission)

Editor consumption in `_openAnchor`: select and reveal the range with no language server, with the acceptance
scenario from `PLATFORM_ANCHOR_RANGE_V0_1` (Java extension absent, language mode `Plain Text`). Not part of this mission.

## Out of scope

- editor navigation changes beyond keeping the decoder working;
- `WRONG_OPERATION_SCOPE` rendering, B1 desktop inspection;
- adding `pom.xml` or any project file to the fixture;
- building span support for spec files;
- any change to a rule verdict.

## Safety invariants (must still hold)

    RANGE_FROM_MANIFEST = 0
    RANGE_FROM_TEXT_SEARCH = 0
    RANGE_FROM_SYMBOL_NAME_GUESS = 0
    VERDICT_CHANGES = 0
    DOMAIN_SPECIFIC_PROVIDER_LOGIC = 0

## Stop conditions

- `IR_SPAN_UNAVAILABLE`: javac cannot give a position for the target declaration. Report what it returns.
- `IDENTITY_MISMATCH`: the function in the IR cannot be tied to the manifest target operation without guessing.
- `CONTRACT_BREAK`: the change alters existing `verification.v0.1` fields or their meaning, or breaks the editor decoder.
- `STOP_UNSOUND`: success would require fabricating a range or letting the manifest supply one.

## Required final report

MISSION_RESULT: SUCCESS | IR_SPAN_UNAVAILABLE | IDENTITY_MISMATCH | CONTRACT_BREAK | STOP_UNSOUND

SYS_PLATFORM_COMMIT / SYS_EDITOR_COMMIT:
...

SPAN_SHAPE_DECISION: name range vs whole method, structured vs string, and why

MANIFEST_RANGE_POLICY: ignored / dropped, and why

EMITTED_RANGE (real output) vs FILE_LINE (read from the file):
...

STAGES_CHANGED: which of frontend / IR / semantic-core / ontology-core / spec-code-sync / contract

OVERLOAD_BEHAVIOR:
...

VERDICT_REGRESSION: identical | explain

AUTOMATED_TESTS: commands and counts

EDITOR_DECODER: unchanged | minimal change, and why

SEMANTIC_CHANGES_REQUIRED: 0 | explain

NEXT_PRODUCT_GAP:
...

Stop after the observed span is genuinely emitted and independently checked, or a stop condition is reached.
