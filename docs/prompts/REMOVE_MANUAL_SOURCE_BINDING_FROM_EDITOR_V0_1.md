# Remove Manual Source Binding from Sys Editor Lifecycle

## Status

Approved implementation mission.

## Context

The current Sys Semantic Workbench still exposes a manual source-binding step in the UI.

Observed UI currently shows actions such as:

    Review intent
    Bind operation
    Approve intent
    Add spec

and explanatory copy such as:

    Operation rule: bind its operation to generate a Formal Spec.

This is no longer the intended architecture.

The product rule is now:

    Human governs intent.
    sys-platform governs semantic correspondence between Formal Spec and source code.

Manual source binding must therefore be removed from the Editor lifecycle.

## Goal

Remove all user/editor-owned source-operation binding from the Sys Editor requirement lifecycle.

After this change, the user must NOT be asked to bind a requirement, Structured Intent, or Formal Spec to a source-code identity before Formal Spec generation or verification.

The Editor must no longer treat a Class.method symbol as a prerequisite for Formal Spec generation.

## Architectural invariant

Required invariant:

    NO_USER_SOURCE_BINDING
    NO_EDITOR_SOURCE_BINDING
    NO_CORE_SOURCE_BINDING

    SPEC_CODE_RELATIONSHIP_OWNER = sys-platform

A semantic operation in a Formal Spec is NOT a source-code binding.

For example:

    Operation: create booking

is allowed as part of the Formal Spec language.

This must not be treated as equivalent to:

    BookingService.createBooking

The latter is a source symbol identity and must not be supplied manually by the user as a lifecycle prerequisite.

## Required UI changes

Remove the following UI behavior from the Semantic Workbench:

    [Bind operation]

Remove copy equivalent to:

    Operation rule: bind its operation to generate a Formal Spec.

Do not replace it with another manual source-binding control.

The supported lifecycle should read conceptually as:

    Review intent
    Confirm intent
    Generate Formal Spec
    Review Formal Spec
    Approve Formal Spec
    Verify

subject to Structured Intent kind/capability gating.

For unsupported intent kinds, show the capability gap instead of asking for a source binding.

Example:

    PLATFORM_FORMAL_SPEC_GAP

    Current sys-platform grammar does not represent this intent kind yet.

No source-binding action should appear in this state.

## Formal Spec generation

Formal Spec generation must depend on:

- the Structured Intent being in the correct reviewed/approved state;
- the Structured Intent kind being supported by the current formalization capability;
- any semantic information required by the Formal Spec grammar.

Formal Spec generation must NOT depend on:

- Class.method;
- source file path;
- controller method;
- function symbol;
- AST node;
- manually selected implementation target.

If the Formal Spec grammar requires an `Operation:` declaration, obtain the semantic operation from the Structured Intent / generated Formal Spec semantics.

Do not reinterpret this as a source-code symbol binding.

## Source recovery and verification

When verification begins, the Editor sends the governed artifacts to sys-platform.

The Editor must not prompt the user for a source target before verification.

The intended flow is:

    Approved Formal Spec
        -> sys-platform
        -> recover source semantics
        -> determine spec/code correspondence
        -> compare governed and recovered semantics
        -> return evidence/verdict

If sys-platform cannot determine source correspondence, preserve that uncertainty.

Use the platform's existing non-green/unknown result vocabulary where available, for example conceptually:

    SOURCE_MAPPING_UNKNOWN
    RECOVERY_INCOMPLETE
    UNSUPPORTED

Do not manufacture a source mapping.
Do not fall back to a manual Class.method prompt.

## Code cleanup

Inspect the current implementation and remove or migrate source-binding concepts that are no longer valid lifecycle requirements.

Candidates include, but are not limited to:

    Bind operation UI action
    _bindOperation(...)
    assertSysDraftOperationBinding(...)
    targetOperation prompts
    "authoritative operation binding"
    canGenerateFormalSpec(...) requiring Class.method
    operation provenance = OBSERVED solely because a user typed a source symbol
    verification prompts asking for Class.method
    copy saying an operation must be bound before Formal Spec generation

Do not delete fields blindly.

Before changing any field named `operation`, distinguish:

    semantic operation
    vs
    source-code binding metadata

Only the source-binding responsibility is removed.

## Structured Intent

Structured Intent may still contain semantic operation information when the requirement itself is operation-oriented.

For example:

    kind = OPERATION_RULE
    operation = "create booking"

is valid.

This does NOT mean:

    operation = "BookingService.createBooking"

unless the raw requirement itself explicitly defines that semantic identifier and the Formal Spec language treats it as intent rather than source mapping.

No provenance field may claim OBSERVED merely because the Editor asked the user to enter a source symbol.

## Capability gating

Do not use source binding as a formalization capability gate.

Bad:

    OPERATION_RULE + Class.method binding
        -> FORMAL_SPEC_SUPPORTED

Required direction:

    OPERATION_RULE
        -> FORMAL_SPEC_SUPPORTED

when the current sys-platform Formal Spec grammar supports that semantic kind.

