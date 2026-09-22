# Requirement → operation binding (v0.1)

## Goal
A human can record which source operation (`Class.method`) implements a requirement. Nothing more: no lookup, no verification.

## Decisions
- Entered by typing `Class.method` in the sidebar (no platform, no Java needed).
- Stored as `operation` on the requirement entry in `.sys/project.json` (tool-owned data; `REQ-*.md` stays human text only).
- Binding is human intent, never checked by Sys in this sprint: the UI always says `not checked`.
- Binding does not affect Draft/Approved status (approval covers the requirement text only).

## Model (`common/sysProject.ts`)
- `SysRequirementRef.operation?: string`; `SysRequirementRow.operation?: string`.
- `parseOperation(text)`: trims; empty = unbind; valid = `Ident(.Ident)+` where `Ident = [A-Za-z_$][\w$]*`; otherwise an error message.
- `setOperation(project, id, operation | undefined)`; unknown id throws; other fields (`approvedText`) untouched.
- `parseProject` rejects a non-string or invalid `operation` as `MALFORMED_SYS_PROJECT`.

## Service and UI
- `ISysProjectService.setOperation(id, text)` reuses `writable()` and `save()` (malformed/multi-root state is never overwritten).
- Requirement row: sub-line `→ BookingService.createBooking · not checked` or `Not bound`; button `Bind` / `Edit binding` opens a quick input with live validation; submitting empty unbinds.

## Out of scope
Checking the operation exists, `.spec` files, manifest generation, Verify, platform-provided operation lists.

## Tests (pure, `node --test`)
Valid/invalid operation text; set, change and clear keep other fields; binding survives serialize/reload; invalid `operation` in a hand-edited file is `MALFORMED_SYS_PROJECT`; binding does not change status.

## Steps
1. Tests for the pure model, then the model.
2. Service method.
3. Row UI and quick input.
4. `tsc`, `eslint`, all Sys tests; commit.

## Revision: no code-correspondence reasoning in sys-editor
Sprint 1 originally shipped a client-side "Check" that ran `reverse.ProjectMain` and looked up the bound name
in `functions[].name` to answer FOUND/NOT_FOUND. This was removed:

- sys-platform's real identity match (`contract.rs::with_observed_span`) requires BOTH the qualified name AND
  the anchor's file, and treats >1 candidates as AMBIGUOUS, never resolving to a pick. sys-editor's binding has
  no file at all, so it cannot reproduce this rule, and a bare name lookup can report FOUND for a name that is
  actually ambiguous project-wide.
- More fundamentally: whether a requirement corresponds to code is sys-platform's reasoning to do, inside its
  real pipeline (manifest → recovery → matching → comparison). sys-editor re-implementing any part of that
  matching, however partial, is a second reverse path — exactly what sys-platform's own docs forbid.

`operation` stays as pure human-declared intent (mirrors the manifest's own `target_operation`/`source_anchor`,
which are authored, not reasoned) and is always labeled "declared by human, not checked against code". Any real
correspondence check is deferred to Verify (sprint 3+4), which runs the actual sys-platform pipeline.

## Revision 2: remove the binding feature entirely (YAGNI)
With the check removed, `operation` was inert data: written, displayed, never read by anything. The base
mission explicitly allows this ("Do not require source binding in the very first form unless it is naturally
available") — nothing here made it available. Removed `operation` from the model, service and UI entirely.

When the real manifest-generation sprint needs `target_operation` + a source file, it will ask for them at that
point, as direct input to the manifest it writes — not as pre-collected, unconsumed metadata sitting between
"declare" and "use".
