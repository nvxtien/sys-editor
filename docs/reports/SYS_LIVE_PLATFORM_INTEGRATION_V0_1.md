# Sys Live Platform Integration v0.1 Report

## Result

`PLATFORM_API_GAP`

Implementation was intentionally stopped before adding a shadow semantic model to Sys Editor.

## Surfaces inspected

The adjacent `sys-platform` repository was inspected directly. The product CLI currently provides:

- `sys status --json`
- `sys intent --json`
- `sys proposal show --json`
- `sys intent answer ... --json`

The transfer-funds pilot was used to measure actual output. JSON was emitted successfully and included project identity, requirement/version, sync state, unresolved count/items, proposal verification, and proposal summary/diff data.

## Available vs missing fields

Available: project identity, requirement id, governed version, target file, last sync label, unresolved intent register, pending proposal metadata, verification state, and proposal evidence/diff fields.

Missing: governed operation/rule list, recovered meaning state, semantic sync item rows, review packet, review-attention count, evidence summary/source references, confirmed intent details in the status surface, and one versioned aggregate schema for the Workbench.

## Transport decision

Structured JSON process transport is viable in principle. Human-readable output parsing is rejected. A complete live adapter is not sound with the current partial surfaces because filling missing fields would require Editor-side semantic inference or undocumented file coupling.

## Writes

`sys intent answer --json` exists, but the current Editor action model also includes replacement and confirmation semantics that are not yet exposed as a documented Editor-safe write contract. No live write was wired.

## Verification

The pilot JSON commands were executed successfully. No Editor code was changed and no Tauri walkthrough was claimed. Existing Sys Editor tests remain unaffected.

## Recommendation

`PLATFORM_API_GAP`: add and document a versioned aggregate read contract in Sys Platform, then implement the Editor adapter with schema validation, explicit `NOT_SYS_PROJECT`/`ERROR` states, refresh, and read-after-write behavior.
