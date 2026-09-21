# Mission: Platform Observed Source Span v0.1

## Question this mission answers

    Can Sys carry a source location that it actually observed
    through the verification contract, without guessing?

Required answer: YES or NO, with evidence. One semantic claim, one falsifiable mission.

Invariant:

    Anchor location = observed source location, not an authored or inferred one.

    VerificationAnchor.span, when present, is always platform-observed.
    It can never originate from manifest input.

The span carries the semantics OBSERVED by itself. No separate provenance field is added in v0.1; this invariant is
the contract.

## Why this mission exists

`PLATFORM_ANCHOR_RANGE_V0_1` stopped at `RANGE_SOURCE_GAP`. Findings, verified in code:

- source/spec anchors in `verification.v0.1` are **authored input** in the manifest. `contract.rs`
  (`InputRule.source_anchor`, `InputRule.spec_anchor`) only forwards them; the platform observes nothing about them;
- source recovery is `reverse.Main` / `reverse.ProjectMain` (Java) -> program IR JSON -> `semantic-core` ->
  `ontology-core` -> `spec-code-sync` (`spec-code-sync/src/pipeline.rs`);
- `JavaFrontend` already parses with javac (`JavacTask`, `CompilationUnitTree`, `Trees`), so declaration positions
  exist there. They are dropped: `ProgramIr.Function(name, parameters, body)` has no location, and nothing in
  `sys-platform` mentions `startLine`, `span` or `lineNumber`;
- javac's public Tree API gives the **declaration** span (`SourcePositions.getStartPosition` / `getEndPosition` of the
  `MethodTree`). It has no clean API for the position of the method-name identifier. Getting one would need javac
  internals, a token scan, or text search, all of which this mission forbids;
- `Function.name` is `BookingService.createBooking`, the same string as the manifest `target_operation`;
- no downstream serde struct uses `deny_unknown_fields`, so an added IR field is ignored by older readers.

## Mission

Record the source span of each function declaration in the Java frontend, carry it through the program IR to
`spec-code-sync`, and emit it as the `span` of the matching SOURCE anchor in `verification.v0.1`, only when it was
observed and the match is unique.

It must NOT change verdicts, dispositions, comparator semantics, semantic recovery, proof rules, or B-rule intent.
It must NOT let the manifest supply a span. It must NOT change `semantic-core` or `ontology-core`.

Flow:

    Java source
      -> javac MethodTree
      -> SourcePositions (start/end of the declaration)
      -> ProgramIr.Function.location
      -> spec-code-sync (reads the location from the program IR of the same recovery run)
      -> VerificationAnchor.span

Do not change how many times recovery runs. Performance is a different claim (see Follow-up).

## Span semantics (locked)

    Offsets are UTF-16 code units.
    [startOffset, endOffset) is half-open.
    startLine / startColumn are 1-based.
    endLine / endColumn identify the EXCLUSIVE end position.
    The line/column values describe exactly the same half-open range as the offsets.
    A line break is \n, \r\n or a lone \r. A tab is one column. Columns count UTF-16 code units from the line start.

Shape (additive):

    "span": {
      "startOffset": 790, "endOffset": 1320,
      "startLine": 28, "startColumn": 5, "endLine": 47, "endColumn": 6,
      "sourceDigest": "sha256:..."
    }

- Primary observed span = the whole method declaration (`getStartPosition` to `getEndPosition` of the `MethodTree`).
  The editor's follow-up needs only: open file, reveal the range, place the cursor at `range.start`. The cursor need not
  sit on the method-name identifier.
- An optional `nameSpan` MAY be added later, only if the frontend gets it from compiler or token positions with no
  heuristic text search. It is not part of this mission and must not be attempted here.
- `sourceDigest` = SHA-256 of the exact bytes of the source file as read from disk (not of normalized or re-encoded
  text). Purpose: a consumer can tell that the file changed after the run.
- `NOPOS` (a negative position) means absent: emit no span.

