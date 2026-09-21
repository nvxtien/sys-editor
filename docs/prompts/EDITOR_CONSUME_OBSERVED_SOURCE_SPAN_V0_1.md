# Mission: Editor Consume Observed Source Span v0.1

## Question this mission answers

    Can the editor take a source location that the platform observed
    and put the user on it, with no language tooling in the correctness path?

Required answer: YES or NO, with desktop evidence. The editor only consumes; it never observes, searches or infers.

## Current state

`PLATFORM_OBSERVED_SOURCE_SPAN_V0_1` is proven (sys-platform `82b1da6`, sys-editor `6b97451f`). Every SOURCE anchor of
the cinema manifest now carries, from the real binary:

    "span": { "startOffset": 863, "endOffset": 2045,
              "startLine": 29, "startColumn": 5, "endLine": 55, "endColumn": 6,
              "sourceDigest": "sha256:a8ef9bbf..." }

Locked semantics of the span: UTF-16 offsets, `[startOffset, endOffset)` half-open, 1-based line/column, exclusive end,
digest = SHA-256 of the exact bytes of the file the platform read. `span` exists only when the platform observed it and
matched exactly one function; SPEC anchors and BOM files have none.

Editor today, verified in code:

- `VerificationAnchor` (`common/sysVerification.ts`) has `kind, label, file?, symbol?, range?`; it has no span;
- the wire decoder (`common/sysVerificationWire.ts` `anchor()`) reads only known fields, so `span` is currently dropped
  (a test proves the decoder accepts it);
- `_renderAnchor` / `_openAnchor` (`browser/sysVerificationWorkbenchView.ts`) opens the file, then only tries a
  `documentSymbolProvider` for `symbol`. With no Java language server the cursor stays at line 1. This is the observed
  gap `DESKTOP_LIVE_NAVIGATION_GAP`: `BookingService.java` opened at `Ln 1`, `createBooking` is at line 29.

## Mission

Decode the observed span into the anchor model and make `_openAnchor` select and reveal it.

Navigation order (locked):

    1. valid span present and the file is not stale  -> select and reveal the span            (primary)
    2. no span, symbol present, symbol provider gives exactly one match -> reveal the symbol  (convenience fallback, existing)
    3. otherwise                                     -> open the file only                    (final fallback)

Never guess a line number. Never search the file text. The span is never used to decide anything about a verdict.

It must NOT change verdicts, dispositions, or how any verification data is rendered. It must NOT change
`sys-platform`.

## Design

### Model and decoder

1. Add an optional `span` to `VerificationAnchor` with the fields above (numbers, plus `sourceDigest` string).
2. The decoder validates it structurally: all six numbers are integers, `startLine >= 1`, `startColumn >= 1`,
   `endOffset >= startOffset`, and the end is not before the start. A span that fails is **dropped with the anchor
   still usable** (file-level open), never a decode error for the whole contract. `span` absent is normal.
3. `range` (string) stays unchanged and unused.

### Reveal

- Use `startLine/startColumn` to `endLine/endColumn` as an editor `Range`. They are already 1-based with an exclusive
  end, which matches the editor's range semantics; do not convert through offsets.
- Check the range against the opened model: lines within `1..lineCount`, columns within the line length + 1. If it does
  not fit, do not clamp and do not guess: open file-level and say why (see "Visible outcome").
- Select the range and reveal it (center). The cursor sits at `range.start`; it need not sit on the method name.

### Staleness

The span is only meaningful for the exact bytes the platform read.

- Compute SHA-256 of the file's current bytes (through the file service, not from the model text) and compare it to
  `sourceDigest`.
- Equal -> proceed with the span. Different -> do **not** reveal the range; open file-level and show that the file
  changed since verification. Unsaved edits in an open editor do not change the on-disk bytes, so compare the disk
  bytes and additionally treat a dirty editor as stale.
- If the digest cannot be computed (read error, unsupported), do not reveal the range and report why.

### Visible outcome

The anchor button/title must state what happened, without inventing: for example "opened at declaration",
"opened file only: no observed location", "opened file only: file changed since verification (refresh)",
"opened file only: location does not fit this file". No modal dialogs.

