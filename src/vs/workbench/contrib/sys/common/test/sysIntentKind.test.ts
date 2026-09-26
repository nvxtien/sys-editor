import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { formalizationNote, parseFormalizationCapability, parseStructuredIntent, serializeStructuredIntent, SysFormalizationCapability, SysStructuredIntentRecord } from '../sysStructuredIntent.js';
import { assertSysDraftFormalizable } from '../sysFormalSpecDraft.js';
import { renderStructuredIntentReview } from '../sysStructuredIntentReview.js';

// Capability rules (which kind needs which context, what the platform can formalize) are owned by
// sys-core and tested there (sys-core/tests/capability.rs). This file covers only what the editor
// itself does: validate candidates and core replies, explain outcomes, and render them.

const fact = (value: string, provenance: 'SPECIFIED' | 'OBSERVED' | 'DERIVED' | 'INFERRED' | 'UNKNOWN' = 'SPECIFIED') => ({ value, provenance });

function raw(kind: unknown): Record<string, unknown> {
	return { version: 1, requirementId: 'REQ-001', ...(kind === undefined ? {} : { kind }), intentStatement: fact('s'), scope: fact('s'), operation: fact('UNKNOWN', 'UNKNOWN'), inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: [] };
}

function record(kind: string | undefined, approvedContent?: string): SysStructuredIntentRecord {
	return { sourceRequirement: 'r', draft: parseStructuredIntent(raw(kind), 'REQ-001'), state: approvedContent ? 'APPROVED' : 'DRAFT' };
}

const CAPABILITY: Record<string, SysFormalizationCapability> = {
	ready: { kind: 'OPERATION_RULE', status: 'SUPPORTED', requiredContext: 'OPERATION', outcome: 'FORMAL_SPEC_SUPPORTED' },
	gap: { kind: 'DATA_MODEL', status: 'UNSUPPORTED', requiredContext: 'ENTITY_MODEL', outcome: 'PLATFORM_FORMAL_SPEC_GAP' },
	unknown: { kind: 'UNKNOWN', status: 'UNSUPPORTED', requiredContext: 'NONE', outcome: 'NOT_FORMALIZABLE' },
	unstated: { kind: 'OPERATION_RULE', status: 'SUPPORTED', requiredContext: 'OPERATION', outcome: 'OPERATION_UNSPECIFIED' }
};

test('an operation rule is offered generation even when its intent states no operation', () => {
	// The Operation: declaration is semantic and the generator derives it from the intent statement.
	// Gating on the operation field would block exactly the case generation exists to serve.
	assert.equal(parseFormalizationCapability(CAPABILITY.ready).outcome, 'FORMAL_SPEC_SUPPORTED');
	assert.doesNotThrow(() => assertSysDraftFormalizable(CAPABILITY.ready));
});

test('an unspecified-operation outcome reports a semantic gap, never a source binding', () => {
	// sys-core reports this when generation itself could not ground an operation. It asks for the
	// requirement to be clarified, never for a Class.method.
	assert.throws(() => assertSysDraftFormalizable(CAPABILITY.unstated), /states no operation/);
	const note = formalizationNote(CAPABILITY.unstated)!;
	assert.match(note, /operation/i);
	assert.doesNotMatch(note, /bind|binding|Class\.method/i);
});

test('parses each semantic kind and rejects an unknown kind value', () => {
	for (const kind of ['OPERATION_RULE', 'DATA_MODEL', 'RELATIONSHIP', 'INVARIANT', 'WORKFLOW', 'UNKNOWN']) {
		assert.equal(parseStructuredIntent(raw(kind), 'REQ-001').kind, kind);
	}
	assert.throws(() => parseStructuredIntent(raw('CRUD'), 'REQ-001'), /Structured Intent has an invalid kind/);
	assert.throws(() => parseStructuredIntent(raw(7), 'REQ-001'), /Structured Intent has an invalid kind/);
});

test('a record written before kinds existed still parses and keeps its exact serialization', () => {
	const legacy = parseStructuredIntent(raw(undefined), 'REQ-001');
	assert.equal(legacy.kind, undefined);
	assert.ok(!serializeStructuredIntent(legacy).includes('"kind"'), 'approved content of legacy records must not change');
});

