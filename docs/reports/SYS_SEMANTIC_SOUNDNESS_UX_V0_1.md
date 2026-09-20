# Sys Semantic Soundness UX v0.1 Report

## Result

`PLATFORM_API_GAP` — fixture UX is implemented; live structured soundness fields are not wired in this repository.

## Baseline and changes

The previous GUI exposed `KNOWN`, `UNKNOWN`, and `PARTIAL`, which could make parsed or partially recovered meaning look authoritative. The read model now carries explicit disposition, recovery, sync, eligibility, evidence references, fixture/live mode, and integration state. The workbench renders separate Governed Meaning, Unsupported Meaning, Unresolved Meaning, Recovered Source Meaning, Semantic Sync, Reviews, and Evidence sections.

Fixture scenarios F1-F6 are represented, including parsed-but-unsupported, confirmed-but-not-governed, partial recovery, and live contract gap.

## Acceptance

U1-U13, U15-U18 are covered structurally by the typed fixture/read-model tests and view data flow. U14 is represented by the `UNSUPPORTED_VERSION` contract state. U19/U20 and the real Tauri walkthrough remain pending in this environment. No Rust/Tauri integration files changed.

## Gaps

The live adapter still needs the platform `WorkspaceSnapshotV1` soundness fields and version validation. No semantic parsing, rewriting, or backend admission logic was added.

## Files changed

- `src/vs/workbench/contrib/sys/common/sysSemanticSnapshot.ts`
- `src/vs/workbench/contrib/sys/common/sysSemanticSnapshotFixture.ts`
- `src/vs/workbench/contrib/sys/common/test/sysSemanticSoundness.test.ts`
- `src/vs/workbench/contrib/sys/browser/sysSemanticSnapshotService.ts`
- `src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts`
- `docs/architecture/SYS_SEMANTIC_SOUNDNESS_UX_V0_1.md`
- `docs/reports/SYS_SEMANTIC_SOUNDNESS_UX_V0_1.md`

No non-Sys core files or unrelated dirty files were present.