## Work

1. Model and decoder as above, with node tests: valid span, absent span, malformed span (each field), inverted range,
   fields of the wrong type; a malformed span must leave the rest of the contract intact.
2. `_openAnchor` extracted into a small pure decision function (span state + staleness + fit -> one of the three
   outcomes) that can be tested without the DOM; the DOM part only executes the decision.
3. Tests for the decision: valid, stale digest, dirty editor, out-of-range line, out-of-range column, no span with
   symbol, no span without symbol, digest unavailable.
4. Keep the existing symbol-provider path as fallback 2 unchanged in behavior.
5. Refresh nothing in sys-platform. The golden already contains real spans.
6. Commit only intended sys-editor changes.

## Desktop acceptance (the point of the mission)

Do not fabricate observations. Record each one.

Environment for the acceptance case:

    Java extension absent or inactive
    documentSymbolProvider absent
    language mode = Plain Text   (record what the status bar shows)

Steps:

1. Launch the desktop app with the live settings used before.
2. Open B2, open the guard obligation, click `[SOURCE] BookingService.createBooking`.
   Expect: `BookingService.java` opens with the `createBooking` declaration (lines 29 to 55) selected and revealed, the
   cursor at `Ln 29, Col 5`, and the anchor states "opened at declaration".
3. Click `[SPEC] b2.spec`. Expect file-level open and the state "no observed location" (SPEC anchors have no span).
4. Staleness: change a character in `BookingService.java` and save, click the anchor again.
   Expect file-level open and the stale message, no reveal. Revert the change and confirm the reveal works again.
   (This edits a file in sys-platform's fixture; restore it exactly and confirm `git status` is clean there.)
5. Refresh still works, B8 is still CONFLICTED, data source is LIVE.

## Safety invariants

    EDITOR_SPAN_INFERENCE = 0          the editor never derives a location
    NAVIGATION_TEXT_SEARCH = 0
    LANGUAGE_SERVER_IN_PRIMARY_PATH = 0
    STALE_SPAN_REVEALED = 0
    VERDICT_RENDERING_CHANGES = 0
    SYS_PLATFORM_CHANGES = 0

## Out of scope

- spans for SPEC anchors or statements (platform side);
- an exact method-name span;
- a shared anchor table, caching, recover-once;
- `WRONG_OPERATION_SCOPE` rendering and B1 desktop inspection;
- refactoring the workbench view or the `overflow` / Refresh fixes already committed.

## Stop conditions

- `DIGEST_UNAVAILABLE`: the editor cannot obtain a SHA-256 of the file bytes in the desktop runtime. Report what is
  available. Do not reveal spans without a staleness check and do not drop the check to make the demo pass.
- `SPAN_COORDINATE_MISMATCH`: the span's line/column does not match the editor model for a fresh, unmodified file
  (for example a BOM, line-ending or encoding difference). Report the exact case. Do not adjust by an offset.
- `STOP_UNSOUND`: success would require guessing a location, searching text, or ignoring staleness.

## Required final report

MISSION_RESULT: SUCCESS | DIGEST_UNAVAILABLE | SPAN_COORDINATE_MISMATCH | STOP_UNSOUND

SYS_EDITOR_COMMIT:
...

NAVIGATION_ORDER_TESTS: which outcomes are covered and how

DESKTOP_ENVIRONMENT: Java extension state, language mode shown in the status bar, documentSymbolProvider absent (how confirmed)

DESKTOP_SOURCE_NAVIGATION: selection and cursor position observed, anchor message shown

DESKTOP_SPEC_NAVIGATION: observed

DESKTOP_STALE_CASE: observed, and the fixture restored (git status clean in sys-platform)

AUTOMATED_TESTS: commands and counts (verification node tests with the real-binary probe enabled, Rust UTF-8 tests,
targeted tsc and eslint)

SAFETY_INVARIANTS: each value above

SEMANTIC_CHANGES_REQUIRED: 0 | explain

NEXT_PRODUCT_GAP:
...

Stop after the range path is genuinely exercised on desktop or a stop condition is reached.
