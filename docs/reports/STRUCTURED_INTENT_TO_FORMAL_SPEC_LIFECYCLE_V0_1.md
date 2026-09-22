# Structured Intent → Formal Spec Lifecycle v0.1 Report

RESULT: NARROW_REQUIRED

SYS_CORE_CREATED: YES
SYS_CORE_LOCATION: `/Volumes/Work/dev/sys-platform/sys-core` (Rust crate and binary)
SYS_CORE_COMMIT: `ab5afca`, `ffb1fc0`
SYS_EDITOR_COMMIT: `21af8551`
PRODUCT_CLI_COMMIT: `806737a`

SYS_CORE_OWNS:

- workspace-scoped lifecycle records under `.sys/core/`;
- exact SHA-256 content identities and human approval transitions;
- operation-binding blocking and derived staleness status;
- Structured Intent and Formal Spec candidate persistence.

EDITOR_INTEGRATION: YES — `/v1/sys/core` server adapter; Editor save/approval transitions call sys-core.
PRODUCT_CLI_ROLE: thin client — path-depends on sys-core and exposes representative status/approval commands.
SYS_PLATFORM_ROLE: unchanged semantic authority; existing parser/verification pipeline remains outside sys-core.
CLI_PARITY_DEMONSTRATED: YES — product-cli uses the crate directly; 51 tests pass.

VERIFIED:

- raw free-form text, Unicode/newlines, UNKNOWN provenance, exact approval, operation binding, staleness, and workspace isolation: sys-core tests pass (2/2);
- Editor adapter delegation: Go test passes (1/1);
- Editor build passes;
- Editor lint has 0 errors and 6 pre-existing warnings.

WHY_NARROW_REQUIRED: Formal Spec provider orchestration and validation through
the existing sys-platform parser have not yet moved behind an injected
sys-core `ProposalProvider` boundary. The Editor also retains a compatibility
projection of lifecycle JSON. No claim of `STRUCTURED_INTENT_TO_FORMAL_SPEC_LIFECYCLE_PROVEN`
is made until those two migrations are complete.

UNRELATED_DIRTY_WORK: Existing uncommitted files in `/Volumes/Work/dev/sys-platform`
were preserved and excluded from the commits above.