test('a freshly normalized intent must state its kind', () => {
	assert.throws(() => parseStructuredIntent(raw(undefined), 'REQ-001', { requireKind: true }), /Structured Intent has an invalid kind/);
	assert.equal(parseStructuredIntent(raw('DATA_MODEL'), 'REQ-001', { requireKind: true }).kind, 'DATA_MODEL');
});

test('the capability reply from sys-core is accepted only in its exact contract shape', () => {
	for (const capability of Object.values(CAPABILITY)) { assert.deepEqual(parseFormalizationCapability(JSON.parse(JSON.stringify(capability))), capability); }
	assert.throws(() => parseFormalizationCapability(null), /invalid formalization capability/);
	assert.throws(() => parseFormalizationCapability({ ...CAPABILITY.ready, outcome: 'SURE_WHY_NOT' }), /invalid formalization capability/);
	assert.throws(() => parseFormalizationCapability({ ...CAPABILITY.ready, kind: 'CRUD' }), /invalid formalization capability/);
	assert.throws(() => parseFormalizationCapability({ ...CAPABILITY.ready, status: 'MAYBE' }), /invalid formalization capability/);
	assert.throws(() => parseFormalizationCapability({ ...CAPABILITY.ready, requiredContext: 'VIBES' }), /invalid formalization capability/);
});

test('a sys-core that still demands a binding is refused, not silently unlocked', () => {
	// An older sys-core rejects `spec prepare` with OperationBindingRequired. Reading its reply as
	// "supported" would render a Generate button that fails with a 502, so the reply is refused and
	// the row falls back to "options unavailable" instead of offering a broken action.
	const legacy = { kind: 'OPERATION_RULE', status: 'SUPPORTED', requiredContext: 'OPERATION', operationBinding: 'REQUIRED', outcome: 'OPERATION_BINDING_REQUIRED' };
	assert.throws(() => parseFormalizationCapability(legacy), /invalid formalization capability/);
});

test('a legacy operationBinding field alongside a current outcome is ignored, not validated', () => {
	assert.equal(parseFormalizationCapability({ ...CAPABILITY.ready, operationBinding: 'REQUIRED' }).outcome, 'FORMAL_SPEC_SUPPORTED');
	assert.equal(parseFormalizationCapability({ ...CAPABILITY.ready, operationBinding: 'nonsense' }).outcome, 'FORMAL_SPEC_SUPPORTED');
	assert.equal((parseFormalizationCapability({ ...CAPABILITY.ready, operationBinding: 'REQUIRED' }) as unknown as Record<string, unknown>).operationBinding, undefined);
});

test('a capability with no operationBinding at all parses', () => {
	assert.equal(parseFormalizationCapability(CAPABILITY.ready).outcome, 'FORMAL_SPEC_SUPPORTED');
});

test('no note tells a user to bind an operation', () => {
	assert.equal(formalizationNote(CAPABILITY.ready), undefined);
	// An intent that states no governable fact gets no note at all: telling the author to
	// "clarify and normalize again" blames them for a limit of the platform's grammar.
	assert.equal(formalizationNote(CAPABILITY.unknown), undefined);
});

test('a record written before kinds existed needs no binding to be formalizable', () => {
	assert.equal(parseStructuredIntent(raw(undefined), 'REQ-001').kind, undefined);
	assert.doesNotThrow(() => assertSysDraftFormalizable(parseFormalizationCapability(CAPABILITY.ready)));
});

test('drafting is refused with the reason that matches the outcome', () => {
	assert.doesNotThrow(() => assertSysDraftFormalizable(CAPABILITY.ready));
	assert.throws(() => assertSysDraftFormalizable(CAPABILITY.gap), /PLATFORM_FORMAL_SPEC_GAP/);
	assert.throws(() => assertSysDraftFormalizable(CAPABILITY.unknown));
});

test('the review page shows the kind as a model classification and the capability note from core', () => {
	const gap = renderStructuredIntentReview(record('DATA_MODEL', 'x'), CAPABILITY.gap);
	assert.ok(gap.includes('## Kind'));
	assert.ok(gap.includes('Data model — ⚠ model’s classification, please check'));
	assert.ok(!gap.includes('PLATFORM_FORMAL_SPEC_GAP'), 'platform vocabulary leaked into the review page');
	assert.ok(renderStructuredIntentReview(record('OPERATION_RULE'), CAPABILITY.ready).includes('A Formal Spec can be generated'));
});

