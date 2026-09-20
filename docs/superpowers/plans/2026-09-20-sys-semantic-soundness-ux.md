# Sys Semantic Soundness UX v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve backend soundness distinctions in the Sys Editor without adding semantic authority.

**Architecture:** Extend the existing common snapshot read model, keep deterministic fixture data separate from live integration gaps, and render the typed projection in the existing Semantic Workbench view.

**Tech Stack:** TypeScript, VS Code workbench DOM helpers, Node test runner.

**Spec:** `docs/prompts/IMPLEMENT_SYS_SEMANTIC_SOUNDNESS_UX_V0_1.md`

## Global Constraints

- Do not invent backend semantics or parse source text in the editor.
- Unsupported and unresolved must remain separate from governed exact.
- Live missing fields must show `PLATFORM_API_GAP`, never fixture fallback.
- Keep changes under `src/vs/workbench/contrib/sys/` plus required docs.

## Review Focus

- Parsed-but-unsupported stays unsupported — fixture test.
- Confirmed human intent stays not governed — fixture test.
- Unsupported sync is not eligible — fixture test.
- Live API gap has no semantic items — fixture test.
- Recovery absence states remain explicit in the model — fixture test.

### Task 1: Typed read model and fixtures

- [x] Add explicit disposition, recovery, sync, integration, evidence, and eligibility fields.
- [x] Add F1-F6 fixture scenarios and live gap snapshot.
- [x] Add focused structural tests.

### Task 2: Workbench projection

- [x] Render separate governed, unsupported, unresolved, recovered, sync, review, and evidence sections.
- [x] Keep intent actions separate from governance state.

### Task 3: Documentation

- [x] Record architecture boundary, backend gap, acceptance status, and changed files.
