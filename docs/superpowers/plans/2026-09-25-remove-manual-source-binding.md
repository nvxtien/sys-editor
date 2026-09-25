# Remove Manual Source Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every editor-owned source-code binding from the Sys requirement lifecycle, so no human is asked for a `Class.method` before Formal Spec generation or verification.

**Architecture:** The editor stops reading the `operationBinding` field and normalizes sys-core's legacy `OPERATION_BINDING_REQUIRED` outcome to `FORMAL_SPEC_SUPPORTED` at the parse boundary, which removes the dependency without editing sys-core. Verify stops prompting and instead sends the Formal Spec's own semantic `Operation:` declaration, omitting `source_anchor` because sys-platform recovers source itself from `project_root`. The code-generation action that demanded a manual implementation target is deleted.

**Tech Stack:** TypeScript (VS Code workbench contribution), `node:test` for unit tests compiled with `npx tsc`, Playwright for GUI tests.

**Spec:** `docs/superpowers/specs/2026-09-25-remove-manual-source-binding-design.md`

## Global Constraints

- The Structured Intent `operation` fact stays. It is semantic (`create booking`), never a source symbol (`BookingService.createBooking`).
- `Operation:` stays in the Formal Spec grammar. Removing manual binding must not remove it.
- No source-mapping heuristic may be added to the editor. If correspondence cannot be determined, the platform's own failure is shown.
- No replacement source-binding UI under another label. No new action may ask for a class, method, symbol, source file, or source root.
- sys-core and sys-platform are not edited by this plan. Neither is the provider boundary: `LLM_CALLS_FROM_SYS_CORE = 0`, `LLM_CALLS_FROM_SYS_PLATFORM = 0`.
- UI copy must not tell a user to bind an operation. The unsupported-kind state renders the literal token `PLATFORM_FORMAL_SPEC_GAP`.
- Unit tests compile to `/private/tmp/sys-editor-unbind-test` with `--rootDir src`, never a narrower rootDir. A rootDir under the test's own directory makes `tsc` emit every out-of-rootDir dependency as a `.js` file **next to its `.ts` source**, and Vite then serves that stale `.js` instead of the `.ts` — which breaks the app at runtime. `npm run lint` passes before each commit.

## Review Focus

- A Formal Spec with no `Operation:` line: Verify must refuse with an explicit message rather than run with an empty target. Covered in Task 3.
- A Formal Spec whose `Operation:` value is blank or whitespace: treated the same as missing, not passed through. Covered in Task 3.
- A Formal Spec with more than one `Operation:` line: the first declaration wins, deterministically. Covered in Task 3.
- sys-core still replying with the legacy `OPERATION_BINDING_REQUIRED` outcome and an `operationBinding` field: must be accepted and normalized, never rejected, or every operation rule loses Formal Spec generation. Covered in Task 1.
- A Structured Intent record written before kinds existed (`kind` absent): must still reach Formal Spec generation with no binding. Covered in Task 1.

---

### Task 1: Capability contract stops reading source binding

**Files:**
- Modify: `src/vs/workbench/contrib/sys/common/sysStructuredIntent.ts:92-133`
- Test: `src/vs/workbench/contrib/sys/common/test/sysIntentKind.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `SysFormalizationOutcome = 'FORMAL_SPEC_SUPPORTED' | 'PLATFORM_FORMAL_SPEC_GAP' | 'NOT_FORMALIZABLE'`; `SysFormalizationCapability { kind, status, requiredContext, outcome }` with no `operationBinding`; `parseFormalizationCapability(value: unknown): SysFormalizationCapability`; `formalizationNote(capability: SysFormalizationCapability): string | undefined`.

- [ ] **Step 1: Write the failing tests**

Replace the `CAPABILITY` fixture block near the top of `sysIntentKind.test.ts` (currently four entries carrying `operationBinding`) with this one, and add the tests below it:

```typescript
const CAPABILITY = {
	ready: { kind: 'OPERATION_RULE', status: 'SUPPORTED', requiredContext: 'OPERATION', outcome: 'FORMAL_SPEC_SUPPORTED' },
	gap: { kind: 'DATA_MODEL', status: 'UNSUPPORTED', requiredContext: 'ENTITY_MODEL', outcome: 'PLATFORM_FORMAL_SPEC_GAP' },
	unknown: { kind: 'UNKNOWN', status: 'UNSUPPORTED', requiredContext: 'NONE', outcome: 'NOT_FORMALIZABLE' }
} as const;

test('a legacy OPERATION_BINDING_REQUIRED reply becomes FORMAL_SPEC_SUPPORTED', () => {
	const legacy = { kind: 'OPERATION_RULE', status: 'SUPPORTED', requiredContext: 'OPERATION', operationBinding: 'REQUIRED', outcome: 'OPERATION_BINDING_REQUIRED' };
	assert.equal(parseFormalizationCapability(legacy).outcome, 'FORMAL_SPEC_SUPPORTED');
});