test('the review page never claims a capability it could not read from core', () => {
	const text = renderStructuredIntentReview(record('DATA_MODEL'), undefined);
	assert.ok(text.includes('could not be read from sys-core'));
	assert.ok(!text.includes('A Formal Spec can be generated'));
});

const dataModelRecord = (): SysStructuredIntentRecord => ({
	sourceRequirement: 'This requirement designs the data model.',
	state: 'DRAFT',
	draft: parseStructuredIntent({
		version: 1, requirementId: 'REQ-001', kind: 'DATA_MODEL',
		intentStatement: { value: 'Two entities', provenance: 'SPECIFIED' },
		scope: { value: 'Category and Book', provenance: 'SPECIFIED' },
		operation: null,
		entities: [
			{ name: 'Category', fields: [{ name: 'id', type: 'INT', provenance: 'SPECIFIED' }, { name: 'description', type: 'string', provenance: 'SPECIFIED' }] },
			{ name: 'Book', fields: [{ name: 'title', type: 'string', provenance: 'SPECIFIED' }] }
		],
		relationships: [{ value: 'Each Book belongs to exactly one Category', provenance: 'SPECIFIED' }],
		inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: ['Whether id is auto-generated']
	}, 'REQ-001')
});

test('a data model review shows entities and relationships, and no operation section', () => {
	const page = renderStructuredIntentReview(dataModelRecord(), CAPABILITY.gap);
	assert.ok(page.includes('## Entities'), 'entities section missing');
	assert.ok(page.includes('### Category'), 'entity heading missing');
	assert.ok(page.includes('- id: INT'), 'field not rendered as name: type');
	assert.ok(page.includes('### Book'));
	assert.ok(page.includes('## Relationships'));
	assert.ok(page.includes('Each Book belongs to exactly one Category'));
	// A data model has no operation, no inputs, no effects and no failure behaviour to state.
	for (const absent of ['## Operation', '## Inputs', '## Effects', '## Failure behavior', 'Not bound yet']) {
		assert.ok(!page.includes(absent), `${absent} must not appear for a data model`);
	}
	assert.ok(page.includes('## Open questions'));
	assert.ok(!page.includes('PLATFORM_FORMAL_SPEC_GAP'), 'platform vocabulary leaked into the review page');
});

test('an operation rule review keeps the operation layout', () => {
	const page = renderStructuredIntentReview(record('OPERATION_RULE'), CAPABILITY.ready);
	assert.ok(page.includes('## Operation'));
	assert.ok(page.includes('## Inputs'));
	assert.ok(page.includes('## Effects'));
	assert.ok(!page.includes('## Entities'), 'an operation rule states no entities');
});

test('no review page ever says an operation is "not bound"', () => {
	for (const page of [renderStructuredIntentReview(dataModelRecord(), CAPABILITY.gap), renderStructuredIntentReview(record('OPERATION_RULE'), CAPABILITY.ready)]) {
		assert.doesNotMatch(page, /not bound/i);
	}
});

const gapWithConstructs: SysFormalizationCapability = {
	kind: 'DATA_MODEL', status: 'UNSUPPORTED', requiredContext: 'ENTITY_MODEL', outcome: 'PLATFORM_FORMAL_SPEC_GAP',
	requiredConstructs: ['DECLARED_TYPE', 'FIELD', 'RELATIONSHIP', 'CARDINALITY'],
	unsupportedConstructs: ['DECLARED_TYPE', 'FIELD', 'RELATIONSHIP', 'CARDINALITY']
};

test('the capability reply carries the construct sets through to the editor', () => {
	const parsed = parseFormalizationCapability(JSON.parse(JSON.stringify(gapWithConstructs)));
	assert.deepEqual(parsed.unsupportedConstructs, ['DECLARED_TYPE', 'FIELD', 'RELATIONSHIP', 'CARDINALITY']);
	// A reply from an older sys-core carries neither set and must still parse.
	assert.deepEqual(parseFormalizationCapability(CAPABILITY.gap).unsupportedConstructs, undefined);
});

