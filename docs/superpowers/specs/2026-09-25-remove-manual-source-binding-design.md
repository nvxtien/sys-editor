# Remove Manual Source Binding from the Sys Editor Lifecycle

Date: 2026-09-25
Mission: `docs/prompts/REMOVE_MANUAL_SOURCE_BINDING_FROM_EDITOR_V0_1.md`

## Intent

The editor must stop asking a human for a source-code identity as a lifecycle
prerequisite. Human governs intent; sys-platform governs the correspondence
between a Formal Spec and source code. Every place where the editor compensates
for missing platform source recovery by prompting for `Class.method` is removed
rather than relocated.

Success is not the disappearance of a button. Success is that no lifecycle
precondition anywhere in the editor reads a source symbol.

## Live dependencies found

| Location | Dependency |
|---|---|
| `sysSemanticWorkbenchView.ts:535` | `Bind operation` action, gated on `operationBinding === 'REQUIRED'` |
| `sysSemanticWorkbenchView.ts:377` | `_bindOperation` quick-input for `Class.method` |
| `sysSemanticWorkbenchView.ts:402` | `Approve spec & review code` prompts operation + code file + source root |
| `sysSemanticWorkbenchView.ts:473` | `_verify` prompts operation + source file |
| `sysFormalSpecDraft.ts:13` | `assertSysDraftOperationBinding` blocks drafting |
| `sysStructuredIntent.ts:99,129` | `operationBinding` field and its "bind its operation" copy |
| `sysProjectService.ts:43,221` | `bindOperation()` calling `sys-core intent bind-operation` |
| `sysProjectService.ts:243` | `approveSpec` error copy referring to operation binding |

## Two facts that shape the design

**The source-file pickers are already redundant.** In
`spec-code-sync/src/contract.rs`, `InputRule.source_anchor` is `Option<Anchor>`,
and recovery runs from `project_root` plus `target_operation` alone
(`recover_observed_project_located`). Dropping the file and source-root prompts
costs no capability the platform was actually using.

**`target_operation` is still a source symbol.** `semantic-core --target <op>`
resolves a `Class.method`. The Formal Spec grammar emits a semantic operation
(`Operation: create booking`). Once the editor stops prompting, the platform
receives a name it cannot resolve today.

## Decisions

**Verify sends the semantic operation and surfaces the gap.** It does not
prompt, does not guess, and does not fall back. When the platform cannot
recover correspondence, the existing `VerificationTransportError` path shows the
platform's own failure in the Verification view, and the existing
`NOT_OBSERVED` / `UNSUPPORTED` dispositions carry non-green results. No new
error vocabulary is invented. The consequence is accepted: Verify is non-green
until sys-platform can resolve a semantic operation. That is reported as a
remaining platform gap, not patched around in the editor.

**`Approve spec & review code` is removed entirely.** It prompts for a manually
selected implementation target, which the mission forbids. The governed
lifecycle ends at Verify. Code generation is a separate concern and is not
re-introduced under another label.

## Design

### Capability contract — `sysStructuredIntent.ts`

`operationBinding` leaves `SysFormalizationCapability` and leaves parse
validation; sys-core may keep sending the field and the editor ignores it.
`OPERATION_BINDING_REQUIRED` remains accepted on the wire and is normalized to
`FORMAL_SPEC_SUPPORTED` at the parse boundary, so a supported `OPERATION_RULE`
reaches Formal Spec generation without any sys-core change. The editor-side
`SysFormalizationOutcome` becomes `FORMAL_SPEC_SUPPORTED |
PLATFORM_FORMAL_SPEC_GAP | NOT_FORMALIZABLE`.

`formalizationNote` drops the binding sentence. The gap note renders the literal
token `PLATFORM_FORMAL_SPEC_GAP` so the capability gap is visible and testable.

Normalizing at the boundary is what keeps `CORE_SOURCE_BINDING_DEPENDENCY` at
zero without editing a repository this change does not own.

### Draft gate — `sysFormalSpecDraft.ts`

`assertSysDraftOperationBinding` is deleted. `assertSysDraftFormalizable` keeps
the lifecycle-state and capability checks and nothing else. Formal Spec
generation depends on approval state and kind support; it depends on no source
identity.

### Workbench view — `sysSemanticWorkbenchView.ts`

`_bindOperation`, the `Bind operation` action, `_approveSpecAndReviewProposal`
and its action are deleted. `_verify` prompts for nothing: it reads the approved
`.spec`, takes its semantic `Operation:` declaration, and runs.

### Manifest — `sysManifest.ts`

`ManifestInput.sourceFile` is removed and `source_anchor` is omitted, since the
field is optional and the platform recovers source itself. `targetOperation`
becomes `operation` and carries the semantic name. `validateTargetOperation` is
deleted; its `Class.method` regex exists only to validate a source symbol. A new
`specOperation(text)` reads the `Operation:` line from a Formal Spec.

### Service — `sysProjectService.ts`

`bindOperation` is removed from `ISysProjectService` and its implementation.
`approveSpec`'s error message loses its binding clause.

## Explicitly unchanged

The Structured Intent `operation` fact stays — it is semantic, not a source
binding. `Operation:` stays in the Formal Spec grammar. sys-core, sys-platform
and the provider boundary are untouched; no LLM call moves.

## Testing

Unit tests in `src/vs/workbench/contrib/sys/common/test/` cover mission tests
1-12, written before the code changes. Playwright covers the visible lifecycle:
a confirmed `OPERATION_RULE` reaches `Generate Formal Spec` with no bind action
and no `Class.method` prompt; a `DATA_MODEL` intent shows
`PLATFORM_FORMAL_SPEC_GAP`, no bind action and no `Generate Formal Spec`.

A test asserts that no action label in the workbench reintroduces source binding
under another name, so the guarantee does not decay into a rename.
