# Structured Intent → Formal Spec Lifecycle v0.1 Report

RESULT: NARROW_REQUIRED

SYS_CORE_CREATED: YES
SYS_CORE_LOCATION: `/Volumes/Work/dev/sys-platform/sys-core` (Rust crate and binary)
SYS_CORE_COMMIT: `ab5afca`, `ffb1fc0`, `07b4826`
SYS_EDITOR_COMMIT: `cc149019`, `daecdc20`
PRODUCT_CLI_COMMIT: `806737a`

SYS_CORE_OWNS:

- workspace-scoped lifecycle records under `.sys/core/`;
- exact SHA-256 content identities and human approval transitions;
- operation-binding blocking and derived staleness status;
- Structured Intent and Formal Spec candidate persistence.

EDITOR_INTEGRATION: YES — `/v1/sys/core` server adapter; Editor asks sys-core for deterministic context and submits provider candidates through sys-core.
PRODUCT_CLI_ROLE: thin client — path-depends on sys-core and exposes representative status/approval commands.
SYS_PLATFORM_ROLE: unchanged semantic authority; existing parser/verification pipeline remains outside sys-core.
CLI_PARITY_DEMONSTRATED: YES — product-cli uses the crate directly; 51 tests pass.

VERIFIED:

- raw free-form text, Unicode/newlines, UNKNOWN provenance, exact approval, operation binding, staleness, workspace isolation, and prepare/accept context boundary: sys-core tests pass (3/3);
- Editor adapter delegation: Go test passes (1/1);
- Editor build passes;
- Editor lint has 0 errors and 6 pre-existing warnings.

LLM_BOUNDARY: `sys-core` and `sys-platform` make zero provider calls. Editor
and CLI clients own provider invocation and submit candidates through
sys-core prepare/accept APIs.

WHY_NARROW_REQUIRED: sys-core does not yet invoke the existing sys-platform
Formal Spec parser/validator when accepting a candidate, and the Editor still
retains a compatibility projection of lifecycle JSON. No claim of
`STRUCTURED_INTENT_TO_FORMAL_SPEC_LIFECYCLE_PROVEN` is made until candidate
acceptance is platform-validated inside the shared lifecycle boundary.

UNRELATED_DIRTY_WORK: Existing uncommitted files in `/Volumes/Work/dev/sys-platform`
were preserved and excluded from the commits above.