For unsupported kinds such as current DATA_MODEL support gaps:

    DATA_MODEL
        -> PLATFORM_FORMAL_SPEC_GAP

This gap is independent of source mapping.

Do not say DATA_MODEL is blocked because it lacks an operation binding.

## sys-core boundary

If sys-core exists or is introduced by the lifecycle work:

sys-core may own:

- lifecycle state;
- Structured Intent persistence;
- exact-content approval;
- staleness;
- capability routing.

sys-core must NOT own:

- source-code binding;
- spec-to-source semantic mapping;
- source recovery;
- source-symbol selection as a prerequisite.

## sys-platform boundary

sys-platform owns:

- Formal Spec grammar and validation;
- source semantic recovery;
- governed ontology / recovered ontology comparison;
- spec-to-code semantic correspondence;
- verification evidence and verdicts.

If Editor code currently compensates for missing platform source recovery by asking the user for Class.method, remove that compensation.

Do not implement new source-mapping heuristics in the Editor.

If platform recovery is insufficient, expose the non-green/unknown platform result rather than hiding the gap.

## LLM boundary

Keep the existing architectural rule:

    LLM calls happen in sys-editor / product-cli only.

    LLM_CALLS_FROM_SYS_CORE = 0
    LLM_CALLS_FROM_SYS_PLATFORM = 0

This mission is about source binding, not changing the provider boundary.

## Tests

Add or update tests proving:

1. The Semantic Workbench no longer renders `Bind operation`.
2. The explanatory copy no longer says a source operation must be bound before Formal Spec generation.
3. A supported OPERATION_RULE can reach Formal Spec generation without a manually supplied Class.method.
4. `canGenerateFormalSpec` or its replacement does not require source binding.
5. Formal Spec generation still requires correct lifecycle approval/capability state.
6. Unsupported DATA_MODEL intent shows `PLATFORM_FORMAL_SPEC_GAP` and does not show a source-binding action.
7. Verification does not prompt for `Class.method`.
8. No replacement source-binding UI is introduced under another label.
9. Semantic `Operation: create booking` remains valid and is not converted to `BookingService.createBooking`.
10. Failure to recover spec/code correspondence remains explicit and non-green.
11. Existing operation-rule Formal Spec behavior continues to work.
12. LLM/provider invocation remains outside sys-core and sys-platform.

Update Playwright coverage for the visible lifecycle.

At minimum include a test starting from a confirmed OPERATION_RULE Structured Intent and prove:

    no Bind operation button
    Generate Formal Spec is available when capability allows
    no Class.method prompt appears

Also include a DATA_MODEL case proving:

    no Bind operation button
    no Generate Formal Spec
    PLATFORM_FORMAL_SPEC_GAP visible

## Non-goals

- Do not extend sys-platform Formal Spec grammar in this change.
- Do not add source-mapping heuristics to sys-editor.
- Do not add manual source mapping to sys-core.
- Do not move provider calls into sys-core or sys-platform.
- Do not remove semantic `Operation:` syntax from Formal Spec solely because manual source binding is removed.
- Do not conflate this mission with SideX process/duplicate-server lifecycle work.

## Required workflow

Follow the repository engineering workflow:

    Brainstorming
    -> Writing plan
    -> TDD
    -> Verification
    -> GO / NARROW / STOP

Before editing, inspect the current implementation and identify every live dependency on manual source binding.

Do not only remove the visible button while leaving hidden lifecycle preconditions behind.

## Acceptance criteria

The mission is complete only when:

    EDITOR_BIND_OPERATION_UI = REMOVED
    MANUAL_SOURCE_BINDING_REQUIRED = NO
    CORE_SOURCE_BINDING_DEPENDENCY = 0
    FORMAL_SPEC_GENERATION_REQUIRES_CLASS_METHOD = NO
    VERIFICATION_PROMPTS_FOR_CLASS_METHOD = NO
    PLATFORM_SOURCE_MAPPING_OWNER = YES

and the tested UI lifecycle is:

    Raw Requirement
      -> Normalize Intent
      -> Review / Confirm Structured Intent
      -> Capability Gate
      -> Generate Formal Spec when supported
      -> Review / Approve Formal Spec
      -> Verify
      -> sys-platform determines source correspondence

## Required final report

Report:

    RESULT:
    GO | NARROW | STOP

    EDITOR_BIND_OPERATION_UI:
    REMOVED | remaining locations

    MANUAL_SOURCE_BINDING_REQUIRED:
    NO | explain blocker

    CORE_SOURCE_BINDING_DEPENDENCY:
    0 | remaining dependencies

    FORMAL_SPEC_GENERATION_REQUIRES_CLASS_METHOD:
    NO | explain

    VERIFICATION_PROMPTS_FOR_CLASS_METHOD:
    NO | explain

    PLATFORM_SOURCE_MAPPING_OWNER:
    YES | explain

    TESTS:
    ...

    PLAYWRIGHT:
    ...

    REMAINING_PLATFORM_GAPS:
    ...

Do not report GO merely because the button disappeared. Prove the lifecycle no longer depends on manual source binding.
