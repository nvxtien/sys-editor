# Mission Report — Remove Manual Source Binding from the Sys Editor Lifecycle

Mission: `docs/prompts/REMOVE_MANUAL_SOURCE_BINDING_FROM_EDITOR_V0_1.md`
Branch: `remove-manual-source-binding`
Date: 2026-09-25

RESULT:
GO — but only after a follow-up fix to sys-core (2026-09-26).

**Correction.** The first version of this report claimed GO while the feature was
broken in the running app. Pressing `Generate Formal Spec` on an operation rule
with no operation failed with:

    sys-core failed (502): OperationBindingRequired (exit status 1)

Root cause: this mission removed the binding gate from sys-editor only.
`sys-core/src/capability.rs` still answered `OperationBindingRequired` for an
operation rule without an operation, and `require_supported()` rejected the very
generation the editor now offered. Normalizing that outcome to
`FORMAL_SPEC_SUPPORTED` at the editor's parse boundary did not remove the
dependency — it hid it until the user clicked, turning a clearly-explained gate
into an opaque 502.

The tests missed it because they checked that the button *appears*, never that it
*works*: `OPERATION_RULE reaches Generate with no operation of its own` asserted a
count of 1 and stopped there.

Fixed by changing sys-core, which is what the mission's `NO_CORE_SOURCE_BINDING`
invariant asked for all along and what the plan wrongly excluded:

- `capability.rs`: an operation rule is `FORMAL_SPEC_SUPPORTED` regardless of any
  operation; the `OperationBindingRequired` outcome and the `operation_binding`
  field are gone.
- `lifecycle.rs`: `generate_formal_spec` takes the semantic operation from the
  intent (`semantic_operation`) and reports `OperationUnspecified` when the intent
  states none — a semantic gap, never a missing source binding. `bind_operation`
  and the `intent bind-operation` CLI command are removed.
- sys-core suite: 28 tests, 0 failures. Verified end to end: `intent capability`
  returns `FORMAL_SPEC_SUPPORTED` and `spec prepare` succeeds with no binding.

sys-editor also stopped normalizing the retired outcome. A sys-core that still
sends `OPERATION_BINDING_REQUIRED` is now refused, so the row shows "options
unavailable" instead of offering a button that 502s.

The editor-side mission is complete and verified by both unit tests and live
Playwright coverage of the visible lifecycle.