test('a platform gap is not narrated on the review page', () => {
	// The page already shows the kind and what the intent states. A paragraph of platform vocabulary
	// on top of that is noise for the person reading their own requirement back.
	assert.equal(formalizationNote(gapWithConstructs), undefined);
	assert.equal(formalizationNote(CAPABILITY.gap), undefined);
});

test('Add spec is offered only when the platform can formalize the intent', () => {
	const source = readFileSync(join(process.cwd(), 'src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts'), 'utf8');
	const addSpec = source.slice(source.indexOf("row.hasSpec ? 'Edit spec' : 'Add spec'") - 400, source.indexOf("row.hasSpec ? 'Edit spec' : 'Add spec'"));
	assert.match(addSpec, /FORMAL_SPEC_SUPPORTED/, 'Add spec is not gated on the capability');
});

const withScenarios = (): SysStructuredIntentRecord => ({
	sourceRequirement: 'This requirement designs the data model.',
	state: 'DRAFT',
	draft: parseStructuredIntent({
		version: 1, requirementId: 'REQ-001', kind: 'DATA_MODEL',
		intentStatement: { value: 'Two entities', provenance: 'SPECIFIED' },
		scope: { value: 'Category and Book', provenance: 'SPECIFIED' },
		operation: null,
		entities: [{ name: 'Category', fields: [{ name: 'id', type: 'INT', provenance: 'SPECIFIED' }] }],
		relationships: [{ value: 'Each Book belongs to exactly one Category', provenance: 'SPECIFIED' }],
		scenarios: [{
			value: 'Scenario: Each Book belongs to exactly one Category\n  Given a Category with id 1 exists\n  When a Book is created with category_id 1\n  Then the Book is linked to exactly one Category',
			provenance: 'SPECIFIED'
		}],
		inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: []
	}, 'REQ-001')
});

test('scenarios are shown as readable Gherkin, in a fenced block', () => {
	const gherkin = 'Scenario: Each Book belongs to exactly one Category\n  Given a Category with id 1 exists\n  When a Book is created with category_id 1\n  Then the Book is linked to exactly one Category';
	const page = renderStructuredIntentReview(record('DATA_MODEL'), CAPABILITY.gap, gherkin);
	assert.ok(page.includes('## Scenarios'), 'no scenarios section');
	assert.ok(page.includes('```gherkin'), 'scenarios are not fenced as gherkin');
	assert.ok(page.includes('Scenario: Each Book belongs to exactly one Category'));
	assert.ok(page.includes('  Given a Category with id 1 exists'), 'the Given line lost its indentation');
	// It is a reading aid, not what gets confirmed; the page must not imply otherwise.
	assert.ok(page.includes('what you confirm') || page.includes('What you confirm'), 'the page no longer says what is confirmed');
	// A scenario is several lines; collapsing it to one would make it unreadable.
	assert.ok(!page.includes('Scenario: Each Book belongs to exactly one Category  Given'), 'scenario was flattened');
});

test('a review with no scenarios shows no scenarios section', () => {
	// The provider may be down or the intent may state no behaviour: either way the page still opens.
	assert.ok(!renderStructuredIntentReview(record('OPERATION_RULE'), CAPABILITY.ready).includes('## Scenarios'));
	assert.ok(!renderStructuredIntentReview(record('OPERATION_RULE'), CAPABILITY.ready, undefined).includes('## Scenarios'));
	assert.ok(renderStructuredIntentReview(record('OPERATION_RULE'), CAPABILITY.ready, undefined).includes('## Intent'));
});

test('a review page never tells the author to clarify a requirement the platform cannot formalize', () => {
	for (const capability of [CAPABILITY.unknown, CAPABILITY.gap]) {
		const page = renderStructuredIntentReview(record('DATA_MODEL'), capability);
		assert.doesNotMatch(page, /nothing to formalize yet/);
		assert.doesNotMatch(page, /Clarify the requirement and normalize again/);
	}
});

