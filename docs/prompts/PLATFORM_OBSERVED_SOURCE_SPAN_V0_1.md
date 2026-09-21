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

Scaling findings that shape this design:

- `contract::build` calls `recover_observed_project` once per rule, so N rules mean N full javac + `semantic-core` +
  `ontology-core` runs. `target_operation` is a **manifest-level** field, so every rule in a manifest shares the same
  recovery; the loop repeats identical work. Measured on the cinema manifest (5 rules, 9 Java files): one
  `verification-v0.1` call takes about 1.8 s (1.90 / 1.81 / 1.74), and one `reverse.ProjectMain` (javac) run takes about
  0.36 s, so javac repetition (5 x 0.36 s) accounts for almost all of it. The time of the other stages was not measured
  separately;
- the JSON repeats anchors: 62 anchor objects but only 6 distinct in a 46,663-byte output (about 10x duplication).
  Adding `span` and a digest to every copy multiplies that. Fixing it needs a reference table, which changes the
  contract shape; that is out of scope here (see Follow-up);
- every Refresh re-analyzes the whole project with no cache; cost grows with rules x project size, extrapolated only;
- `SourceFile` keeps only the file name, so matching by function name alone breaks for overloads, nested classes with
  the same name, and same-named classes in different packages;
- a span on `ProgramIr.Function` supports method-level anchors only. Statement-level anchors would need spans on every
  IR node and pass-through in `semantic-core` / `ontology-core`. That is a deliberate limit here, not an oversight;
- javac `LineMap.getColumnNumber` is believed to expand tab characters. This has not been verified in this repo.

Goal of the parent mission, unchanged:

    Anchor location = observed source location, not an authored or inferred one.

This mission makes the platform observe and carry the source span. The editor consuming it is a separate step
(see "Follow-up").

## Mission

Make the Java frontend record the source span of each function declaration, carry it to `spec-code-sync`, and emit it
as the `span` of the matching SOURCE anchor in `verification.v0.1` (the existing string `range` is left unchanged),
only when it was observed.

It must NOT change verdicts, dispositions, comparator semantics, semantic recovery, proof rules, or B-rule intent.
It must NOT let the manifest author a range or span.

## Design

Preferred path (smallest that stays honest): the span rides the program IR only.

    JavaFrontend: trees.getSourcePositions() + unit.getLineMap()
      -> ProgramIr.Function gains `span` (additive, optional)
      -> JsonRenderer emits it
      -> spec-code-sync pipeline.rs already holds the program IR string; it reads functions[].span for the
         target operation and keeps it beside the recovered result
      -> contract.rs fills the SOURCE anchor `span` from that data

`semantic-core` and `ontology-core` do not need to change, since they ignore unknown fields. Do not thread the span
through them unless that turns out to be false; if it is false, record why.

Scale requirements:

- **Recover once per manifest.** `target_operation` is manifest-level, so run the recovery (javac -> `semantic-core`
  -> `ontology-core`) once in `contract::build`, before the rule loop, and reuse the result and the observed span for
  every rule. Per-rule work that genuinely differs (spec compile and comparison) stays per rule. Do not add a second
  javac run to fetch the span.
  Measurable target: javac runs per `verification-v0.1` call = 1 (was 1 per rule). Report wall time before and after
  against the 1.8 s baseline above, the same manifest, three runs each. The recovered result and every verdict must be
  byte-identical to before, apart from the new `span` field.
- **Identity is more than the name.** The IR function must carry enough to identify it: the source file (full path
  relative to the project, not only the file name) and a signature (parameter types). Match an anchor by
  file + qualified name (+ signature when the manifest supplies it). Ambiguity means no range.
- **Store character offsets.** Record `startOffset` / `endOffset` (UTF-16 code units, as the editor counts) and derive
  line and column from the file content yourself. Do not use `LineMap.getColumnNumber` for columns. Add a test with a
  tab-indented method and a non-ASCII character before the declaration to prove columns match the editor's.
- **Staleness is explicit.** Include a content digest of the source file the span was computed from
  (for example `sha256`) so a consumer can tell that the file changed since the run. The editor's use of it is a
  follow-up; the platform must emit it now.
- **Method level only, on purpose.** Do not add spans to statements or expressions in this mission. Record in the
  report what would be required (per-node spans plus pass-through in the two Rust stages).

Rules:

1. A span is emitted only when javac reported valid positions (`Diagnostic.NOPOS` means absent). Otherwise omit it.
2. Emit the range of the method **name** identifier (the navigation target). If the whole-declaration range is also
   useful, add it as a separate field rather than overloading one. Record the choice and why.
3. Match a span to an anchor by file + qualified name (+ signature), never by searching text or comparing labels
   loosely. If more than one function matches (overloads, same-named classes), emit no span and record it.
4. The manifest may still carry `symbol`/`file`. The platform ignores any `range` or `span` the manifest supplies and
   replaces it with the observed span, or drops it if none was observed. Record this decision.
5. Range shape (additive, structured; 1-based line and column):

       "span": {
         "startLine": 29, "startColumn": 19, "endLine": 29, "endColumn": 32,
         "startOffset": 812, "endOffset": 825,
         "sourceDigest": "sha256:..."
       }

   `Anchor.range` is `Option<String>` and the editor decoder reads it with `optStr`, which rejects a non-string.
   Therefore keep `range` unchanged and unused, and add the structured data under the new anchor field `span`.
   Decoders that read only known fields ignore it. Confirm with a test that the current editor decoder still accepts a
   contract containing `span`.