Source text rule: line/column are computed from the **same `CharSequence` javac used** for that compilation unit, never
from a second read of the file. Decode the bytes once, hash those bytes, give the decoded text to javac, and compute
lines from that same text. Keep decoding strict so a malformed file fails the way it does today.

`range` (the existing optional string) is left unchanged and unused. The editor decoder reads it with `optStr`, which
rejects a non-string, so structured data must live under the new field `span`. Decoders that read only known fields
ignore `span`; confirm with a test that the current editor decoder still accepts a contract containing it.

## Identity and matching

Candidate selection, in order, all exact:

1. the file, compared after normalizing both the IR file and the anchor `file` to the same absolute path;
2. the qualified operation name (`BookingService.createBooking`);
3. the signature (parameter types), only when the authoritative target identity carries one.

    0 candidates -> span absent
    1 candidate  -> span emitted
    >1 candidates -> span absent (AMBIGUOUS)

Never pick the first candidate. Never resolve an overload by parameter count unless the contract says so. A SOURCE
anchor gets a span only if its `symbol` (when present) equals the method's simple name.

The manifest may still carry `file` and `symbol`. Any `range` or `span` the manifest supplies is ignored for the
new field; a span exists only when the platform observed it.

## Work

### sys-platform

1. `ProgramIr.Function` gains an optional location: file, source digest, span. Keep the existing 3-argument
   constructor so current code and tests compile. `JsonRenderer` prints it only when present.
2. `JavaFrontend`: record the declaration span from `SourcePositions` for each function, tie each compilation unit to
   its source text and file without a global mutable map, and compute line/column from that text.
3. `pipeline.rs`: return the target function's observed location together with the recovered result from the same run.
4. `contract.rs`: add `span` to `Anchor` (`skip_deserializing`, so the manifest cannot set it; omitted from JSON when
   absent). Set it on SOURCE anchors using the matching rule above.
5. Tests:
   - valid observed span on a fixture method;
   - negative position (NOPOS) -> no span;
   - overloaded methods -> no span;
   - same class name in two packages -> no span for an ambiguous match, correct span when unambiguous;
   - tab indentation before the declaration;
   - non-ASCII before the declaration, including a **surrogate pair** (for example `// 😀`) so a UTF-16 bug shows up
     (ASCII = 1 unit, `é` = 1, `漢` = 1, `😀` = 2);
   - `\r\n` and lone `\r` line breaks;
   - a file starting with a UTF-8 BOM: the editor's text model drops the BOM, so offsets would shift by one. Either the
     frontend fails as it does today or it emits no span; it must never emit a shifted span. Record which;
   - digest is over the file bytes and changes when the file changes;
   - a manifest-authored `range` or `span` cannot become the emitted span;
   - serialization unchanged when there is no span;
   - existing suites still pass.
6. Commit only intended platform changes. Do not include `.DS_Store`.

### sys-editor (only to keep it working)

1. Add a test that the current decoder accepts a contract whose anchors carry `span` and ignores it. Change the
   decoder only if that test fails.
2. Refresh `verification-v0.1.cinema.json` only from real platform output. Do not hand-edit it.

## Verification

Automated (exact commands and counts):

- sys-platform: `./scripts/test.sh` and the Rust tests in `spec-code-sync`, before and after;
- sys-editor: verification node tests, Rust UTF-8 tests, targeted `tsc` and eslint for changed files;
- the output of `spec-code-sync verification-v0.1 <manifest>` with every `span` removed is byte-identical to the output
  before the change (same manifest, deterministic).

Independent evidence, not just line numbers:

    actual BookingService.java bytes
      -> decode as the frontend did
      -> substring(source, startOffset, endOffset)
      -> contains the expected `createBooking` declaration (starts with its modifiers/return type, ends at its closing brace)

Report the emitted span and that substring side by side. Also confirm `sourceDigest` equals `shasum -a 256` of the file.