test('a legacy operationBinding field is ignored, not validated', () => {
	assert.equal(parseFormalizationCapability({ ...CAPABILITY.ready, operationBinding: 'REQUIRED' }).outcome, 'FORMAL_SPEC_SUPPORTED');
	assert.equal(parseFormalizationCapability({ ...CAPABILITY.ready, operationBinding: 'nonsense' }).outcome, 'FORMAL_SPEC_SUPPORTED');
	assert.equal((parseFormalizationCapability({ ...CAPABILITY.ready, operationBinding: 'REQUIRED' }) as Record<string, unknown>).operationBinding, undefined);
});

test('a capability with no operationBinding at all parses', () => {
	assert.equal(parseFormalizationCapability(CAPABILITY.ready).outcome, 'FORMAL_SPEC_SUPPORTED');
});

test('an invalid kind, status, context or outcome is still rejected', () => {
	assert.throws(() => parseFormalizationCapability({ ...CAPABILITY.ready, kind: 'NOPE' }), /invalid formalization capability/);
	assert.throws(() => parseFormalizationCapability({ ...CAPABILITY.ready, outcome: 'NOPE' }), /invalid formalization capability/);
	assert.throws(() => parseFormalizationCapability(null), /invalid formalization capability/);
});

test('no note tells a user to bind an operation', () => {
	assert.equal(formalizationNote(CAPABILITY.ready), undefined);
	assert.match(formalizationNote(CAPABILITY.gap)!, /PLATFORM_FORMAL_SPEC_GAP/);
	assert.doesNotMatch(formalizationNote(CAPABILITY.gap)!, /bind|binding/i);
	assert.doesNotMatch(formalizationNote(CAPABILITY.unknown)!, /bind|binding/i);
});

test('a record written before kinds existed still parses and needs no binding', () => {
	const beforeKinds = { version: 1, requirementId: 'REQ-001', intentStatement: fact('x'), scope: fact('x'), operation: fact('create booking'), inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: [] };
	assert.equal(parseStructuredIntent(beforeKinds, 'REQ-001').kind, undefined);
	assert.equal(parseFormalizationCapability(CAPABILITY.ready).outcome, 'FORMAL_SPEC_SUPPORTED');
});
```

Then delete any remaining test in this file that asserts `operationBinding` is required or that a note mentions binding, and update every other `CAPABILITY.required` reference to `CAPABILITY.ready`.

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd /Volumes/Work/dev/sys-editor
npx tsc --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --rootDir src --outDir /private/tmp/sys-editor-unbind-test --noEmitOnError false src/vs/workbench/contrib/sys/common/test/sysIntentKind.test.ts
node --test /private/tmp/sys-editor-unbind-test/vs/workbench/contrib/sys/common/test/sysIntentKind.test.js
```
Standalone compilation may report missing Node test type declarations; it must still emit the JavaScript.
Expected: FAIL — the legacy reply throws `sys-core returned an invalid formalization capability`, and the gap note does not contain `PLATFORM_FORMAL_SPEC_GAP`.

- [ ] **Step 3: Write the implementation**

In `sysStructuredIntent.ts`, replace the outcome type, the interface field, the `OUTCOMES` list, `parseFormalizationCapability` and `formalizationNote` with:

```typescript
export type SysFormalizationOutcome = 'FORMAL_SPEC_SUPPORTED' | 'PLATFORM_FORMAL_SPEC_GAP' | 'NOT_FORMALIZABLE';

export interface SysFormalizationCapability {
	readonly kind: SysIntentKind;
	readonly status: SysFormalizationStatus;
	readonly requiredContext: SysRequiredContext;
	readonly outcome: SysFormalizationOutcome;
}

const OUTCOMES: readonly SysFormalizationOutcome[] = ['FORMAL_SPEC_SUPPORTED', 'PLATFORM_FORMAL_SPEC_GAP', 'NOT_FORMALIZABLE'];

/**
 * The capability is decided by sys-core, never here. The editor validates the reply so a malformed
 * answer cannot unlock Formal Spec generation, and drops source binding from the contract:
 * sys-core's `operationBinding` field is ignored, and its legacy `OPERATION_BINDING_REQUIRED`
 * outcome is read as supported, because a source symbol is no longer a lifecycle prerequisite.
 */
export function parseFormalizationCapability(value: unknown): SysFormalizationCapability {
	const raw = value as Partial<Record<string, unknown>> | null;
	if (!raw || typeof raw !== 'object') { throw new Error('sys-core returned an invalid formalization capability'); }
	const outcome = raw.outcome === 'OPERATION_BINDING_REQUIRED' ? 'FORMAL_SPEC_SUPPORTED' : raw.outcome;
	if (!SYS_INTENT_KINDS.includes(raw.kind as SysIntentKind)
		|| !STATUSES.includes(raw.status as SysFormalizationStatus)
		|| !CONTEXTS.includes(raw.requiredContext as SysRequiredContext)
		|| !OUTCOMES.includes(outcome as SysFormalizationOutcome)) {
		throw new Error('sys-core returned an invalid formalization capability');
	}
	return {
		kind: raw.kind as SysIntentKind,
		status: raw.status as SysFormalizationStatus,
		requiredContext: raw.requiredContext as SysRequiredContext,
		outcome: outcome as SysFormalizationOutcome
	};
}

/** One human sentence for a capability that is not ready; undefined when a Formal Spec can be generated. */
export function formalizationNote(capability: SysFormalizationCapability): string | undefined {
	const label = SYS_INTENT_KIND_LABEL[capability.kind];
	switch (capability.outcome) {
		case 'FORMAL_SPEC_SUPPORTED': return undefined;
		case 'PLATFORM_FORMAL_SPEC_GAP': return `${label}: PLATFORM_FORMAL_SPEC_GAP — the current Sys Platform grammar does not represent this intent kind yet. Its confirmed Structured Intent remains the governed record.`;
		case 'NOT_FORMALIZABLE': return `${label} kind: nothing to formalize yet. Clarify the requirement and normalize again.`;
	}
}
```

