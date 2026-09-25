# Mission Report — Remove Manual Source Binding from the Sys Editor Lifecycle

Mission: `docs/prompts/REMOVE_MANUAL_SOURCE_BINDING_FROM_EDITOR_V0_1.md`
Branch: `remove-manual-source-binding`
Date: 2026-09-25

RESULT:
NARROW

The editor-side mission is complete and verified by unit tests. It is NARROW, not
GO, because the mission's own acceptance asks for Playwright coverage of the
visible lifecycle, and no GUI test in this repository can currently run: the app
does not boot in the browser build for a reason that predates this work.

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
0

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
153 unit tests across 21 files in `src/vs/workbench/contrib/sys/common/test/`;
151 pass. The 2 failures are harness artifacts of the repo's ad-hoc `tsc` pattern,
not this change: `localServerRefresh.test.js` imports `../../sidexChat` from outside
the compile `rootDir`, and `sysVerificationLive.test.js` needs
`verification-v0.1.cinema.json`, which is not copied to the out dir. Both were
verified against a clean checkout of the branch HEAD, not the working tree.
`npm run lint` reports 0 errors.

New coverage, all written before the code and watched fail: the legacy
`OPERATION_BINDING_REQUIRED` reply is accepted and normalized; a legacy reply for an
unsupported kind does NOT unlock generation; a pre-kinds record needs no binding;
`specOperation` handles a missing, blank, and repeated `Operation:` line; the
manifest emits no `source_anchor` and no derived symbol; no action label in the
workbench reintroduces binding under another name.

PLAYWRIGHT:
WRITTEN, NOT PROVEN.

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

3. The browser build does not boot (`const enum OperatingSystem`), which blocks all
   GUI verification of this and any other lifecycle work.