Regression: verdicts for B1, B2, B3, B8 and STATE_EFFECT are identical before and after, including B8 CONFLICTED.

## Success gate

    MISSION_RESULT = SUCCESS
    OBSERVED_SOURCE_SPAN = YES
    MANIFEST_AUTHORED_SPAN = 0
    HEURISTIC_SOURCE_SEARCH = 0
    AMBIGUOUS_MATCH_EMITS_SPAN = 0
    VERDICT_CHANGES = 0
    SEMANTIC_CORE_CHANGES = 0
    ONTOLOGY_CORE_CHANGES = 0

## Out of scope

- recovering once per manifest and any timing benchmark (separate mission below);
- an exact method-name span (`nameSpan`);
- editor navigation beyond keeping the decoder working;
- spans for statements or expressions;
- spec-file spans, unless the spec parser already keeps positions (then report it, do not build any);
- a shared anchor table, caching, `WRONG_OPERATION_SCOPE` rendering, B1 desktop inspection;
- adding `pom.xml` or any project file to the fixture;
- any change to a rule verdict.

## Follow-up missions (in order)

1. `EDITOR_CONSUME_OBSERVED_SOURCE_SPAN_V0_1`. Acceptance: Java extension absent, language mode `Plain Text`,
   `documentSymbolProvider` absent; click `[SOURCE] BookingService.createBooking` and the editor opens
   `BookingService.java` and reveals the `createBooking` declaration directly. This removes the language server from the
   correctness path of navigation. It should also use `sourceDigest` to notice a stale file.
2. `RECOVER_ONCE_PER_MANIFEST_V0_1`. `target_operation` is manifest-level and `contract::build` recovers once per rule.
   On the cinema manifest (5 rules, 9 Java files) one call took about 1.8 s (1.90 / 1.81 / 1.74) and one
   `reverse.ProjectMain` run about 0.36 s, so javac repetition explains most of it (other stages not measured
   separately). Target: 1 javac run per call, verdicts byte-identical.
3. Anchor duplication: 62 anchor objects but 6 distinct in a 46,663-byte output; a shared anchor table needs a contract
   version decision.
4. A cache keyed by source digests, since every Refresh re-analyzes the whole project.

## Stop conditions

- `IR_SPAN_UNAVAILABLE`: javac cannot give a position for the target declaration. Report what it returns.
- `IDENTITY_MISMATCH`: the function cannot be tied to the anchor without guessing.
- `CONTRACT_BREAK`: the change alters existing `verification.v0.1` fields or their meaning, or breaks the editor decoder.
- `STOP_UNSOUND`: success would require fabricating a span, scanning text, or letting the manifest supply one.

## Required final report

MISSION_RESULT: SUCCESS | IR_SPAN_UNAVAILABLE | IDENTITY_MISMATCH | CONTRACT_BREAK | STOP_UNSOUND

SYS_PLATFORM_COMMIT / SYS_EDITOR_COMMIT:
...

OBSERVED_SOURCE_SPAN: YES | NO

EMITTED_SPAN (real output) and SUBSTRING(source, start, end): side by side

SOURCE_DIGEST_CHECK: matches `shasum -a 256`: yes/no

SPAN_SEMANTICS_TESTS: tab, non-ASCII, surrogate pair, CRLF and lone CR results

AMBIGUITY_BEHAVIOR: overloads, same-name classes, NOPOS

OUTPUT_BYTE_IDENTITY: identical after removing `span`: yes/no

VERDICT_REGRESSION: identical | explain

STAGES_CHANGED: which of frontend / IR / semantic-core / ontology-core / spec-code-sync / contract (semantic-core and
ontology-core must be unchanged)

AUTOMATED_TESTS: commands and counts

EDITOR_DECODER: unchanged | minimal change, and why

SEMANTIC_CHANGES_REQUIRED: 0 | explain

NEXT_PRODUCT_GAP:
...

Stop after the observed span is genuinely emitted and independently checked, or a stop condition is reached.