Returning a fresh object rather than the raw reply is what guarantees no stray `operationBinding` reaches the rest of the editor.

- [ ] **Step 4: Run the tests to verify they pass**

Run the same two commands as Step 2.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/Work/dev/sys-editor
npm run lint
git add src/vs/workbench/contrib/sys/common/sysStructuredIntent.ts src/vs/workbench/contrib/sys/common/test/sysIntentKind.test.ts
git commit -m "refactor: drop source binding from the formalization capability contract"
```

---

### Task 2: Formal Spec drafting no longer requires a binding

**Files:**
- Modify: `src/vs/workbench/contrib/sys/common/sysFormalSpecDraft.ts:13-28`
- Test: `src/vs/workbench/contrib/sys/common/test/sysFormalSpecDraft.test.ts`

**Interfaces:**
- Consumes: `SysFormalizationCapability` and its three-value `outcome` from Task 1.
- Produces: `assertSysDraftFormalizable(capability: SysFormalizationCapability): void`. `assertSysDraftOperationBinding` no longer exists.

- [ ] **Step 1: Write the failing tests**

In `sysFormalSpecDraft.test.ts`, delete the two `assertSysDraftOperationBinding` assertions and its name from the import, then add:

```typescript
test('a supported capability drafts with no operation binding anywhere in sight', () => {
	assert.doesNotThrow(() => assertSysDraftFormalizable({ kind: 'OPERATION_RULE', status: 'SUPPORTED', requiredContext: 'OPERATION', outcome: 'FORMAL_SPEC_SUPPORTED' }));
});

test('an unsupported kind reports the platform gap and never asks for a binding', () => {
	assert.throws(
		() => assertSysDraftFormalizable({ kind: 'DATA_MODEL', status: 'UNSUPPORTED', requiredContext: 'ENTITY_MODEL', outcome: 'PLATFORM_FORMAL_SPEC_GAP' }),
		(error: Error) => /PLATFORM_FORMAL_SPEC_GAP/.test(error.message) && !/bind|binding|Class\.method/i.test(error.message)
	);
});

test('an unformalizable kind reports the kind, not a missing binding', () => {
	assert.throws(
		() => assertSysDraftFormalizable({ kind: 'UNKNOWN', status: 'UNSUPPORTED', requiredContext: 'NONE', outcome: 'NOT_FORMALIZABLE' }),
		(error: Error) => /UNKNOWN/.test(error.message) && !/bind|binding/i.test(error.message)
	);
});