6. No Java-specific or rule-specific logic in `spec-code-sync` beyond reading a generic `span` from the IR.
7. Spec anchors: only add a spec range if the spec parser already retains positions. If it does not, leave spec
   anchors unchanged and report it. Do not widen scope to build one.

## Work

### sys-platform

1. Add file, signature and span (offsets, plus derived line/column, plus source digest) to `ProgramIr.Function` and
   `JsonRenderer`; populate them in `JavaFrontend.lowerFunction`. The frontend currently loses the full path
   (`SourceFile` keeps the name only); fix that for this data without changing recovered semantics.
2. In `pipeline.rs`, return the recovered result and the target function span from one run; reuse them across rules
   in `contract::build` (recover once per manifest).
3. In `contract.rs`, set the SOURCE anchor `span` from the observed data. Ignore any manifest-authored range or span.
4. Tests:
   - frontend: a fixture with a known method declaration yields the expected offsets, line and columns;
   - tab-indented method and a non-ASCII character before the declaration: columns match UTF-16 counting;
   - overloads and same-named classes in two packages: no span;
   - source digest changes when the file changes;
   - javac runs per `verification-v0.1` call: exactly 1 regardless of rule count;
   - contract: anchor with observed span, anchor without, manifest-authored range ignored, serialization unchanged
     when absent;
   - existing suites still pass, including the golden verification output where it applies.
5. Commit only intended platform changes. Do not include `.DS_Store`.

### sys-editor (only what is needed to keep it working)

1. Add a test that the current decoder accepts a contract whose anchors carry `span` and ignores it. Make no decoder
   change unless that test fails.
2. Refresh the golden `verification-v0.1.cinema.json` only from real platform output. Do not hand-edit it.

## Verification

Automated (exact commands and counts):

- sys-platform: new tests, existing suite;
- sys-editor: all verification node tests, Rust UTF-8 tests, targeted `tsc` and eslint for changed files;
- real-binary probe: `spec-code-sync verification-v0.1 <manifest>` exits 0, and the B2 SOURCE anchor now carries a
  `span` that points at `createBooking` in `BookingService.java`;
- wall time and javac run count for the manifest (5 rules) before and after the recover-once change, against the
  1.8 s baseline;
- the output with `span` removed is byte-identical to the pre-change output.

Independent check of the observed span: read the actual line/column and the character offsets from the file and
confirm the emitted span covers `createBooking`. Report the file line and the emitted span side by side. Do not rely on
the emitted value alone.

Regression: verdicts for B1, B2, B3, B8 and STATE_EFFECT are identical before and after, including B8 CONFLICTED.

## Follow-up (separate missions)

Known scale limits left open on purpose; record them under `NEXT_PRODUCT_GAP`, do not solve them here:

- anchor duplication in the JSON: a shared anchor table referenced by id is a `verification.v0.1` shape change and
  needs a contract version decision;
- no cache: whole-project re-analysis on every Refresh; a cache keyed by source digests is the natural next step and
  the `sourceDigest` emitted here is its input;
- the editor rebuilds the whole rule list DOM on each selection or filter change; only matters for very large rule sets.

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
    SPAN_ON_STATEMENTS = 0
    EXTRA_JAVAC_RUNS_FOR_SPAN = 0
    JAVAC_RUNS_PER_CALL = 1
    RANGE_FROM_TEXT_SEARCH = 0
    RANGE_FROM_SYMBOL_NAME_GUESS = 0
    VERDICT_CHANGES = 0
    DOMAIN_SPECIFIC_PROVIDER_LOGIC = 0

## Stop conditions

- `IR_SPAN_UNAVAILABLE`: javac cannot give a position for the target declaration. Report what it returns.
- `RECOVER_ONCE_BLOCKED`: recovering once per manifest cannot be done without changing recovered semantics. Report why;
  do not fall back to a second javac run for the span.
- `IDENTITY_MISMATCH`: the function in the IR cannot be tied to the manifest target operation without guessing.
- `CONTRACT_BREAK`: the change alters existing `verification.v0.1` fields or their meaning, or breaks the editor decoder.
- `STOP_UNSOUND`: success would require fabricating a range or letting the manifest supply one.

## Required final report

MISSION_RESULT: SUCCESS | IR_SPAN_UNAVAILABLE | RECOVER_ONCE_BLOCKED | IDENTITY_MISMATCH | CONTRACT_BREAK | STOP_UNSOUND

SYS_PLATFORM_COMMIT / SYS_EDITOR_COMMIT:
...

SPAN_SHAPE_DECISION: name range vs whole method, structured vs string, and why

MANIFEST_RANGE_POLICY: ignored / dropped, and why

EMITTED_RANGE (real output) vs FILE_LINE (read from the file):
...

STAGES_CHANGED: which of frontend / IR / semantic-core / ontology-core / spec-code-sync / contract

OVERLOAD_BEHAVIOR / SAME_NAME_BEHAVIOR:
...

JAVAC_RUNS_PER_CALL: before -> after (5 rules); WALL_TIME: before -> after (3 runs each, baseline 1.8 s)

COLUMN_UNITS_TEST: tab and non-ASCII result

STATEMENT_LEVEL_REQUIREMENTS: what per-node spans would need (not implemented)

VERDICT_REGRESSION: identical | explain

AUTOMATED_TESTS: commands and counts

EDITOR_DECODER: unchanged | minimal change, and why

SEMANTIC_CHANGES_REQUIRED: 0 | explain

NEXT_PRODUCT_GAP:
...

Stop after the observed span is genuinely emitted and independently checked, or a stop condition is reached.
