# Behavior Scenarios Point-to-Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Formal Spec's real, governed Gherkin (`behavior`) drive the review page instead of an ephemeral LLM preview, and add a CodeLens on each `Scenario:`/`Scenario Outline:` line that calls sys-platform's `system-ontology candidates` command and lets the user jump to a candidate function via a Quick Pick.

**Architecture:** `SysFormalSpec` gains `behavior`/`thenDecisions` fields so they survive parse/reparse instead of being silently dropped. The review-building call site prefers real `behavior` over the existing LLM-fetched preview, keeping the preview only as a fallback. A new `readCandidates` function in `sysOntology.ts` mirrors the already-working `readGoverned` subprocess pattern. A new CodeLens provider scans the generated review Markdown for Gherkin scenario lines and a new command wires the click through to a Quick Pick of real candidates.

**Tech Stack:** TypeScript, VS Code extension APIs (`languages.registerCodeLensProvider`, `CommandsRegistry`), `node:test` (existing test runner in this codebase).

**Spec:** `docs/superpowers/specs/2026-09-28-behavior-scenarios-point-to-code-design.md`

## Global Constraints

- `parseFormalSpec` must not throw on records that predate `behavior`/`thenDecisions` — both fields stay optional, same pattern as `entities`/`relationships`/`kind`.
- The ephemeral LLM-generated scenario preview (`requestFormalSpecScenarios`) stays as a fallback — never removed — used only when `behavior` is absent or blank.
- A scenario preview shown via the fallback must be visibly marked as a preview, never presented as the governed `behavior`.
- The CodeLens/command path must never crash the editor on missing config, missing platform root, or a subprocess failure — always degrade to an information message.
- Clicking a candidate in the Quick Pick opens that file; a candidate with `thenObserved: true` is never shown with a stronger affordance than the existing "not checked" plain-text voice used elsewhere in this view (no green checkmark).
- sidex-server's own prompt/schema (a separate repo) is out of scope — nothing in this plan waits on it; the plan makes the editor capable of holding `behavior`/`thenDecisions` the moment sidex-server starts sending it.

## Review Focus

- A Formal Spec with `behavior` present but whitespace-only — must fall back to the LLM preview, not render an empty `## Scenarios` section as if real.
- A review Markdown for a `DATA_MODEL`/`RELATIONSHIP` kind (no `## Scenarios` section at all) — the CodeLens provider must register zero lenses, not error scanning a document with no fenced Gherkin block.
- `platformRoot` not configured when `sys.pointToCode` runs — must show an information message directing the user to set it, never throw.
- Two `Scenario:` lines with the identical name inside one Feature — the command matches the first equal `scenario` entry from `system-ontology candidates`'s output; this mirrors an already-accepted, documented limitation on the sys-platform side for the same reason, not a new gap to solve here.
- A `system-ontology candidates` call that fails (binary missing, bad JSON, non-zero exit) — must show the failure reason as an information message, matching `readGoverned`'s existing `UNAVAILABLE` handling, never a raw unhandled promise rejection.

---

### Task 1: `SysFormalSpec` gains `behavior`/`thenDecisions`, parsed and validated

**Files:**
- Modify: `src/vs/workbench/contrib/sys/common/sysFormalSpec.ts`
- Test: `src/vs/workbench/contrib/sys/common/test/sysFormalSpec.test.ts`

**Interfaces:**
- Produces: `SysFormalSpecThenDecision { readonly scenario: string; readonly then: { readonly field: string; readonly becomes: string; readonly provenance: SysFormalSpecProvenance } }`; `SysFormalSpec.behavior?: string`; `SysFormalSpec.thenDecisions?: readonly SysFormalSpecThenDecision[]`. Consumed by Task 3 (review rendering) and Task 5 (the point-to-code command, indirectly via the already-approved `operation`).

- [ ] **Step 1: Write the failing tests**

