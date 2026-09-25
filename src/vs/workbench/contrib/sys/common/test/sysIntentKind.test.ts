import { test } from 'node:test';
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

test('an intent that states no operation is refused before a draft is attempted', () => {
	// The grammar needs an Operation: declaration. Offering Generate here spends three LLM round
	// trips and ends in "MALFORMED_SPEC missing Operation: declaration", so it is refused up front.
	assert.equal(parseFormalizationCapability(CAPABILITY.unstated).outcome, 'OPERATION_UNSPECIFIED');
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
	assert.match(formalizationNote(CAPABILITY.gap)!, /PLATFORM_FORMAL_SPEC_GAP/);
	assert.match(formalizationNote(CAPABILITY.gap)!, /Data model/);
	assert.doesNotMatch(formalizationNote(CAPABILITY.gap)!, /bind|binding/i);
	assert.doesNotMatch(formalizationNote(CAPABILITY.unknown)!, /bind|binding/i);
	assert.match(formalizationNote(CAPABILITY.unknown)!, /nothing to formalize yet/);
});

test('a record written before kinds existed needs no binding to be formalizable', () => {
	assert.equal(parseStructuredIntent(raw(undefined), 'REQ-001').kind, undefined);
	assert.doesNotThrow(() => assertSysDraftFormalizable(parseFormalizationCapability(CAPABILITY.ready)));
});

test('drafting is refused with the reason that matches the outcome', () => {
	assert.doesNotThrow(() => assertSysDraftFormalizable(CAPABILITY.ready));
	assert.throws(() => assertSysDraftFormalizable(CAPABILITY.gap), /PLATFORM_FORMAL_SPEC_GAP/);
	assert.throws(() => assertSysDraftFormalizable(CAPABILITY.unknown), /no formalizable kind yet/);
});

test('the review page shows the kind as a model classification and the capability note from core', () => {
	const gap = renderStructuredIntentReview(record('DATA_MODEL', 'x'), CAPABILITY.gap);
	assert.ok(gap.includes('## Kind'));
	assert.ok(gap.includes('Data model — ⚠ model’s classification, please check'));
	assert.ok(gap.includes('PLATFORM_FORMAL_SPEC_GAP'));
	assert.ok(renderStructuredIntentReview(record('OPERATION_RULE'), CAPABILITY.ready).includes('A Formal Spec can be generated'));
});

test('the review page never claims a capability it could not read from core', () => {
	const text = renderStructuredIntentReview(record('DATA_MODEL'), undefined);
	assert.ok(text.includes('could not be read from sys-core'));
	assert.ok(!text.includes('A Formal Spec can be generated'));
});