test('the module exports no operation-binding assertion', async () => {
	const module = await import('../sysFormalSpecDraft.js') as Record<string, unknown>;
	assert.equal(module.assertSysDraftOperationBinding, undefined);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd /Volumes/Work/dev/sys-editor
npx tsc --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --rootDir src --outDir /private/tmp/sys-editor-unbind-test --noEmitOnError false src/vs/workbench/contrib/sys/common/test/sysFormalSpecDraft.test.ts
node --test /private/tmp/sys-editor-unbind-test/vs/workbench/contrib/sys/common/test/sysFormalSpecDraft.test.js
```
Expected: FAIL — `assertSysDraftOperationBinding` is still exported and the gap message lacks `PLATFORM_FORMAL_SPEC_GAP`.

- [ ] **Step 3: Write the implementation**

In `sysFormalSpecDraft.ts`, delete `assertSysDraftOperationBinding` entirely and replace `assertSysDraftFormalizable` with:

```typescript
export function assertSysDraftFormalizable(capability: SysFormalizationCapability): void {
	switch (capability.outcome) {
		case 'FORMAL_SPEC_SUPPORTED': return;
		case 'PLATFORM_FORMAL_SPEC_GAP':
			throw new Error(`PLATFORM_FORMAL_SPEC_GAP: the current Sys Platform grammar does not represent this ${SYS_INTENT_KIND_LABEL[capability.kind].toLowerCase()} intent yet. Its confirmed Structured Intent remains the governed record.`);
		case 'NOT_FORMALIZABLE':
			throw new Error('This Structured Intent has no formalizable kind yet (UNKNOWN). Clarify the requirement and normalize again.');
	}
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run the same two commands as Step 2.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/Work/dev/sys-editor
npm run lint
git add src/vs/workbench/contrib/sys/common/sysFormalSpecDraft.ts src/vs/workbench/contrib/sys/common/test/sysFormalSpecDraft.test.ts
git commit -m "refactor: drop the operation-binding precondition from Formal Spec drafting"
```

---

### Task 3: Manifest carries the semantic operation and no source anchor

**Files:**
- Modify: `src/vs/workbench/contrib/sys/common/sysManifest.ts` (whole file)
- Test: `src/vs/workbench/contrib/sys/common/test/sysManifest.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `specOperation(specText: string): string` (throws when absent or blank); `ManifestInput { projectId, projectRoot, operation, ruleId, title, specFile }` with no `sourceFile`; `buildManifest(input: ManifestInput): Verification01Manifest` whose rule has no `source_anchor`. `validateTargetOperation` no longer exists.

The platform treats `InputRule.source_anchor` as `Option<Anchor>` and recovers source from `project_root` plus `target_operation` alone (`spec-code-sync/src/contract.rs`), so omitting the anchor removes a prompt without removing a capability.

- [ ] **Step 1: Write the failing tests**

Replace the whole of `sysManifest.test.ts` with:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildManifest, specOperation } from '../sysManifest.js';

const input = {
	projectId: 'cinema-booking',
	projectRoot: '/tmp/cinema',
	operation: 'create booking',
	ruleId: 'REQ-001',
	title: 'Requested seats non-empty',
	specFile: '/tmp/cinema/.sys/specs/REQ-001.spec'
};

test('the manifest carries the semantic operation verbatim', () => {
	assert.equal(buildManifest(input).target_operation, 'create booking');
	assert.equal(buildManifest(input).project_id, 'cinema-booking');
	assert.equal(buildManifest(input).project_root, '/tmp/cinema');
});

test('the manifest declares no source anchor, because the platform recovers source', () => {
	const rule = buildManifest(input).rules[0];
	assert.equal('source_anchor' in rule, false);
	assert.deepEqual(rule.spec_anchor, { kind: 'SPEC', label: 'REQ-001.spec', file: '/tmp/cinema/.sys/specs/REQ-001.spec' });
	assert.equal(rule.id, 'REQ-001');
	assert.equal(rule.title, 'Requested seats non-empty');
});

test('the manifest never derives a source symbol from the operation', () => {
	const json = JSON.stringify(buildManifest({ ...input, operation: 'create booking' }));
	assert.doesNotMatch(json, /BookingService/);
	assert.equal(json.includes('"symbol"'), false);
});

test('specOperation reads the semantic Operation declaration', () => {
	assert.equal(specOperation('Requirement: Cinema booking\n\nOperation: create booking\n\nProperty: x.\n'), 'create booking');
	assert.equal(specOperation('Operation:    create booking   \n'), 'create booking');
});

test('specOperation takes the first declaration when a spec repeats it', () => {
	assert.equal(specOperation('Operation: create booking\nOperation: cancel booking\n'), 'create booking');
});

test('specOperation refuses a spec with no operation, without suggesting a binding', () => {
	for (const bad of ['Requirement: Cinema booking\n', 'Operation:\n', 'Operation:    \n', '']) {
		assert.throws(() => specOperation(bad), (error: Error) => /Operation:/.test(error.message) && !/Class\.method|bind/i.test(error.message));
	}
});

test('a semantic operation keeps its spaces and is never validated as a qualified symbol', async () => {
	assert.equal(buildManifest({ ...input, operation: 'cancel a confirmed booking' }).target_operation, 'cancel a confirmed booking');
	const module = await import('../sysManifest.js') as Record<string, unknown>;
	assert.equal(module.validateTargetOperation, undefined);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd /Volumes/Work/dev/sys-editor
npx tsc --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --rootDir src --outDir /private/tmp/sys-editor-unbind-test --noEmitOnError false src/vs/workbench/contrib/sys/common/test/sysManifest.test.ts
node --test /private/tmp/sys-editor-unbind-test/vs/workbench/contrib/sys/common/test/sysManifest.test.js
```
Expected: FAIL — `specOperation` is not exported and the built rule still has a `source_anchor`.

- [ ] **Step 3: Write the implementation**

Replace the whole of `sysManifest.ts` with:

```typescript
/**
 * Builds a `verification.v0.1` manifest (see spec-code-sync/src/contract.rs `Input`) with exactly one rule,
 * for one requirement's Verify run. `target_operation` is the Formal Spec's own semantic operation, never a
 * source symbol: determining which code that operation corresponds to is sys-platform's responsibility, and
 * `source_anchor` is left out so nothing here claims a mapping the editor has not been told.
 */
const OPERATION_LINE = /^Operation:[ \t]*(.*)$/m;

/** The semantic operation a Formal Spec declares, e.g. `create booking`. Throws when the spec declares none. */
export function specOperation(specText: string): string {
	const operation = OPERATION_LINE.exec(specText)?.[1].trim();
	if (!operation) {
		throw new Error('This Formal Spec declares no `Operation:`. Add one to the spec before verifying.');
	}
	return operation;
}

export interface ManifestInput {
	readonly projectId: string;
	readonly projectRoot: string;
	/** The Formal Spec's semantic operation. */
	readonly operation: string;
	readonly ruleId: string;
	readonly title: string;
	readonly specFile: string;
}

export interface Verification01Manifest {
	readonly project_id: string;
	readonly project_root: string;
	readonly target_operation: string;
	readonly rules: readonly {
		readonly id: string;
		readonly title: string;
		readonly spec_file: string;
		readonly spec_anchor: { readonly kind: 'SPEC'; readonly label: string; readonly file: string };
	}[];
}

export function buildManifest(input: ManifestInput): Verification01Manifest {
	return {
		project_id: input.projectId,
		project_root: input.projectRoot,
		target_operation: input.operation,
		rules: [{
			id: input.ruleId,
			title: input.title,
			spec_file: input.specFile,
			spec_anchor: { kind: 'SPEC', label: `${input.ruleId}.spec`, file: input.specFile }
		}]
	};
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run the same two commands as Step 2.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/Work/dev/sys-editor
npm run lint
git add src/vs/workbench/contrib/sys/common/sysManifest.ts src/vs/workbench/contrib/sys/common/test/sysManifest.test.ts
git commit -m "refactor: build the verification manifest from the spec's semantic operation"
```

---

### Task 4: The service stops offering source binding

**Files:**
- Modify: `src/vs/workbench/contrib/sys/browser/sysProjectService.ts:43,221-224,243`
- Test: `src/vs/workbench/contrib/sys/common/test/sysProjectServiceContract.test.ts` (create)

**Interfaces:**
- Consumes: the three-value `outcome` from Task 1.
- Produces: `ISysProjectService` with no `bindOperation` member.

- [ ] **Step 1: Write the failing test**

Create `src/vs/workbench/contrib/sys/common/test/sysProjectServiceContract.test.ts`. The service file imports workbench platform modules that do not resolve under a standalone `node --test` run, so this test reads the source text instead — which is exactly the guarantee being made: the word does not appear.

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..', '..', '..');
const read = (relative: string) => readFileSync(join(root, relative), 'utf8');

test('the project service no longer binds operations', () => {
	const source = read('src/vs/workbench/contrib/sys/browser/sysProjectService.ts');
	assert.equal(/bindOperation/.test(source), false);
	assert.equal(/bind-operation/.test(source), false);
});

test('no service error copy tells a user to bind an operation', () => {
	const source = read('src/vs/workbench/contrib/sys/browser/sysProjectService.ts');
	for (const message of source.match(/'[^']*'/g) ?? []) {
		assert.doesNotMatch(message, /bind (its|this|the) operation/i);
	}
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd /Volumes/Work/dev/sys-editor
npx tsc --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --rootDir src --outDir /private/tmp/sys-editor-unbind-test --noEmitOnError false src/vs/workbench/contrib/sys/common/test/sysProjectServiceContract.test.ts
node --test /private/tmp/sys-editor-unbind-test/vs/workbench/contrib/sys/common/test/sysProjectServiceContract.test.js
```
Expected: FAIL — `bindOperation` is present and `approveSpec`'s message says "bind its operation".

- [ ] **Step 3: Write the implementation**

In `sysProjectService.ts`:

Delete this member and its doc comment from the `ISysProjectService` interface:

```typescript
	/** sys-core binds the operation, keeps the fact shape, and revokes the intent's approval. */
	bindOperation(id: string, operation: string): Promise<void>;
```

Delete this method from the class:

```typescript
	async bindOperation(id: string, operation: string): Promise<void> {
		await this.core(['intent', 'bind-operation', id, operation]);
		this._onDidChange.fire();
	}
```

In `approveSpec`, replace the `throw` message so it names only lifecycle state and kind support:

```typescript
		if (!intent || intent.state !== 'APPROVED' || capability?.outcome !== 'FORMAL_SPEC_SUPPORTED') { throw new Error('Approve a Structured Intent whose kind the platform can formalize before approving the Formal Spec.'); }
```

- [ ] **Step 4: Run the test to verify it passes**

Run the same two commands as Step 2.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/Work/dev/sys-editor
npm run lint
git add src/vs/workbench/contrib/sys/browser/sysProjectService.ts src/vs/workbench/contrib/sys/common/test/sysProjectServiceContract.test.ts
git commit -m "refactor: remove operation binding from the Sys project service"
```

---

### Task 5: The workbench asks for no source identity

**Files:**
- Modify: `src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts:20,377-386,392-444,473-506,533-540`
- Test: `src/vs/workbench/contrib/sys/common/test/sysWorkbenchNoSourceBinding.test.ts` (create)

**Interfaces:**
- Consumes: `specOperation` and `buildManifest` from Task 3; the service with no `bindOperation` from Task 4.
- Produces: no new exports. `_bindOperation` and `_approveSpecAndReviewProposal` no longer exist.

Deleting `_approveSpecAndReviewProposal` also removes the last use of `fileDialogService`, `decodePendingProposal`, `canApplySysProposal`, `relative`, `isAbsolute`, `sep` and `_ensurePlatformWorkspace` if nothing else references them. Remove each import, field and helper only after checking it has no other caller in the file; `npm run lint` will report any that are now unused.

- [ ] **Step 1: Write the failing test**

Create `src/vs/workbench/contrib/sys/common/test/sysWorkbenchNoSourceBinding.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..', '..', '..');
const view = () => readFileSync(join(root, 'src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts'), 'utf8');

test('the workbench renders no Bind operation action', () => {
	assert.equal(/Bind operation/.test(view()), false);
	assert.equal(/_bindOperation/.test(view()), false);
});

test('the workbench asks for no class, method, symbol or source root', () => {
	const source = view();
	assert.equal(/Class\.method/i.test(source), false);
	assert.equal(/ClassName\.methodName/.test(source), false);
	assert.equal(/BookingService\.createBooking/.test(source), false);
	assert.equal(/validateTargetOperation/.test(source), false);
	assert.equal(/Source root|source-root|Code file to update|Source file containing/.test(source), false);
});

test('the code-proposal action that demanded an implementation target is gone', () => {
	assert.equal(/_approveSpecAndReviewProposal|Approve spec & review code/.test(view()), false);
});

test('no action label reintroduces binding under another name', () => {
	const labels = [...view().matchAll(/this\._action\(actions, '([^']+)'/g)].map(match => match[1]);
	assert.ok(labels.length > 0, 'expected to find action labels');
	for (const label of labels) {
		assert.doesNotMatch(label, /bind|link|attach|map|target|symbol|class|method|source/i);
	}
});

test('Verify builds its manifest from the spec, not from a prompt', () => {
	const source = view();
	assert.match(source, /specOperation\(/);
	const verify = source.slice(source.indexOf('private async _verify('), source.indexOf('private _renderRequirementRow('));
	assert.equal(/quickInputService|showOpenDialog/.test(verify), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd /Volumes/Work/dev/sys-editor
npx tsc --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --rootDir src --outDir /private/tmp/sys-editor-unbind-test --noEmitOnError false src/vs/workbench/contrib/sys/common/test/sysWorkbenchNoSourceBinding.test.ts
node --test /private/tmp/sys-editor-unbind-test/vs/workbench/contrib/sys/common/test/sysWorkbenchNoSourceBinding.test.js
```
Expected: FAIL on every test — the button, the prompts and the proposal action are all present.

- [ ] **Step 3: Write the implementation**

Change the manifest import on line 20:

```typescript
import { buildManifest, specOperation } from '../common/sysManifest.js';
```

Delete the whole `_bindOperation` method and the whole `_approveSpecAndReviewProposal` method.

Replace `_verify` with:

```typescript
	/**
	 * Builds a one-rule manifest from the approved Formal Spec's own semantic operation and runs it via
	 * spec-code-sync. Nothing here is asked of the user and nothing maps the operation to source: which code
	 * that operation corresponds to is sys-platform's to recover, and its verdict is shown in the
	 * Verification view, not reasoned about here.
	 */
	private async _verify(id: string, title: string): Promise<void> {
		const specText = (await this.fileService.readFile(this.projectService.resourceOfSpec(id))).value.toString();
		const operation = specOperation(specText);
		let platformRoot = await this.projectService.getPlatformRoot();
		if (!platformRoot) {
			const input = await this._promptPlatformRoot(undefined);
			if (input === undefined) { return; }
			await this.projectService.setPlatformRoot(input);
			platformRoot = input;
		}
		const folder = this.projectService.resourceOf(id).path.split('/.sys/')[0];
		const projectId = folder.slice(folder.lastIndexOf('/') + 1);
		const manifest = buildManifest({
			projectId,
			projectRoot: folder,
			operation,
			ruleId: id,
			title,
			specFile: this.projectService.resourceOfSpec(id).fsPath
		});
		const manifestUri = await this.projectService.writeManifest(id, manifest);
		this.verificationDataProvider.setWorkspaceRun({ platformBinary: `${platformRoot}/spec-code-sync/target/debug/spec-code-sync`, manifestPath: manifestUri.fsPath });
		await this.viewsService.openView(SYS_VERIFICATION_VIEW_ID, true);
	}
```

The platform root prompt stays: it locates the sys-platform installation, not a source symbol.

In `_renderRequirementRow`, replace the capability block so no binding branch remains:

```typescript
			if (intentState === 'APPROVED' && row.formalization?.outcome === 'FORMAL_SPEC_SUPPORTED') {
				this._action(actions, 'Generate Formal Spec', 'sys-req-action', () => this._draftSpecFromRequirement(row.id));
			}
```

and replace the spec block, dropping the proposal action:

```typescript
			if (row.hasSpec && row.formalSpecState !== 'APPROVED') {
				this._action(actions, 'Approve Formal Spec', 'sys-req-action', () => this._approveFormalSpec(row.id));
			}
```

Then run `npm run lint` and delete every import, constructor parameter and private helper it reports as unused.

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd /Volumes/Work/dev/sys-editor
npx tsc --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --rootDir src --outDir /private/tmp/sys-editor-unbind-test --noEmitOnError false src/vs/workbench/contrib/sys/common/test/*.test.ts
node --test /private/tmp/sys-editor-unbind-test/vs/workbench/contrib/sys/common/test/
npm run lint
```
Expected: PASS, with no unused-symbol lint errors.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/Work/dev/sys-editor
git add src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts src/vs/workbench/contrib/sys/common/test/sysWorkbenchNoSourceBinding.test.ts
git commit -m "feat: remove every source-binding prompt from the Sys workbench lifecycle"
```

---

### Task 6: Playwright proves the visible lifecycle

**Files:**
- Modify: `tests/gui/normalize-intent-live.spec.mjs:186-207,238,299-330`
- Test: the same file

**Interfaces:**
- Consumes: the finished behavior from Tasks 1-5.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing tests**

Replace the `CASES` array (lines 186-192) with:

```javascript
const CASES = [
	{ name: 'DATA_MODEL is a platform gap, stated as one', kind: 'DATA_MODEL', operation: UNBOUND, generate: false, note: /PLATFORM_FORMAL_SPEC_GAP/ },
	{ name: 'RELATIONSHIP is a platform gap, stated as one', kind: 'RELATIONSHIP', operation: UNBOUND, generate: false, note: /PLATFORM_FORMAL_SPEC_GAP/ },
	{ name: 'OPERATION_RULE reaches Generate with no operation of its own', kind: 'OPERATION_RULE', operation: UNBOUND, generate: true, note: null },
	{ name: 'OPERATION_RULE reaches Generate with a semantic operation', kind: 'OPERATION_RULE', operation: BOUND, generate: true, note: null },
	{ name: 'a source-looking operation does not make a DATA_MODEL formalizable', kind: 'DATA_MODEL', operation: BOUND, generate: false, note: /PLATFORM_FORMAL_SPEC_GAP/ },
	{ name: 'UNKNOWN kind has nothing to formalize', kind: 'UNKNOWN', operation: UNBOUND, generate: false, note: /nothing to formalize yet/ },
	{ name: 'a record written before kinds existed keeps the operation-rule behavior', kind: undefined, operation: BOUND, generate: true, note: null }
];
```

Replace the loop body (lines 194-206) with:

```javascript
for (const c of CASES) {
	test(`kind gating: ${c.name}`, async ({ page }) => {
		const root = makeWorkspace();
		await seedApprovedIntent(root, c.kind, c.operation);
		const { workbench } = await openWorkbench(page, root, 'anthropic/claude-haiku-4-5-20251001');
		await expect(workbench.getByRole('button', { name: 'Review intent' })).toHaveCount(1);
		await expect(workbench.getByRole('button', { name: 'Bind operation' })).toHaveCount(0);
		await expect(workbench.getByRole('button', { name: 'Generate Formal Spec' })).toHaveCount(c.generate ? 1 : 0);
		await expect(workbench).not.toContainText('bind its operation');
		if (c.note) { await expect(workbench).toContainText(c.note); } else { await expect(workbench).not.toContainText('PLATFORM_FORMAL_SPEC_GAP'); }
	});
}
```

Delete the whole `test('Bind operation goes through sys-core, keeps the fact shape, and asks for a new confirmation', ...)` block (lines 299-330) — the behavior it pins no longer exists.

In the sys-core-unavailable test (line 238), drop `'Bind operation'` from the name list, leaving `['Normalize intent', 'Review intent', 'Confirm intent', 'Generate Formal Spec', 'Approve intent']`.

Then add at the end of the file:

```javascript
test('the lifecycle never asks for a source identity', async ({ page }) => {
	const root = makeWorkspace();
	await seedApprovedIntent(root, 'OPERATION_RULE', BOUND);
	const { workbench } = await openWorkbench(page, root, 'anthropic/claude-haiku-4-5-20251001');
	await expect(workbench.getByRole('button', { name: 'Generate Formal Spec' })).toHaveCount(1, { timeout: 30_000 });
	await expect(workbench.getByRole('button', { name: 'Bind operation' })).toHaveCount(0);
	await expect(workbench.getByRole('button', { name: 'Approve spec & review code' })).toHaveCount(0);
	// A quick input would be the only way a Class.method could still be demanded.
	await expect(page.locator('.quick-input-widget:visible')).toHaveCount(0);
	await expect(workbench).not.toContainText('Class.method');
	await expect(workbench).not.toContainText('ClassName.methodName');
});
```

- [ ] **Step 2: Run the tests to verify they fail against the pre-change build**

Tasks 1-5 are already committed by now, so there is nothing to stash. Check the
tests out against the commit before this work and confirm they go red there:

```bash
cd /Volumes/Work/dev/sys-editor
git worktree add /private/tmp/sys-editor-prechange HEAD~5
cp tests/gui/normalize-intent-live.spec.mjs /private/tmp/sys-editor-prechange/tests/gui/
cd /private/tmp/sys-editor-prechange && npm run setup && npx playwright test tests/gui/normalize-intent-live.spec.mjs
```
Expected: FAIL — `PLATFORM_FORMAL_SPEC_GAP` is absent and `Bind operation` is present.

Then clean up:
```bash
cd /Volumes/Work/dev/sys-editor && git worktree remove --force /private/tmp/sys-editor-prechange
```

If the worktree cannot build (its `node_modules` is not shared), skip the RED
check and say so in the Task 7 report rather than claiming a RED you did not see.

- [ ] **Step 3: No implementation step**

The implementation is Tasks 1-5. This task only moves the GUI guarantees onto the new behavior.

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd /Volumes/Work/dev/sys-editor
npx playwright test tests/gui/normalize-intent-live.spec.mjs tests/gui/gui-full-requirement-lifecycle.spec.mjs
```
Expected: PASS. If `gui-full-requirement-lifecycle.spec.mjs` fails on copy this plan changed, update its assertions to the new copy and keep its lifecycle-gating intent.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/Work/dev/sys-editor
git add tests/gui/
git commit -m "test: pin the GUI lifecycle to a source-binding-free flow"
```

---

### Task 7: Full verification and the mission report

**Files:**
- Modify: none expected; fix whatever the sweep finds.

**Interfaces:**
- Consumes: everything above.
- Produces: the mission's required final report.

- [ ] **Step 1: Prove no source-binding dependency survives**

Run:
```bash
cd /Volumes/Work/dev/sys-editor
grep -rn "bindOperation\|bind-operation\|Bind operation\|operationBinding\|OPERATION_BINDING_REQUIRED\|validateTargetOperation\|targetOperation\|Class\.method" --include="*.ts" --include="*.mjs" src tests
```
Expected: no matches outside `docs/`. Any match in `src` or `tests` is a remaining dependency — fix it and re-run before continuing.

- [ ] **Step 2: Prove the provider boundary did not move**

Run:
```bash
cd /Volumes/Work/dev/sys-editor
grep -rn "anthropic\|openai\|api_key\|apiKey" --include="*.go" sidexai/sidex-server/internal/api/sys_core.go
```
Expected: no matches. sys-core stays a process boundary with no provider call.

- [ ] **Step 3: Run the whole affected suite**

Run:
```bash
cd /Volumes/Work/dev/sys-editor
npx tsc --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --rootDir src --outDir /private/tmp/sys-editor-unbind-test --noEmitOnError false src/vs/workbench/contrib/sys/common/test/*.test.ts
node --test /private/tmp/sys-editor-unbind-test/vs/workbench/contrib/sys/common/test/
npm run lint
npx playwright test
```
Expected: all PASS. Record the actual output; do not claim a pass that was not observed.

- [ ] **Step 4: Write the mission report**

Fill in the report template from `docs/prompts/REMOVE_MANUAL_SOURCE_BINDING_FROM_EDITOR_V0_1.md`, with `REMAINING_PLATFORM_GAPS` naming the real one: `semantic-core --target` resolves a source symbol, so a semantic operation such as `create booking` does not yet recover source correspondence, and Verify reports the platform's own non-green result. Report `NARROW` rather than `GO` if any step above did not pass.

- [ ] **Step 5: Commit**

```bash
cd /Volumes/Work/dev/sys-editor
git add -A
git commit -m "docs: report the removal of manual source binding"
```