Append to `src/vs/workbench/contrib/sys/common/test/sysFormalSpec.test.ts`:
```typescript
test('behavior and thenDecisions are absent by default and parse when present', () => {
	const withoutThem = parseFormalSpec({
		version: 1, requirementId: 'REQ-001', kind: 'OPERATION_RULE',
		intentStatement: { value: 'x', provenance: 'SPECIFIED' }, scope: { value: 'x', provenance: 'SPECIFIED' },
		operation: { value: 'cancel order', provenance: 'SPECIFIED' },
		inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: []
	}, 'REQ-001');
	assert.equal(withoutThem.behavior, undefined);
	assert.equal(withoutThem.thenDecisions, undefined);

	const withThem = parseFormalSpec({
		version: 1, requirementId: 'REQ-001', kind: 'OPERATION_RULE',
		intentStatement: { value: 'x', provenance: 'SPECIFIED' }, scope: { value: 'x', provenance: 'SPECIFIED' },
		operation: { value: 'cancel order', provenance: 'SPECIFIED' },
		inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: [],
		behavior: 'Feature: Order\n\n  @concept:Order\n  Scenario: Cancel order\n    Given a thing\n    When it happens\n    Then it changes\n',
		thenDecisions: [{ scenario: 'Cancel order', then: { field: 'status', becomes: 'CANCELLED', provenance: 'SPECIFIED' } }]
	}, 'REQ-001');
	assert.match(withThem.behavior ?? '', /Feature: Order/);
	assert.equal(withThem.thenDecisions?.[0].scenario, 'Cancel order');
	assert.equal(withThem.thenDecisions?.[0].then.field, 'status');
	assert.equal(withThem.thenDecisions?.[0].then.becomes, 'CANCELLED');
	assert.equal(withThem.thenDecisions?.[0].then.provenance, 'SPECIFIED');
});

test('a malformed thenDecisions entry is rejected, never half-read', () => {
	const base = {
		version: 1, requirementId: 'REQ-001', kind: 'OPERATION_RULE',
		intentStatement: { value: 'x', provenance: 'SPECIFIED' }, scope: { value: 'x', provenance: 'SPECIFIED' },
		operation: { value: 'cancel order', provenance: 'SPECIFIED' },
		inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: []
	};
	assert.throws(() => parseFormalSpec({ ...base, thenDecisions: 'not a list' }, 'REQ-001'), /invalid thenDecisions/);
	assert.throws(() => parseFormalSpec({ ...base, thenDecisions: [{ scenario: '' }] }, 'REQ-001'), /invalid thenDecisions/);
	assert.throws(() => parseFormalSpec({ ...base, thenDecisions: [{ scenario: 'x', then: { field: 'f', becomes: 'v' } }] }, 'REQ-001'), /invalid thenDecisions/);
	assert.throws(() => parseFormalSpec({ ...base, thenDecisions: [{ scenario: 'x', then: { field: 'f', becomes: 'v', provenance: 'GUESSED' } }] }, 'REQ-001'), /invalid thenDecisions/);
});

test('behavior must be a string when present', () => {
	const base = {
		version: 1, requirementId: 'REQ-001', kind: 'OPERATION_RULE',
		intentStatement: { value: 'x', provenance: 'SPECIFIED' }, scope: { value: 'x', provenance: 'SPECIFIED' },
		operation: { value: 'cancel order', provenance: 'SPECIFIED' },
		inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: []
	};
	assert.throws(() => parseFormalSpec({ ...base, behavior: 42 }, 'REQ-001'), /invalid behavior/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types --test src/vs/workbench/contrib/sys/common/test/sysFormalSpec.test.ts` (or whatever test command this repo's `package.json` defines for this test runner — check `npm test -- --help` or the repo's existing CI script if the bare `node --test` invocation above doesn't resolve TypeScript; follow the exact command the other `sysFormalSpec*.test.ts` files are already run with in this repo's test setup)
