# Sys Semantic Workbench Shell v0.1 Verification

## Recommendation

**NARROW**

The implementation passes dependency restore, lint, production build, editor diagnostics, diff hygiene, and the deterministic Cinema walkthrough. A light-theme render could not be completed in the browser shell because the web runtime cannot persist `vscode-userdata` settings without the Tauri `invoke` bridge. The dark-theme render passed. No semantic logic was moved into the UI.

## Prior Blocker and Recovery

The prior verification attempt could not install dependencies because the workspace volume was nearly full while unpacking `monaco-editor`.

- Free space before cleanup: `3.3G`
- Safe cleanup performed:
  - removed the repository build output at `target/` (`1.8G`)
  - cleared the user npm cache (`2.1G` before cleanup)
- Free space after cleanup: `4.7G`
- Free space at final verification: `5.0G`
- No source, history, or unrelated user data was removed.

## Verification Gates

### V1 — Dependency installation

Command:

```text
npm ci
```

Result: **PASS**. The lockfile restore completed successfully. npm reported an existing Node engine warning for `eslint-visitor-keys` and 7 audit findings; neither blocked installation.

### V2 — TypeScript/ESLint

Command:

```text
npm run lint
```

Result: **PASS**, with zero errors and one pre-existing warning in `src/vs/workbench/contrib/sidexChat/browser/sidexChatService.ts:2038` (`enabledRaw` unused). No Sys file was reported.

### V3 — Production build

Command:

```text
npm run build
```

Result: **PASS**. Vite transformed 2,626 modules, emitted the production bundle, and completed the post-build step. Existing warnings covered missing optional `extensions/` content, dynamic Tauri imports, and large chunks.

### V4 — Focused Sys verification

The repository has no general test script and no existing focused Sys test runner. The implementation was verified through editor diagnostics and the running deterministic fixture-backed UI:

- Sys Activity Bar registration is present and visible.
- The typed service returns the deterministic Cinema snapshot.
- Summary shows `Cinema Booking`, `AVAILABLE`, `PARTIAL`, `PARTIAL`, unresolved count `2`, and review count `1`.
- Governed operation is `createBooking`.
- Unresolved intent is separately shown as `customer validation` and `status transition rules`.
- Semantic Sync shows five `KNOWN / UNKNOWN / PARTIAL` items in deterministic fixture order.
- Hall consistency review shows `seat.hallName == showtime.hallName`, recovered `UNKNOWN`, and `PARTIAL / UNKNOWN`.
- Evidence shows source paths `6`, fully recovered guards `0`, and false greens `0`.
- The view only renders service-provided values; it does not infer semantic states or parse source/CLI data.

Result: **PASS for available focused verification**.

### V5 — Existing workbench smoke checks

The production build and dev startup exercised workbench contribution loading. The running app displayed the `Sys` Activity Bar entry and opened the Semantic Workbench view without a registration or startup failure.

Result: **PASS for available smoke coverage**.

The browser console also reported pre-existing browser-mode failures reading and writing `vscode-userdata` through an unavailable Tauri `invoke` bridge. These affected persistence and theme switching, not Sys snapshot rendering.

### V6 — Rust checks

Rust verification is not applicable to this milestone. No Rust or Tauri source files were changed.

### V7 — Diff hygiene

Command:

```text
git diff --check
```

Result: **PASS**.

### V8 — Repository cleanliness

Final command:

```text
git status --short
```

Result:

```text
 M src/vs/workbench/workbench.common.main.ts
?? src/vs/workbench/contrib/sys/
```

These are the intended milestone files. No unrelated dirty files or generated files were left tracked or untracked by verification.

## Manual Cinema Walkthrough

The normal development command was launched with `npm run dev` at `http://localhost:1420/`.

The GUI confirmed:

1. Governed operation: `createBooking`
2. Unresolved intent: `customer validation`; `status transition rules`
3. Hall consistency is not proven wrong: recovered side is `PARTIAL / UNKNOWN`
4. Governed hall rule: `seat.hallName == showtime.hallName`
5. Recovered source paths: `6`
6. Fully recovered guards: `0`
7. False greens: `0`

The dark `Default Dark`/`Dark Modern` workbench presentation remained readable, and unknown/partial states were presented with non-error semantic styling. The Sys stylesheet uses VS Code theme variables rather than hard-coded light or dark colors.

A light-theme render was attempted through `Preferences: Color Theme`, but the browser runtime could not persist `vscode-userdata:/User/settings.json` because `__TAURI_INTERNALS__.invoke` is unavailable. The light-theme gate therefore remains environment-limited and is the reason for the `NARROW` recommendation.

## Architecture Re-check

The v0.1 boundary remains intact:

```text
UI -> ISysSemanticSnapshotService -> deterministic typed fixture
```

The view does not infer hall consistency, derive unresolved intent, parse Java, parse Formal Spec, classify verification, or reconstruct semantics from CLI output. Sys Editor remains a presentation shell; Sys Platform remains the future semantic authority.

## Defects and Fixes

No verification-discovered source defects remained after the existing implementation was checked. The verification environment required only safe build/cache cleanup to restore dependency installation.