test('an empty requirement offers nothing but deleting it', () => {
	const view = readFileSync(join(process.cwd(), 'src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts'), 'utf8');
	// Every lifecycle action sits behind the same guard, so a blank requirement cannot offer one.
	const guard = /!row\.missing && !row\.empty && !row\.lifecycleUnavailable/;
	assert.match(view, guard, 'lifecycle actions are not guarded on an empty requirement');
	// And the row says what to do instead of leaving the reader with only Delete.
	assert.match(view, /Write the requirement/, 'no guidance for an empty requirement');
});

test('a running action shows it is running and cannot be started twice', () => {
	const view = readFileSync(join(process.cwd(), 'src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts'), 'utf8');
	const action = view.slice(view.indexOf('private _action('), view.indexOf('private _action(') + 2400);
	// Normalize intent takes many seconds against a provider; with no feedback it reads as broken.
	assert.match(action, /b\.disabled = true/, 'the button is not disabled while the action runs');
	assert.match(action, /finally/, 'the button is never restored');
	assert.match(action, /aria-busy/, 'screen readers are not told the action is running');
});

test('every path that opens the review page supplies its scenarios', () => {
	const view = readFileSync(join(process.cwd(), 'src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts'), 'utf8');
	const calls = [...view.matchAll(/writeStructuredIntentReview\(([^)]*)\)/g)].map(m => m[1]);
	assert.ok(calls.length >= 1, 'expected at least the normalize path');
	for (const args of calls) {
		// Reaching the same page by normalizing and by reviewing must not give different pages.
		assert.match(args, /scenarios/, `writeStructuredIntentReview(${args}) omits the scenarios`);
	}
});

test('the row offers neither Review intent nor Approve intent', () => {
	const view = readFileSync(join(process.cwd(), 'src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts'), 'utf8');
	// Normalize already opens the review page, so a separate Review button is a second way to the
	// same place. Approve intent approved the raw requirement, not the intent, and is not in use.
	assert.ok(!view.includes("'Review intent'"), 'Review intent is still offered');
	assert.ok(!view.includes("'Approve intent'"), 'Approve intent is still offered');
	assert.ok(!view.includes('approveRequirement'), 'the requirement-approval call is still wired up');
});

test('a failing action always reports where the reader can see it', () => {
	const view = readFileSync(join(process.cwd(), 'src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts'), 'utf8');
	const action = view.slice(view.indexOf('private _action('), view.indexOf('private _action(') + 2200);
	// `New requirement` is rendered on the section, not on a requirement row. Writing the message
	// into host.parentElement put it somewhere the reader never looks, so the click read as a no-op.
	assert.ok(!/const row = host\.parentElement;\s*\n\s*if \(!row\) \{ return; \}/.test(action),
		'a failing action still gives up when the host is not a row');
	assert.match(action, /console\.error/, 'a failed action leaves no trace in the console');
	// The slot must be attached to the host itself when the host is not a row, never dropped.
	assert.match(action, /host\.parentElement \?\? host|host\.closest|\?\? host\b/, 'no fallback target for the error message');
});

test('an action failure outside a requirement row survives the re-render that follows it', () => {
	const view = readFileSync(join(process.cwd(), 'src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts'), 'utf8');
	// _renderProject clears the panel with `parent.textContent = ''`, and an action that changes
	// project state triggers exactly that render. A message written straight into the DOM is wiped
	// before it can be read, which is what made a failed "New requirement" look like a no-op.
	assert.match(view, /parent\.textContent = ''/, 'the render no longer clears the panel — revisit this test');
	assert.match(view, /sectionError/, 'section-level failures are not remembered across a render');
	// And the remembered message must be drawn again by the render that cleared it.
	const render = view.slice(view.indexOf('private async _renderProject('), view.indexOf('private _renderRequirementRow('));
	assert.match(render, /sectionError/, 'the render never redraws a remembered section error');
});

test('a running action is visibly running, not just relabelled', () => {
	const css = readFileSync(join(process.cwd(), 'src/vs/workbench/contrib/sys/browser/media/sysSemanticWorkbench.css'), 'utf8');
	// Normalize waits on a provider for tens of seconds. Three dots appended to the label is easy to
	// miss; a moving indicator is what tells the reader the click landed.
	assert.match(css, /\[aria-busy="true"\]/, 'no style for a running action');
	assert.match(css, /@keyframes/, 'the running indicator does not move');
});
