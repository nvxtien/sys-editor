# Mission: Platform Anchor Range v0.1

## Current state

The desktop live workbench smoke is proven (`782131a9`). One bounded gap remains:

    DESKTOP_LIVE_NAVIGATION_GAP

Source anchors in `verification.v0.1` carry a `symbol` (for example `createBooking`) but no `range`.
The editor opens the file but cannot place the cursor on the method:

- the desktop opened `BookingService.java` at `Ln 1`; `createBooking` is at line 29;
- the editor tried a document symbol provider; it never ran, because the Red Hat Java extension activates only when
  the workspace contains `pom.xml` / `build.gradle*` / `.classpath`, and the pilot fixture
  (`sys-platform/harness/cinema-booking-pilot/fixture`) has none;
- spec anchors carry only `file`, so spec navigation opens at file level.

Facts already in the code:

- `spec-code-sync/src/contract.rs` `Anchor` has `range: Option<String>` (opaque, never populated for the pilot);
- `sysVerificationWire.ts` decodes `range` as an optional string;
- `VerificationAnchor` in `sysVerification.ts` has `range?: string`;
- `_renderAnchor` / `_openAnchor` in `sysVerificationWorkbenchView.ts` ignores `range` and opens file-level,
  then tries a symbol provider only when `symbol` is set.

## Mission

Make source and spec anchors carry a real, structured location where the platform genuinely knows it,
and make the editor honor it without any language server.

This mission is a contract-additive navigation improvement.
It must NOT change verdicts, dispositions, comparator semantics, semantic recovery, proof rules, or B-rule intent.

## Target architecture

    source recovery
      -> source semantic evidence
      -> VerificationAnchor { file, symbol?, range? }     range = authoritative observed source location
      -> verification.v0.1
      -> sys-editor: open file, select/reveal range

Navigation order in the editor:

    range present                                   -> navigate directly to range          (primary)
    range absent + symbol + symbol provider usable  -> resolve symbol                      (convenience fallback)
    otherwise                                       -> open file                           (final fallback)

Never guess a line number.

Invariant:

    Anchor range = observed source location, not an inferred UI location.

    platform knows the exact source span -> emit range
    platform does not know it            -> omit range
    never fabricate a range from a symbol name

## Design constraints

1. The range is emitted by the platform from data the extractor already has. If the extractor has no span
   information, do not fabricate one. Stop and report (see `RANGE_SOURCE_GAP`).
2. Additive only. Existing consumers that ignore `range` must keep working. `verification.v0.1` meaning is unchanged.
3. Prefer a structured range over the opaque string:

       "range": { "startLine": 29, "startColumn": 5, "endLine": 29, "endColumn": 24 }

   1-based lines and columns, end exclusive on column. If the existing `range: Option<String>` field must stay
   for compatibility, keep it accepted and ignored by the new reader, and introduce the structured field under a
   new name. Record the decision and the reason.
4. The editor never guesses a location:
   - no range => open at file level (current behavior);
   - malformed range => open at file level, no crash;
   - range outside the file => clamp only to the document end, never search by text;
   - `symbol` alone must not trigger a text search.
5. The symbol-provider path already in `_openAnchor` may stay as a secondary path, but a platform `range`, when
   present, takes precedence. Do not add Java-specific or rule-specific logic anywhere.

## Work

### sys-platform

1. Find where `source_anchor` and `spec_anchor` are built (`contract.rs` and its callers).
2. Determine whether the extractor / spec parser retains source positions for:
   - the recovered method declaration (`createBooking`);
   - the spec rule text (`b2.spec`, the line of the rule).
3. Emit the range only for anchors whose position is known. Leave others without `range`.
4. Add contract tests: a source anchor with a range, a spec anchor with a range, an anchor without a range,
   and JSON serialization unchanged when `range` is absent.
5. Commit only intended platform changes. Do not include `.DS_Store`.

### sys-editor

1. Extend the wire decoder and `VerificationAnchor` for the structured range. Reject malformed ranges with a
   bounded decode result, not a crash.
2. In `_openAnchor`, when a valid range is present, open with a `selection` and reveal it.
3. Add node tests for: valid range, absent range, malformed range, range beyond the document.
4. Update the golden `verification-v0.1.cinema.json` only from real platform output. Do not hand-edit it.

## Verification

Automated (report exact commands and counts):

- sys-platform: the new contract tests and the existing suite;
- sys-editor: all verification node tests, Rust UTF-8 tests, targeted TypeScript and eslint for the changed files;
- real-binary probe: `spec-code-sync verification-v0.1 <manifest>` still exits 0, and the anchors for B2 now
  include a range for the source method.

Desktop (do not fabricate observations):

1. Open B2, open guard, click `[SOURCE] BookingService.createBooking`.
   Expect the cursor and selection on the `createBooking` declaration (about line 29) with the Java extension
   absent or inactive, no `documentSymbolProvider`, and language mode `Plain Text`. This is the acceptance test:
   it proves the range contract is independent of language tooling. Record the language mode shown in the status bar.
2. Click `[SPEC] b2.spec`. Expect the rule line selected if the range is emitted, file level otherwise.
3. Confirm a rule whose anchor has no range still opens at file level with no error.
4. Confirm Refresh, B8 CONFLICTED, and the LIVE data source are unchanged.

## Out of scope

Keep this mission falsifiable. Do not include:

- rendering the `WRONG_OPERATION_SCOPE` reason for the B8 guard in the UI;
- desktop inspection of B1 detail;
- adding `pom.xml` or any project file to the fixture to activate a language extension;
- any change to the verdict of any rule.

`PRODUCT_VERIFICATION_E2E_PROVEN = YES` stays as established. This is navigation hardening, not a re-opening of
the semantic or product E2E proof.

## Safety invariants (must still hold)

    DOMAIN_SPECIFIC_PROVIDER_LOGIC = 0
    DOMAIN_SPECIFIC_FORMATTER_LOGIC = 0
    UI_SEMANTIC_INFERENCE = 0
    PROSE_PARSING = 0
    SILENT_FIXTURE_FALLBACK = 0
    NAVIGATION_TEXT_SEARCH = 0

## Stop conditions

- `RANGE_SOURCE_GAP`: the platform does not retain positions for the required anchors. Report exactly what
  position data exists and what would have to change. Do not invent ranges.
- `CONTRACT_BREAK`: the change would alter existing `verification.v0.1` fields or their meaning.
- `STOP_UNSOUND`: success would require guessing a location from names, searching text, or hard-coding a rule.

## Required final report

MISSION_RESULT: SUCCESS | RANGE_SOURCE_GAP | CONTRACT_BREAK | STOP_UNSOUND

SYS_PLATFORM_COMMIT / SYS_EDITOR_COMMIT:
...

RANGE_FIELD_DECISION: structured vs opaque string, and why

SOURCE_RANGE_EMITTED: yes/no, with an example anchor from real output

SPEC_RANGE_EMITTED: yes/no, with an example anchor from real output

DESKTOP_SOURCE_NAVIGATION: observed / not observed

DESKTOP_SPEC_NAVIGATION: observed / not observed

AUTOMATED_TESTS: commands and counts

SEMANTIC_CHANGES_REQUIRED: 0 | explain

NEXT_PRODUCT_GAP:
...

Stop after the range path is genuinely exercised on desktop or a stop condition is reached.
