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
