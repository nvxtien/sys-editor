# Sys Editor end-to-end user journey

## Goal

Let a user enter a plain-language requirement in Sys Editor, review and approve a draft formal spec, review a generated and independently verified code proposal, explicitly approve applying it, and see Sys Platform's post-apply verification result.

## Ownership and boundary

Sys Editor owns the user interaction, requirement text and editable draft/spec presentation. Sys Platform remains authoritative for parsing and compiling specs, approval state, proposal generation, verification evidence, applying code, and post-apply verification. Editor must use the existing `sys` CLI and its machine-readable outputs, not inspect or mutate Platform's private `.sys` state directly.

## User flow

1. User enters free-form text in Editor.
2. Editor invokes a new non-mutating Platform draft-preview CLI mode. Platform creates a candidate draft and validates it through its existing parser and compiler, returning JSON. Preview does not persist or approve the requirement.
3. Editor displays the candidate in its spec editor. User may edit it and explicitly approve. Editor submits the approved draft through the existing `sys requirement` workflow; Platform persists it and creates a code proposal.
4. Platform independently verifies provider-generated code in isolation. Editor reads the proposal through `sys proposal show --json` and presents its diff and verification state. Apply is enabled only for `VERIFIED_SYNCED`; missing provider/verifier configuration or any other state is a clear stop with the reason shown.
5. User explicitly approves applying. Editor calls `sys proposal apply --approve-code --json`; Platform applies and post-verifies. Editor presents the returned result.

## Implementation constraints

- Add only the draft-preview CLI capability needed to produce a validated, non-persisted JSON candidate; reuse existing generation, parse, compile, proposal, verification and apply paths.
- Ensure Platform completes compiler validation before persisting an approved requirement/spec, so invalid specs cannot be left in approved state.
- Add project-root `cwd` support to Editor's existing task transport so CLI calls run against the selected project.
- Keep the existing Verify action working. Avoid a general workflow API, new orchestration framework, or new persistence format.
- Do not auto-approve spec or code and do not offer Apply for unverified proposals.

## Acceptance criteria

- Plain text can produce an editable draft preview without changing Platform project state.
- Spec approval runs Platform validation before any approval state is persisted.
- The UI shows proposal diff and exact verification state; Apply remains unavailable unless state is `VERIFIED_SYNCED`.
- Applying requires an explicit user action and displays Platform's post-apply verification result.
- CLI execution uses the selected project root, and the current Verify action remains intact.
- Automated checks cover preview non-mutation, failed compiler validation leaving no approval, Apply gating, and successful E2E orchestration with mocked CLI responses.

## Self-review

- **Trust boundary:** Platform owns every semantic/verification decision; Editor only presents returned status and gates the user's action.
- **Mutation boundary:** preview is read-only; approval and apply are separate explicit user actions.
- **Failure handling:** non-verified states block Apply and remain visible; Platform CLI errors are surfaced without translating them into success.
- **Scope:** reuses existing CLI and transport patterns; no duplicate domain model or broad protocol.
- **Open implementation detail:** confirm the current CLI JSON shape and exact project-root selection API during planning; acceptance behavior does not depend on introducing another contract.