Expected: FAIL — `behavior`/`thenDecisions` are not recognised, so the new assertions fail (`undefined` mismatches, or the malformed-input tests don't throw with the expected message since the fields are currently ignored rather than validated).

- [ ] **Step 3: Implement**

In `src/vs/workbench/contrib/sys/common/sysFormalSpec.ts`, add after the `SysFormalSpecEntity` interface:
```typescript
export interface SysFormalSpecThenDecision {
	readonly scenario: string;
	readonly then: {
		readonly field: string;
		readonly becomes: string;
		readonly provenance: SysFormalSpecProvenance;
	};
}
```

Add to the `SysFormalSpec` interface, after `readonly unknowns: readonly string[];`:
```typescript
	/** Real Gherkin text, governed once confirmed. Absent in records written before this existed. */
	readonly behavior?: string;
	/** A scenario's optional structured Then, keyed by the scenario's own name. */
	readonly thenDecisions?: readonly SysFormalSpecThenDecision[];
```

Add a validator function, near `entities()`:
```typescript
function thenDecisions(value: unknown): readonly SysFormalSpecThenDecision[] {
	if (!Array.isArray(value)) { throw new Error('Formal Spec has invalid thenDecisions'); }
	return value.map(entry => {
		const raw = entry as { scenario?: unknown; then?: unknown };
		if (!raw || typeof raw !== 'object' || typeof raw.scenario !== 'string' || !raw.scenario.trim()) {
			throw new Error('Formal Spec has invalid thenDecisions');
		}
		const then = raw.then as { field?: unknown; becomes?: unknown; provenance?: unknown };
		if (!then || typeof then !== 'object' || typeof then.field !== 'string' || !then.field.trim()
			|| typeof then.becomes !== 'string' || !provenance.has(then.provenance as SysFormalSpecProvenance)) {
			throw new Error('Formal Spec has invalid thenDecisions');
		}
		return { scenario: raw.scenario, then: { field: then.field, becomes: then.becomes, provenance: then.provenance as SysFormalSpecProvenance } };
	});
}
```

In `parseFormalSpec`, after the `unknowns` field validation block and before the `return`, add:
```typescript
	if (raw.behavior !== undefined && raw.behavior !== null && typeof raw.behavior !== 'string') {
		throw new Error('Formal Spec has an invalid behavior');
	}
```
Then in the returned object literal, after `unknowns: (raw.unknowns as readonly string[] | undefined) ?? [],`, add:
```typescript
		...(typeof raw.behavior === 'string' ? { behavior: raw.behavior } : {}),
		...(raw.thenDecisions === undefined ? {} : { thenDecisions: thenDecisions(raw.thenDecisions) }),
```

- [ ] **Step 4: Run to verify it passes**

Run: the same test command as Step 2.
Expected: all tests in `sysFormalSpec.test.ts` pass, including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/vs/workbench/contrib/sys/common/sysFormalSpec.ts src/vs/workbench/contrib/sys/common/test/sysFormalSpec.test.ts
git commit -m "feat: parse behavior and thenDecisions on a Formal Spec"
```

---

### Task 2: `readCandidates` — mirror `readGoverned` for the new `candidates` command

**Files:**
- Modify: `src/vs/workbench/contrib/sys/common/sysOntology.ts`
- Test: `src/vs/workbench/contrib/sys/common/test/sysOntology.test.ts`

**Interfaces:**
- Consumes: `VerificationTransport['run']` (existing), `systemOntologyBinary` (existing, unchanged).
- Produces: `SysCandidateFunction`, `SysScenarioCandidates`, `SysCandidatesResult`, `SysCandidatesReadResult`, `readCandidates(transport, platformRoot, workspace, operation, timeoutMs?)`. Consumed by Task 5's `sys.pointToCode` command.

- [ ] **Step 1: Write the failing tests**

Check `src/vs/workbench/contrib/sys/common/test/sysOntology.test.ts` first for its existing test-double transport pattern (it already tests `readGoverned` against a fake `transport.run`), then append tests in the same style:
```typescript
test('readCandidates reads a successful scenarios list', async () => {
	const transport = { run: async () => ({ exitCode: 0, stdout: JSON.stringify({ scenarios: [{ scenario: 'Cancel order', candidates: [{ name: 'Order.cancel', file: 'Order.java', parameters: [], location: null, thenObserved: true }] }] }), stderr: '' }) };
	const result = await readCandidates(transport, '/platform', '/workspace', 'cancel order');
	assert.equal(result.kind, 'READ');
	if (result.kind === 'READ') {
		assert.equal(result.result.scenarios[0].scenario, 'Cancel order');
		assert.equal(result.result.scenarios[0].candidates[0].name, 'Order.cancel');
		assert.equal(result.result.scenarios[0].candidates[0].thenObserved, true);
	}
});

test('readCandidates reports UNAVAILABLE on a non-zero exit', async () => {
	const transport = { run: async () => ({ exitCode: 1, stdout: '', stderr: 'boom' }) };
	const result = await readCandidates(transport, '/platform', '/workspace', 'cancel order');
	assert.equal(result.kind, 'UNAVAILABLE');
	if (result.kind === 'UNAVAILABLE') { assert.match(result.reason, /boom/); }
});

test('readCandidates reports UNAVAILABLE on unreadable output', async () => {
	const transport = { run: async () => ({ exitCode: 0, stdout: 'not json', stderr: '' }) };
	const result = await readCandidates(transport, '/platform', '/workspace', 'cancel order');
	assert.equal(result.kind, 'UNAVAILABLE');
});

test('readCandidates passes the operation as its own argument, not concatenated', async () => {
	let capturedArgs: readonly string[] = [];
	const transport = { run: async (_bin: string, args: readonly string[]) => { capturedArgs = args; return { exitCode: 0, stdout: JSON.stringify({ scenarios: [] }), stderr: '' }; } };
	await readCandidates(transport, '/platform', '/workspace', 'cancel order');
	assert.deepEqual(capturedArgs, ['candidates', '/workspace', 'cancel order']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: the same test command Task 1 used, targeted at `sysOntology.test.ts`.
Expected: FAIL to compile — `readCandidates` does not exist.

- [ ] **Step 3: Implement**

In `src/vs/workbench/contrib/sys/common/sysOntology.ts`, add after `SysGovernedResult`'s definition:
```typescript
export interface SysCandidateFunction {
	readonly name: string;
	readonly file: string;
	readonly parameters: readonly (readonly [string, string])[];
	readonly location: unknown;
	readonly thenObserved?: boolean;
}

export interface SysScenarioCandidates {
	readonly scenario: string;
	readonly candidates: readonly SysCandidateFunction[];
	/** Present when this scenario's own candidate search came up empty — why, not just that. */
	readonly reason?: string;
}

export interface SysCandidatesResult {
	readonly scenarios: readonly SysScenarioCandidates[];
	/** Present when no scenario at all governs the requested operation. */
	readonly reason?: string;
}

export type SysCandidatesReadResult = { readonly kind: 'READ'; readonly result: SysCandidatesResult } | { readonly kind: 'UNAVAILABLE'; readonly reason: string };

/**
 * Candidate functions for one operation's scenarios — real declarations, narrowed by class and
 * type, never a claim about which one is right. Mirrors `readGoverned`'s shape exactly: every
 * failure yields UNAVAILABLE with a reason, never a throw.
 */
export async function readCandidates(transport: Pick<VerificationTransport, 'run'>, platformRoot: string, workspace: string, operation: string, timeoutMs = 30000): Promise<SysCandidatesReadResult> {
	let result;
	try {
		result = await transport.run(systemOntologyBinary(platformRoot), ['candidates', workspace, operation], timeoutMs);
	} catch (error) {
		return { kind: 'UNAVAILABLE', reason: error instanceof Error ? error.message : String(error) };
	}
	if (result.exitCode !== 0) {
		return { kind: 'UNAVAILABLE', reason: result.stderr.trim().slice(0, 300) || `exit ${result.exitCode}` };
	}
	try {
		const parsed = JSON.parse(result.stdout) as SysCandidatesResult;
		if (!Array.isArray(parsed.scenarios)) { throw new Error('no scenarios array'); }
		return { kind: 'READ', result: parsed };
	} catch (error) {
		return { kind: 'UNAVAILABLE', reason: `system-ontology returned something unreadable: ${error instanceof Error ? error.message : String(error)}` };
	}
}
```

- [ ] **Step 4: Run to verify it passes**

Run: the same test command as Step 2.
Expected: all 4 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/vs/workbench/contrib/sys/common/sysOntology.ts src/vs/workbench/contrib/sys/common/test/sysOntology.test.ts
git commit -m "feat: read candidate functions from system-ontology candidates"
```

---

### Task 3: Review page prefers real `behavior`, falls back to the LLM preview with a notice

**Files:**
- Modify: `src/vs/workbench/contrib/sys/common/sysFormalSpecReview.ts`
- Modify: `src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts`
- Test: `src/vs/workbench/contrib/sys/common/test/sysFormalSpecReview.test.ts`

**Interfaces:**
- Consumes: `record.draft.behavior` (Task 1).
- Produces: `renderFormalSpecReview(record, capability, scenarios?, scenariosArePreview?)` — the extra boolean parameter, defaulting to `false`, is consumed only inside `scenarioSection`.

- [ ] **Step 1: Write the failing tests**

Append to `src/vs/workbench/contrib/sys/common/test/sysFormalSpecReview.test.ts`:
```typescript
test('a preview scenario is marked as a preview, not presented as governed', () => {
	const text = renderFormalSpecReview(record(), undefined, 'Feature: X\n\n  Scenario: Y\n    Given a\n    When b\n    Then c\n', true);
	assert.ok(text.includes('⚠ preview only — not yet part of the confirmed Formal Spec'));
});

test('real behavior text carries no preview notice', () => {
	const text = renderFormalSpecReview(record(), undefined, 'Feature: X\n\n  Scenario: Y\n    Given a\n    When b\n    Then c\n', false);
	assert.ok(!text.includes('preview only'));
	assert.ok(text.includes('Feature: X'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: the same test command as Task 1, targeted at `sysFormalSpecReview.test.ts`.
Expected: FAIL — `renderFormalSpecReview` does not accept a 4th argument yet (TypeScript compile error), or the notice text is never produced.

- [ ] **Step 3: Implement, in `sysFormalSpecReview.ts`**

Replace:
```typescript
function scenarioSection(gherkin: string): string[] {
	return ['## Scenarios', '', '```gherkin', gherkin.trimEnd(), '```', ''];
}
```
with:
```typescript
function scenarioSection(gherkin: string, isPreview: boolean): string[] {
	return [
		'## Scenarios',
		'',
		...(isPreview ? ['⚠ preview only — not yet part of the confirmed Formal Spec', ''] : []),
		'```gherkin', gherkin.trimEnd(), '```', ''
	];
}
```

Change the `renderFormalSpecReview` signature from:
```typescript
export function renderFormalSpecReview(record: SysFormalSpecRecord, capability: SysFormalizationCapability | undefined, scenarios?: string): string {
```
to:
```typescript
export function renderFormalSpecReview(record: SysFormalSpecRecord, capability: SysFormalizationCapability | undefined, scenarios?: string, scenariosArePreview = false): string {
```
and change:
```typescript
	const scenarioLines = scenarios?.trim() ? scenarioSection(scenarios) : [];
```
to:
```typescript
	const scenarioLines = scenarios?.trim() ? scenarioSection(scenarios, scenariosArePreview) : [];
```

- [ ] **Step 4: Run to verify it passes**

Run: the same test command as Step 2.
Expected: all tests in `sysFormalSpecReview.test.ts` pass, including the 2 new ones. Every pre-existing test that calls `renderFormalSpecReview(record(), undefined)` (no `scenarios` argument) is unaffected — the new parameter is optional and defaults to `false`, and `scenarios` is still `undefined` there, so `scenarioLines` stays `[]`.

- [ ] **Step 5: Wire the call site, in `sysSemanticWorkbenchView.ts`**

Replace the `_scenariosFor` method:
```typescript
	private async _scenariosFor(id: string, httpUrl?: string): Promise<string | undefined> {
		const model = this.sidexChatService.serverModel;
		if (!model) { return undefined; }
		try {
			const record = await this.projectService.readFormalSpec(id);
			if (!record) { return undefined; }
			if (httpUrl === undefined) {
				const configuredServerUrl = this.configurationService.getValue<string>('sidex.chat.serverUrl');
				const endpoint = configuredServerUrl?.trim() ? await resolveServerEndpoint() : await waitForServerEndpoint();
				if (!endpoint.running && !configuredServerUrl?.trim()) { return undefined; }
				httpUrl = serverHttpUrl(configuredServerUrl);
			}
			return await requestFormalSpecScenarios(httpUrl, model, serializeFormalSpec(record.draft));
		} catch {
			return undefined;
		}
	}
```
with:
```typescript
	/**
	 * Real `behavior` first — it is governed, already stored, and needs no network call. Only when
	 * a draft has none does this fall back to the LLM-generated preview, so a Formal Spec written
	 * before `behavior` existed still gets a review page with scenarios on it.
	 */
	private async _scenariosFor(id: string, httpUrl?: string): Promise<{ readonly text: string; readonly isPreview: boolean } | undefined> {
		const record = await this.projectService.readFormalSpec(id);
		if (!record) { return undefined; }
		if (record.draft.behavior?.trim()) { return { text: record.draft.behavior, isPreview: false }; }

		const model = this.sidexChatService.serverModel;
		if (!model) { return undefined; }
		try {
			if (httpUrl === undefined) {
				const configuredServerUrl = this.configurationService.getValue<string>('sidex.chat.serverUrl');
				const endpoint = configuredServerUrl?.trim() ? await resolveServerEndpoint() : await waitForServerEndpoint();
				if (!endpoint.running && !configuredServerUrl?.trim()) { return undefined; }
				httpUrl = serverHttpUrl(configuredServerUrl);
			}
			const preview = await requestFormalSpecScenarios(httpUrl, model, serializeFormalSpec(record.draft));
			return preview ? { text: preview, isPreview: true } : undefined;
		} catch {
			return undefined;
		}
	}
```
Update the caller (around the existing line `const scenarios = await this._scenariosFor(id, httpUrl);` / `await this.editorService.openEditor({ resource: await this.projectService.writeFormalSpecReview(id, scenarios) });`) to:
```typescript
			const scenarios = await this._scenariosFor(id, httpUrl);
			await this.editorService.openEditor({ resource: await this.projectService.writeFormalSpecReview(id, scenarios?.text, scenarios?.isPreview) });
```
And update `writeFormalSpecReview`'s signature in `sysProjectService.ts` (both the interface declaration at line 36 and the implementation at line 141) from:
```typescript
	writeFormalSpecReview(id: string, scenarios?: string): Promise<URI>;
	// ...
	async writeFormalSpecReview(id: string, scenarios?: string): Promise<URI> {
		const record = await this.readFormalSpec(id);
		if (!record) { throw new Error('Formal Spec has not been normalized yet.'); }
		const folder = URI.joinPath(this.folders()[0], '.sys', 'intents');
		const resource = URI.joinPath(folder, `${id}.intent.review.md`);
		await this.files.createFolder(folder);
		await this.files.writeFile(resource, VSBuffer.fromString(renderFormalSpecReview(record, await this.formalizationCapability(id), scenarios)));
		return resource;
	}
```
to:
```typescript
	writeFormalSpecReview(id: string, scenarios?: string, scenariosArePreview?: boolean): Promise<URI>;
	// ...
	async writeFormalSpecReview(id: string, scenarios?: string, scenariosArePreview = false): Promise<URI> {
		const record = await this.readFormalSpec(id);
		if (!record) { throw new Error('Formal Spec has not been normalized yet.'); }
		const folder = URI.joinPath(this.folders()[0], '.sys', 'intents');
		const resource = URI.joinPath(folder, `${id}.intent.review.md`);
		await this.files.createFolder(folder);
		await this.files.writeFile(resource, VSBuffer.fromString(renderFormalSpecReview(record, await this.formalizationCapability(id), scenarios, scenariosArePreview)));
		return resource;
	}
```

- [ ] **Step 6: Run the whole package's test suite**

Run: the repo's full test command for this contrib folder (whatever `npm test` or equivalent runs across `src/vs/workbench/contrib/sys/common/test/`).
Expected: all tests pass.

- [ ] **Step 7: Compile check**

Run: this repo's TypeScript compile/build step (e.g. `npm run compile` or equivalent — check `package.json` scripts).
Expected: no type errors. (`writeFormalSpecReview`'s two call sites — the one just changed and any others — must both still type-check with the new optional third parameter.)

- [ ] **Step 8: Commit**

```bash
git add src/vs/workbench/contrib/sys/common/sysFormalSpecReview.ts src/vs/workbench/contrib/sys/common/test/sysFormalSpecReview.test.ts src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts src/vs/workbench/contrib/sys/browser/sysProjectService.ts
git commit -m "feat: prefer real behavior over the LLM scenario preview, mark preview when used"
```

---

### Task 4: CodeLens provider for Gherkin scenario lines

**Files:**
- Create: `src/vs/workbench/contrib/sys/browser/sysBehaviorCodeLensProvider.ts`
- Test: `src/vs/workbench/contrib/sys/common/test/sysBehaviorCodeLensScan.test.ts`

**Interfaces:**
- Produces: `scanGherkinScenarioLines(text: string): readonly { readonly line: number; readonly keyword: string; readonly scenarioName: string }[]` — a pure function, unit-testable without any VS Code API, plus `SysBehaviorCodeLensProvider implements languages.CodeLensProvider` that wraps it. Consumed by Task 5's registration in `sys.contribution.ts`.

- [ ] **Step 1: Write the failing tests for the pure scanner**

Create `src/vs/workbench/contrib/sys/common/test/sysBehaviorCodeLensScan.test.ts`:
```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanGherkinScenarioLines } from '../../browser/sysBehaviorCodeLensProvider.js';

test('finds a Scenario line inside a fenced gherkin block', () => {
	const text = [
		'# REQ-001 — Formal Spec review',
		'',
		'## Scenarios',
		'',
		'```gherkin',
		'Feature: Order lifecycle',
		'',
		'  Scenario: Cancel order clears its status',
		'    Given a thing',
		'    When it happens',
		'    Then it changes',
		'```',
		''
	].join('\n');
	const found = scanGherkinScenarioLines(text);
	assert.equal(found.length, 1);
	assert.equal(found[0].keyword, 'Scenario');
	assert.equal(found[0].scenarioName, 'Cancel order clears its status');
	assert.equal(text.split('\n')[found[0].line], '  Scenario: Cancel order clears its status');
});

test('finds a Scenario Outline line too, and multiple scenarios', () => {
	const text = ['```gherkin', 'Feature: X', '', '  Scenario: One', '  Scenario Outline: Two', '```'].join('\n');
	const found = scanGherkinScenarioLines(text);
	assert.equal(found.length, 2);
	assert.equal(found[0].keyword, 'Scenario');
	assert.equal(found[1].keyword, 'Scenario Outline');
	assert.equal(found[1].scenarioName, 'Two');
});

test('ignores a Scenario-looking line outside any fenced gherkin block', () => {
	const text = ['## Scenarios', '', 'Not fenced: Scenario: This should not count', '', '```gherkin', 'Feature: X', '```'].join('\n');
	assert.deepEqual(scanGherkinScenarioLines(text), []);
});

test('a document with no fenced gherkin block finds nothing, does not error', () => {
	assert.deepEqual(scanGherkinScenarioLines('# REQ-002 — Formal Spec review\n\n## Entities\n\n### Category\n'), []);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: the same test command as Task 1, targeted at `sysBehaviorCodeLensScan.test.ts`.
Expected: FAIL to compile — `sysBehaviorCodeLensProvider.ts` does not exist.

- [ ] **Step 3: Implement**

Create `src/vs/workbench/contrib/sys/browser/sysBehaviorCodeLensProvider.ts`. This codebase has no
extension-host-style `languages.registerCodeLensProvider` call anywhere internal to itself — that
API is only used by the extension host bridge (`vs/workbench/api/**`). The real internal pattern,
confirmed by reading `src/vs/workbench/contrib/extensions/browser/tauriExtensionHost.contribution.ts`
(a sibling contribution in this same codebase, lines 1358-1364) and
`src/vs/editor/common/services/languageFeatures.ts:77`, is `ILanguageFeaturesService.codeLensProvider`
(a `LanguageFeatureRegistry<CodeLensProvider>`, `register(selector, provider): IDisposable` at
`src/vs/editor/common/languageFeatureRegistry.ts:69`), and `CodeLensProvider`/`CodeLens`/`CodeLensList`
come from `src/vs/editor/common/languages.ts:2571-2586`, not from any `editor.api.js`-style import.
This file defines the pure scanner and the plain provider class only; Task 5 wires the actual
`ILanguageFeaturesService.codeLensProvider.register(...)` call inside a proper DI-constructed
contribution class, since registration needs constructor injection and a tracked `IDisposable` —
a provider class can be instantiated and handed to `.register()` without needing DI itself:
```typescript
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { CodeLens, CodeLensList, CodeLensProvider } from '../../../../editor/common/languages.js';

/**
 * Real Gherkin scenario lines, found inside a fenced ```gherkin block only. A `Scenario:` line
 * anywhere else in the review Markdown (prose mentioning the word, an example in a comment) must
 * never grow a lens — the fence is the only signal this scanner trusts.
 */
export function scanGherkinScenarioLines(text: string): readonly { readonly line: number; readonly keyword: string; readonly scenarioName: string }[] {
	const lines = text.split('\n');
	const found: { line: number; keyword: string; scenarioName: string }[] = [];
	let inFence = false;
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		if (raw.trim() === '```gherkin') { inFence = true; continue; }
		if (inFence && raw.trim() === '```') { inFence = false; continue; }
		if (!inFence) { continue; }
		const match = /^\s*(Scenario Outline|Scenario):\s*(.+)$/.exec(raw);
		if (match) { found.push({ line: i, keyword: match[1], scenarioName: match[2].trim() }); }
	}
	return found;
}

/**
 * Reads the requirement id from the review page's own first line — the same format
 * `renderFormalSpecReview` always emits (`# {id} — Formal Spec review`) — rather than guessing it
 * from the file name, which is an implementation detail of `writeFormalSpecReview` this provider
 * should not need to know.
 */
function requirementIdOf(text: string): string | undefined {
	const match = /^#\s+(\S+)\s+—\s+Formal Spec review/.exec(text.split('\n', 1)[0] ?? '');
	return match?.[1];
}

export class SysBehaviorCodeLensProvider implements CodeLensProvider {
	provideCodeLenses(model: ITextModel, _token: CancellationToken): CodeLensList {
		const text = model.getValue();
		const requirementId = requirementIdOf(text);
		if (!requirementId) { return { lenses: [] }; }
		const lenses: CodeLens[] = scanGherkinScenarioLines(text).map(found => ({
			range: { startLineNumber: found.line + 1, startColumn: 1, endLineNumber: found.line + 1, endColumn: 1 },
			command: {
				id: 'sys.pointToCode',
				title: 'Point to code',
				arguments: [requirementId, found.scenarioName]
			}
		}));
		return { lenses };
	}
}
```

(`CodeLensList.dispose` is optional per its declaration at `languages.ts:2577-2580` — omitted here since
there is nothing to dispose per call.)

- [ ] **Step 4: Run to verify it passes**

Run: the same test command as Step 2.
Expected: all 4 tests in `sysBehaviorCodeLensScan.test.ts` pass. (These test only the pure `scanGherkinScenarioLines` function, which needs no VS Code runtime — the class itself is exercised manually in Task 5's GUI verification step, not by this unit test.)

- [ ] **Step 5: Compile check**

Run: this repo's TypeScript compile/build step.
Expected: no type errors in the new file.

- [ ] **Step 6: Commit**

```bash
git add src/vs/workbench/contrib/sys/browser/sysBehaviorCodeLensProvider.ts src/vs/workbench/contrib/sys/common/test/sysBehaviorCodeLensScan.test.ts
git commit -m "feat: add CodeLens provider scanning fenced Gherkin scenario lines"
```

---

### Task 5: `sys.pointToCode` command, registration, and manual GUI verification

**Files:**
- Modify: `src/vs/workbench/contrib/sys/browser/sys.contribution.ts`

**Interfaces:**
- Consumes: `readCandidates` (Task 2), `SysBehaviorCodeLensProvider` (Task 4), `ISysProjectService.readFormalSpec`/`getPlatformRoot` (existing), `TaskProcessTransport` (existing, `sysVerificationProviderService.ts`).

- [ ] **Step 1: Register the CodeLens provider through a proper DI-constructed contribution**

Registration needs `ILanguageFeaturesService` (constructor-injected) and the returned `IDisposable`
tracked, so — following the exact pattern already used by
`TauriExtensionHostContribution` (`src/vs/workbench/contrib/extensions/browser/tauriExtensionHost.contribution.ts:138-183`,
registered via `registerWorkbenchContribution2` at line 3078) — add a small contribution class in
`sys.contribution.ts` itself (no need for a separate file; it is a few lines):
```typescript
import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import type { IWorkbenchContribution } from '../../../common/contributions.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { SysBehaviorCodeLensProvider } from './sysBehaviorCodeLensProvider.js';

class SysBehaviorCodeLensContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.sysBehaviorCodeLens';

	constructor(@ILanguageFeaturesService languageFeatures: ILanguageFeaturesService) {
		super();
		this._register(languageFeatures.codeLensProvider.register(
			{ pattern: '**/*.intent.review.md' },
			new SysBehaviorCodeLensProvider()
		));
	}
}

registerWorkbenchContribution2(SysBehaviorCodeLensContribution.ID, SysBehaviorCodeLensContribution, WorkbenchPhase.AfterRestored);
```
Verify `IWorkbenchContribution`'s exact export location and `registerWorkbenchContribution2`'s exact
parameter order against `tauriExtensionHost.contribution.ts`'s own imports (line 2) before relying on
the snippet above verbatim — it was written from reading that same file but re-check at
implementation time in case this specific checkout's `contributions.js` differs.

- [ ] **Step 2: Implement and register the `sys.pointToCode` command**

Still in `sys.contribution.ts`, add the necessary command-registration import (`CommandsRegistry` from `'../../../../platform/commands/common/commands.js'`, `ServicesAccessor` from the same or `'../../../../platform/instantiation/common/instantiation.js'` — match whatever import path this codebase's other `CommandsRegistry.registerCommand` call sites use; search `src/vs/workbench` for an existing example if none exists in `sys/`), plus:
```typescript
import { ISysProjectService } from './sysProjectService.js';
import { TaskProcessTransport } from './sysVerificationProviderService.js';
import { ISideXTaskService } from '../../../../platform/sidex/common/sidexTaskService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { URI } from '../../../../base/common/uri.js';
import { readCandidates, SysCandidateFunction } from '../common/sysOntology.js';
```
Register the command:
```typescript
CommandsRegistry.registerCommand('sys.pointToCode', async (accessor: ServicesAccessor, requirementId: string, scenarioName: string) => {
	const projectService = accessor.get(ISysProjectService);
	const workspaceContextService = accessor.get(IWorkspaceContextService);
	const notificationService = accessor.get(INotificationService);
	const quickInputService = accessor.get(IQuickInputService);
	const editorService = accessor.get(IEditorService);

	const platformRoot = await projectService.getPlatformRoot();
	const workspace = workspaceContextService.getWorkspace().folders[0]?.uri.fsPath;
	if (!platformRoot || !workspace) {
		notificationService.notify({ severity: Severity.Info, message: 'Set the Sys Platform root (Semantic Workbench view) before using Point to code.' });
		return;
	}

	const record = await projectService.readFormalSpec(requirementId);
	if (!record?.draft.operation?.value || record.state !== 'APPROVED') {
		notificationService.notify({ severity: Severity.Info, message: 'This requirement has no confirmed operation yet.' });
		return;
	}

	const transport = new TaskProcessTransport(accessor.get(ISideXTaskService), accessor.get(IFileService));
	const result = await readCandidates(transport, platformRoot, workspace, record.draft.operation.value);
	if (result.kind === 'UNAVAILABLE') {
		notificationService.notify({ severity: Severity.Info, message: `Could not read candidates: ${result.reason}` });
		return;
	}

	const scenario = result.result.scenarios.find(s => s.scenario === scenarioName);
	if (!scenario || scenario.candidates.length === 0) {
		notificationService.notify({ severity: Severity.Info, message: scenario?.reason ?? result.result.reason ?? 'No candidates found for this scenario.' });
		return;
	}

	const picked = await quickInputService.pick(
		scenario.candidates.map((candidate: SysCandidateFunction) => ({
			label: candidate.name,
			description: candidate.file,
			detail: candidate.thenObserved ? 'then not checked as satisfied — evidence found, not verified' : undefined,
			candidate
		})),
		{ placeHolder: `Candidates for "${scenarioName}"` }
	);
	if (!picked) { return; }
	await editorService.openEditor({ resource: URI.joinPath(workspaceContextService.getWorkspace().folders[0].uri, picked.candidate.file) });
});
```

Note: the exact `detail` wording above ("then not checked as satisfied — evidence found, not verified") intentionally avoids a checkmark-style affordance per this plan's Global Constraints; adjust wording only if it conflicts with an established phrase already used elsewhere in this view for the same "governed, not checked" concept (search for "GOVERNED_NOT_CHECKED" or "not checked" in `sysSemanticWorkbenchView.ts` and reuse that voice if a closer match exists there).

- [ ] **Step 3: Compile check**

Run: this repo's TypeScript compile/build step.
Expected: no type errors. Resolve any import-path mismatches against this codebase's actual internal module layout (the exact paths for `CommandsRegistry`, `ServicesAccessor`, `languages`, and `Severity` may differ slightly from what is written above — this is a VS Code fork with its own internal layout, and Step 1/Step 2's snippets are written from general VS Code conventions; treat a compile error here as a signal to find and match the real path, not a blocker to work around).

- [ ] **Step 4: Run the whole package's test suite**

Run: the repo's full test command for this contrib folder.
Expected: all tests (Tasks 1-4's new ones plus every pre-existing test) pass.

- [ ] **Step 5: Manual GUI verification**

Per this project's standing rule for UI changes: start the app, open a workspace with at least one confirmed Formal Spec whose `behavior` field is populated (use the dry-run fixture shape from the sys-platform plan's Task 7/8 — a `demo.json` with `behavior`/`thenDecisions` and a matching `.java` source file, adapted into this editor's own `.sys/core/formal-specs/<id>.intent.json` layout) — or, if no such record exists yet in this environment (expected, since sidex-server does not yet send these fields — see this plan's Global Constraints), hand-edit one `.intent.json` file to add `behavior`/`thenDecisions` directly, confirm it, and open its review page. Confirm, and report explicitly what was and was not observable if the environment cannot reach a Tauri runtime for `TaskProcessTransport.run` (it throws `PLATFORM_EXECUTION_ERROR` outside `isTauri()`, per `sysVerificationProviderService.ts:39-41` — this is a real environment constraint, not a bug, and must be reported as "not testable in this environment" rather than glossed over):

1. The review page shows the Gherkin from `behavior`, with no "preview only" notice.
2. A CodeLens "Point to code" appears above the `Scenario:` line.
3. Clicking it (if a Tauri runtime is available) opens a Quick Pick with the expected candidate(s); picking one opens the right file.
4. A Formal Spec with no `behavior` (an older record) still shows the fallback preview, now marked "⚠ preview only".

- [ ] **Step 6: Commit**

```bash
git add src/vs/workbench/contrib/sys/browser/sys.contribution.ts
git commit -m "feat: register point-to-code CodeLens provider and command"
```
