# Mission: Fix Verification Desktop Runtime Detection v0.1

## Current observed failure

The real Tauri desktop app launches successfully:

    Running /Volumes/Work/dev/sys-editor/target/debug/SideX

The Verification view is registered and visible in the desktop UI.

However, opening Verification produces:

    PLATFORM_EXECUTION_ERROR:
    process execution requires the desktop runtime

The exact throw site is:

    src/vs/workbench/contrib/sys/browser/sysVerificationProviderService.ts

Current code:

    async run(command: string, args: string[], timeoutMs: number): Promise<ProcessResult> {
        if (!isTauri()) {
            throw new VerificationTransportError(
                'PLATFORM_EXECUTION_ERROR',
                'process execution requires the desktop runtime'
            );
        }

        ...
        id = await this.tasks.spawn({ command, args, shell: false });
        ...
    }

and the file imports:

    import { ISideXTaskService } from '../../../../platform/sidex/common/sidexTaskService.js';
    import { isTauri } from '../../../../sidex-bridge.js';

This is a false negative:

    real Tauri desktop process is running
    -> Verification view exists
    -> ISideXTaskService is injected
    -> isTauri() returns false
    -> live execution is blocked before task_spawn

## Mission

Fix this runtime integration bug without changing verification semantics.

Preferred design:

    capability/service availability
    > environment guessing by global/runtime heuristic

TaskProcessTransport already receives ISideXTaskService.

Therefore the live process boundary should attempt the actual capability instead of rejecting early because isTauri() guessed the runtime incorrectly.

Do not ask for approval between small fixes.

---

# Required first step

Inspect:

    src/vs/workbench/contrib/sys/browser/sysVerificationProviderService.ts
    src/vs/workbench/sidex-bridge.ts
    src/**/sidex-bridge*
    platform/sidex/common/sidexTaskService*

Determine exactly how isTauri() works and why it returns false in the real desktop window.

Report the root cause before or together with the fix.

Do not assume window.__TAURI__ exists.

---

# Preferred fix

If ISideXTaskService is a valid injected capability in both supported runtime shapes, remove the redundant early runtime heuristic:

    if (!isTauri()) {
        throw ...
    }

and remove the unused isTauri import.

Then allow:

    this.tasks.spawn({ command, args, shell: false })

to be the actual capability boundary.

Expected path:

    Verification view
      -> TaskProcessTransport.run
      -> ISideXTaskService.spawn
      -> Tauri task_spawn
      -> spec-code-sync
      -> verification.v0.1

If task execution is unavailable, map the actual task-service failure to an infrastructure error.

Do not preemptively fail based on an unreliable global check.

---

# Error classification

Preserve the existing infrastructure-vs-semantic boundary.

Runtime/process failures are infrastructure errors.

They must never become:

    CONFLICTED
    PARTIAL
    NOT_OBSERVED
    UNSUPPORTED

If spawn fails because execution is genuinely unavailable, return a bounded infrastructure error.

Do not silently fall back to fixture mode.

---

# Scope

Allowed:

- remove or replace the false-negative isTauri guard;
- improve runtime capability detection;
- improve the error mapping around task spawn;
- add focused tests;
- add temporary diagnostic logging if useful;
- remove the unused import.

Forbidden:

- changing verification.v0.1 semantics;
- changing comparator/recovery logic;
- changing B1/B2/B8 verdicts;
- changing the manifest;
- adding fixture fallback;
- bypassing ISideXTaskService with Node child_process;
- calling spec-code-sync directly from browser code;
- hard-coding macOS paths.

---

# TDD requirements

Add focused tests covering at least:

1. desktop-capable task service is allowed to spawn even when isTauri-style global detection would be false;
2. spawn success returns stdout/stderr/exit code normally;
3. spawn failure remains an infrastructure error;
4. live failure does not fall back to fixture;
5. timeout behavior remains unchanged;
6. stdout/stderr separation remains unchanged;
7. shell remains false;
8. existing UTF-8 transport behavior remains unchanged;
9. no semantic disposition is produced from runtime failure.

If removing isTauri makes the old test architecture simpler, prefer direct capability tests.

---

# Manual acceptance

After the fix:

    cd /Volumes/Work/dev/sys-editor
    npm run tauri dev

Open:

    SYS
      -> VERIFICATION

With:

    sys.verification.dataSource = live

    sys.verification.platformBinary =
      /Volumes/Work/dev/sys-platform/spec-code-sync/target/release/spec-code-sync

    sys.verification.manifestPath =
      /Volumes/Work/dev/sys-editor/examples/cinema-booking-verification/manifest.json

Then press Refresh.

The previous error must disappear:

    process execution requires the desktop runtime

Expected next result:

    either
      live rule list appears

    or
      a more specific real transport/configuration error from task_spawn/binary/manifest

The fix is successful only if execution reaches the real task-service boundary.

---

# Live success target

The strongest expected result is:

    Verification
      B1
      B2
      B3
      B8
      STATE_EFFECT

with live data from verification.v0.1.

At minimum, prove:

    task_spawn reached = YES

Do not claim full desktop product E2E in this mission.

That remains the responsibility of:

    DESKTOP_LIVE_WORKBENCH_SMOKE_V0_1

---

# Safety gates

Required:

    SILENT_FIXTURE_FALLBACK = 0
    UI_SEMANTIC_INFERENCE = 0
    PROSE_PARSING = 0
    SEMANTIC_CHANGES_REQUIRED = 0

No Booking-specific provider logic.

No hard-coded B-rule outcome.

---

# Success condition

Call success only if:

1. root cause of false-negative runtime detection is identified;
2. Verification no longer rejects the real Tauri desktop before task_spawn;
3. the real ISideXTaskService capability is exercised;
4. live execution reaches spec-code-sync or a genuine downstream process/configuration error;
5. existing process safety behavior remains intact;
6. focused tests pass;
7. no semantic changes were required.

On success report:

    VERIFICATION_DESKTOP_RUNTIME_DETECTION_FIXED

---

# Stop conditions

## SUCCESS

    VERIFICATION_DESKTOP_RUNTIME_DETECTION_FIXED

## TASK_SERVICE_REGISTRATION_GAP

If ISideXTaskService itself is not actually available in the desktop workbench process.

## TAURI_BRIDGE_GAP

If the Tauri bridge cannot invoke task_spawn despite the desktop app being active.

## STOP_UNSOUND_RUNTIME_FIX

If the only way to proceed would be:

- bypassing the task service;
- using fixture data;
- hard-coding platform paths;
- changing verification semantics.

---

# Required final report

RESULT:
VERIFICATION_DESKTOP_RUNTIME_DETECTION_FIXED |
TASK_SERVICE_REGISTRATION_GAP |
TAURI_BRIDGE_GAP |
STOP_UNSOUND_RUNTIME_FIX |
CHECKPOINT_REACHED

ROOT_CAUSE:
...

IS_TAURI_BEHAVIOR:
...

FIX:
...

TASK_SERVICE_BOUNDARY:
...

OLD_ERROR_REMOVED:
YES | NO

TASK_SPAWN_REACHED:
YES | NO

LIVE_PLATFORM_EXECUTION:
...

FIXTURE_FALLBACK:
0 | explain

SEMANTIC_CHANGES_REQUIRED:
0 | explain

TESTS:
...

MANUAL_TAURI_RESULT:
...

NEXT_STEP:
DESKTOP_LIVE_WORKBENCH_SMOKE_V0_1 | explain

Stop after the false-negative desktop runtime gate is removed and the real task execution boundary is reached.
