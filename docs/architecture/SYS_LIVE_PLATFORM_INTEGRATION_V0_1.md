# Sys Live Platform Integration v0.1

## Measurement result

The current Sys Platform exposes structured JSON through:

- `sys status --json`
- `sys intent --json`
- `sys proposal show --json`

These are suitable transport candidates. The editor must not scrape human-readable CLI output.

## Current contract coverage

Available directly: project path, requirement id/version, target file, last sync state, pending proposal metadata and verification state, unresolved intent items, and proposal evidence/diff metadata.

Missing for the existing Semantic Workbench read model: governed operations and rules, recovered meaning, semantic sync rows/classifications, review packet, evidence summary, confirmed human-intent details, and a versioned aggregate snapshot contract.

## Decision

`PLATFORM_API_GAP`. No adapter is implemented until Sys Platform exposes the missing fields through a documented structured contract. The Editor must not infer them from source files, `.sys` implementation details, or human-facing CLI prose.

## Required next seam

Add a versioned aggregate machine-readable read command or library API that returns the complete trusted project snapshot and intent register. A future Editor adapter can then validate the major schema version, map the response to `SysProjectSnapshot`, and keep live backend failures distinct from explicit fixture/demo mode.

Write actions also require a structured contract for clarification, confirmation, leave-unresolved, and replacement. Until that exists, live actions remain disabled; no undocumented `.sys` files are mutated by the Editor.