An earlier revision of this report said NARROW and attributed a boot failure
("SideX failed to start: platform.js does not provide an export named
'OperatingSystem'") to a pre-existing `const enum` problem. That diagnosis was
wrong. The real cause was 72 stray `.js` files sitting next to their `.ts` sources
in `src/`, emitted by a `tsc` invocation whose `--rootDir` was narrower than the
compiled files' dependency tree; `tsc` writes out-of-rootDir dependencies beside
their sources, and Vite then resolved `./platform.js` to the stale emitted file,
which inlines the const enum and therefore exports no `OperatingSystem`. The stray
files were removed, the plan's compile command was corrected to `--rootDir src`,
and the app boots.

EDITOR_BIND_OPERATION_UI:
REMOVED

`Bind operation`, `_bindOperation`, and `ISysProjectService.bindOperation` (with its
`sys-core intent bind-operation` call) are deleted. `Approve spec & review code`,
which demanded a Class.method, a code file and a source root, is deleted with them.
A sweep of `src` and `tests` for `bindOperation|bind-operation|Bind operation|
operationBinding|OPERATION_BINDING_REQUIRED|validateTargetOperation|targetOperation|
Class.method` returns only tests asserting absence and the deliberate legacy
normalization described below.

MANUAL_SOURCE_BINDING_REQUIRED:
NO

No lifecycle step asks a human for a class, method, symbol, source file or source
root. The only remaining prompt in the flow is for the sys-platform installation
root, which locates the platform, not a source symbol.

CORE_SOURCE_BINDING_DEPENDENCY:
0 — only after the sys-core fix above. It was NOT 0 when first reported.

The editor no longer reads sys-core's `operationBinding` field, and
`parseFormalizationCapability` returns a fresh object so the field cannot escape
into the rest of the editor. sys-core's legacy `OPERATION_BINDING_REQUIRED` outcome
is normalized at the parse boundary: to `FORMAL_SPEC_SUPPORTED` when the kind is
supported, and to `PLATFORM_FORMAL_SPEC_GAP` when `status` is `UNSUPPORTED`, so a
legacy reply can lose its binding requirement but never gain formalizability.
sys-core itself was not edited.

FORMAL_SPEC_GENERATION_REQUIRES_CLASS_METHOD:
NO

`assertSysDraftOperationBinding` is deleted. `assertSysDraftFormalizable` checks
lifecycle approval state and kind support only. A supported `OPERATION_RULE`,
including a record written before kinds existed, reaches Formal Spec generation
with no operation supplied by a human.

VERIFICATION_PROMPTS_FOR_CLASS_METHOD:
NO

`_verify` prompts for nothing. It reads the approved `.spec`, takes its semantic
`Operation:` declaration via `specOperation`, and builds the manifest from that.
A spec with no `Operation:` line, or a blank one, is refused with an explicit
message routed through the view's normal action error handling.

PLATFORM_SOURCE_MAPPING_OWNER:
YES

The manifest carries the semantic operation as `target_operation` and omits
`source_anchor` entirely. Which code that operation corresponds to is recovered by
sys-platform from `project_root`; the editor neither supplies nor infers a mapping,
and no source-mapping heuristic was added.

TESTS:
155 unit tests across 21 files in `src/vs/workbench/contrib/sys/common/test/`;
154 pass. Compiling with `--rootDir src` (the corrected command) resolved the
`localServerRefresh` failure previously misreported as a harness limit. The single
remaining failure is `sysVerificationLive.test.js`, which needs
`verification-v0.1.cinema.json`, a fixture not copied to the out dir. The suite was
also verified against a clean checkout of the branch HEAD, not the working tree.
`npm run lint` reports 0 errors.

New coverage, all written before the code and watched fail: the legacy
`OPERATION_BINDING_REQUIRED` reply is accepted and normalized; a legacy reply for an
unsupported kind does NOT unlock generation; a pre-kinds record needs no binding;
`specOperation` handles a missing, blank, and repeated `Operation:` line; the
manifest emits no `source_anchor` and no derived symbol; no action label in the
workbench reintroduces binding under another name.

PLAYWRIGHT:
PROVEN.

The whole GUI suite passes: **20 passed, 1 skipped, 0 failed**.

All seven `kind gating` cases pass, including `Bind operation` absent in every case,
`PLATFORM_FORMAL_SPEC_GAP` shown for DATA_MODEL and RELATIONSHIP, and a supported
OPERATION_RULE reaching `Generate Formal Spec` with no operation of its own. The new
`the lifecycle never asks for a source identity` passes.

Two tests that were stale against the sys-core lifecycle were brought up to date, a
change independent of source binding:

- `normalize-intent-live.spec.mjs:145` asserted `.sys/intents/REQ-001.intent.json`
  exists. That contradicted the same file's own assertion that "the editor keeps no
  intent file of its own". It now asserts what the test is actually about — the
  retry reached the live port, so sys-core holds the intent — and that the editor
  wrote no intent file.
- `gui-full-requirement-lifecycle.spec.mjs` drove Normalize through a mocked Tauri
  bridge, which cannot answer `/v1/sys/core`. Split into what it can honestly
  cover without a live server: the requirement renders from disk, and with no
  sys-core the editor fails closed — `Lifecycle unavailable`, no lifecycle action,
  no `Bind operation`, no `Class.method`, and no editor-written intent file.

`tests/gui/normalize-intent-live.spec.mjs` is updated to the new lifecycle: the
capability table asserts `Bind operation` has count 0 in every case, `DATA_MODEL`
and `RELATIONSHIP` show `PLATFORM_FORMAL_SPEC_GAP`, a supported `OPERATION_RULE`
reaches `Generate Formal Spec` with no operation of its own, and a new test asserts
no bind button, no `Approve spec & review code`, no visible quick input and no
`Class.method` copy. The obsolete `Bind operation goes through sys-core` test is
deleted.

None of it ran green. Every GUI test fails before its first assertion because the
app does not boot in the browser build:

    SyntaxError: The requested module '/src/vs/base/common/platform.js'
    does not provide an export named 'OperatingSystem'

`platform.ts:260` declares `export const enum OperatingSystem`; a const enum is
erased by esbuild/Vite and cannot be imported as a runtime value. That file is
unmodified by this work, so the break is pre-existing in committed code. It was not
fixed here: it is repo-wide and outside this mission.

REMAINING_PLATFORM_GAPS:

1. Semantic operation does not resolve to source. `semantic-core --target <op>`
   (`spec-code-sync/src/pipeline.rs:111`) resolves a source symbol. The spec's
   grammar emits a semantic operation such as `create booking`. Verify now sends the
   semantic name, so until sys-platform can map it, verification returns the
   platform's own failure as a `VerificationTransportError` in the Verification
   view. This is the accepted consequence of the mission, not a defect: the
   uncertainty is preserved rather than papered over with a prompt.

2. Jump-to-code degrades to file-only. `with_observed_span`
   (`spec-code-sync/src/contract.rs:387`) attaches an observed span only to an anchor
   whose kind is `SOURCE`. With `source_anchor` omitted, no span is returned, so
   `decideNavigation` falls to `SYMBOL_FALLBACK` or `FILE_ONLY`. Clicking a
   verification result no longer opens the implementation at its declaration.
   Recovering this without a prompt requires gap 1.

3. None. The two stale GUI tests were updated; the suite is green.
