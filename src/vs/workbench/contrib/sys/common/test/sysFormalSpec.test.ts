import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFormalSpec, serializeFormalSpec } from '../sysFormalSpec.js';

// Approval, exact-content binding and staleness are decided by sys-core
// (sys-core/tests/lifecycle_state.rs). This file covers only the candidate schema.

const draft = parseFormalSpec({
	version: 1,
	requirementId: 'REQ-001',
	intentStatement: { value: 'An order request must contain at least one item.', provenance: 'SPECIFIED' },
	scope: { value: 'Order creation', provenance: 'DERIVED' },
	operation: { value: 'UNKNOWN', provenance: 'UNKNOWN' },
	inputs: [{ value: 'requestedSeats', provenance: 'INFERRED' }],
	constraints: [{ value: 'requestedSeats must contain at least one element', provenance: 'SPECIFIED' }],
	effects: [],
	failureBehavior: [],
	unknowns: ['exception type', 'exact error message'],
}, 'REQ-001');

test('preserves structured facts, provenance, and unknowns without guessing operation', () => {
	assert.equal(draft.constraints[0].provenance, 'SPECIFIED');
	assert.equal(draft.operation.provenance, 'UNKNOWN');
	assert.deepEqual(draft.unknowns, ['exception type', 'exact error message']);
});

test('serialized intent survives Unicode and newlines', () => {
	assert.match(serializeFormalSpec({ ...draft, intentStatement: { value: 'Dòng đầu\n日本語', provenance: 'SPECIFIED' } }), /日本語/);
});

test('a candidate with the wrong shape or provenance is rejected, never coerced', () => {
	assert.throws(() => parseFormalSpec({ ...draft, requirementId: 'REQ-002' }, 'REQ-001'), /invalid header/);
	assert.throws(() => parseFormalSpec({ ...draft, scope: { value: 's', provenance: 'GUESSED' } }, 'REQ-001'), /invalid scope/);
	assert.throws(() => parseFormalSpec({ ...draft, inputs: { seats: { value: 's', provenance: 'SPECIFIED' } } }, 'REQ-001'), /invalid inputs/);
	assert.throws(() => parseFormalSpec({ ...draft, unknowns: [1] }, 'REQ-001'), /invalid unknowns/);
});

// Kind-aware shape: a data model states entities and relationships, and has no operation. Keeping
// its fields in `inputs` and its relationships in `constraints` named them wrongly, and an
// `operation` of UNKNOWN read as a question the user still had to answer.
const dataModelRaw = {
	version: 1,
	requirementId: 'REQ-001',
	kind: 'DATA_MODEL',
	intentStatement: { value: 'Two entities', provenance: 'SPECIFIED' },
	scope: { value: 'Category and Book', provenance: 'SPECIFIED' },
	operation: null,
	entities: [
		{ name: 'Category', fields: [{ name: 'id', type: 'INT', provenance: 'SPECIFIED' }] },
		{ name: 'Book', fields: [{ name: 'title', type: 'string', provenance: 'SPECIFIED' }] }
	],
	relationships: [{ value: 'Each Book belongs to exactly one Category', provenance: 'SPECIFIED' }],
	inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: []
};

test('a data model intent parses entities, relationships and a null operation', () => {
	const intent = parseFormalSpec(dataModelRaw, 'REQ-001');
	assert.equal(intent.operation, null);
	assert.equal(intent.entities?.length, 2);
	assert.equal(intent.entities?.[0].name, 'Category');
	assert.deepEqual(intent.entities?.[0].fields[0], { name: 'id', type: 'INT', provenance: 'SPECIFIED' });
	assert.equal(intent.relationships?.[0].value, 'Each Book belongs to exactly one Category');
});

test('an operation rule still parses its operation fact and needs no entities', () => {
	const rule = parseFormalSpec({
		version: 1, requirementId: 'REQ-001', kind: 'OPERATION_RULE',
		intentStatement: { value: 'x', provenance: 'SPECIFIED' }, scope: { value: 'x', provenance: 'SPECIFIED' },
		operation: { value: 'create order', provenance: 'SPECIFIED' },
		inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: []
	}, 'REQ-001');
	assert.equal(rule.operation?.value, 'create order');
	assert.equal(rule.entities, undefined);
});

test('a malformed entity or relationship is rejected, never half-read', () => {
	assert.throws(() => parseFormalSpec({ ...dataModelRaw, entities: [{ name: 'Category' }] }, 'REQ-001'), /invalid entities/);
	assert.throws(() => parseFormalSpec({ ...dataModelRaw, entities: [{ name: '', fields: [] }] }, 'REQ-001'), /invalid entities/);
	assert.throws(() => parseFormalSpec({ ...dataModelRaw, entities: [{ name: 'C', fields: [{ name: 'id' }] }] }, 'REQ-001'), /invalid entities/);
	assert.throws(() => parseFormalSpec({ ...dataModelRaw, relationships: ['plain string'] }, 'REQ-001'), /invalid relationships/);
});

test('a record written before entities existed still parses unchanged', () => {
	const legacy = parseFormalSpec({
		version: 1, requirementId: 'REQ-001', kind: 'DATA_MODEL',
		intentStatement: { value: 'x', provenance: 'SPECIFIED' }, scope: { value: 'x', provenance: 'SPECIFIED' },
		operation: { value: 'UNKNOWN', provenance: 'UNKNOWN' },
		inputs: [{ value: 'Category.id: INT', provenance: 'SPECIFIED' }],
		constraints: [], effects: [], failureBehavior: [], unknowns: []
	}, 'REQ-001');
	assert.equal(legacy.entities, undefined);
	assert.equal(legacy.operation?.value, 'UNKNOWN');
	assert.equal(legacy.inputs.length, 1);
});

// Scenarios are a plain-language projection for the reviewer, in the same FACT shape as every other
// fact so nothing new has to be validated. The JSON stays the governed record.


// The prompt tells a data model to emit no inputs, effects or failureBehavior. Requiring them here
// rejected the very answer the prompt asked for: "Formal Spec has an invalid inputs".
test('a kind that states no inputs, effects or failures parses with empty lists', () => {
	const intent = parseFormalSpec({
		version: 1, requirementId: 'REQ-001', kind: 'DATA_MODEL',
		intentStatement: { value: 'Two entities', provenance: 'SPECIFIED' },
		scope: { value: 'Category and Book', provenance: 'SPECIFIED' },
		operation: null,
		entities: [{ name: 'Category', fields: [{ name: 'id', type: 'INT', provenance: 'SPECIFIED' }] }],
		relationships: [{ value: 'Each Book belongs to one Category', provenance: 'SPECIFIED' }],
		unknowns: []
	}, 'REQ-001');
	assert.deepEqual(intent.inputs, []);
	assert.deepEqual(intent.effects, []);
	assert.deepEqual(intent.failureBehavior, []);
	assert.deepEqual(intent.constraints, []);
	assert.equal(intent.entities?.length, 1);
});

test('a malformed list is still rejected, absent is not the same as wrong', () => {
	const base = {
		version: 1, requirementId: 'REQ-001', kind: 'OPERATION_RULE',
		intentStatement: { value: 'x', provenance: 'SPECIFIED' }, scope: { value: 'x', provenance: 'SPECIFIED' },
		operation: { value: 'create order', provenance: 'SPECIFIED' }, unknowns: []
	};
	assert.throws(() => parseFormalSpec({ ...base, inputs: 'not a list' }, 'REQ-001'), /invalid inputs/);
	assert.throws(() => parseFormalSpec({ ...base, inputs: [{ value: 'x' }] }, 'REQ-001'), /invalid inputs/);
});

test('unknowns may be absent too', () => {
	const intent = parseFormalSpec({
		version: 1, requirementId: 'REQ-001', kind: 'DATA_MODEL',
		intentStatement: { value: 'x', provenance: 'SPECIFIED' }, scope: { value: 'x', provenance: 'SPECIFIED' },
		operation: null
	}, 'REQ-001');
	assert.deepEqual(intent.unknowns, []);
});

test('behavior and thenDecisions are absent by default and parse when present', () => {
	const withoutThem = parseFormalSpec({
		version: 1, requirementId: 'REQ-001', kind: 'OPERATION_RULE',
		intentStatement: { value: 'x', provenance: 'SPECIFIED' }, scope: { value: 'x', provenance: 'SPECIFIED' },
		operation: { value: 'cancel order', provenance: 'SPECIFIED' },
		inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: []
	}, 'REQ-001');
	assert.equal(withoutThem.behavior, undefined);
	assert.equal(withoutThem.thenDecisions, undefined);

	const withNullThenDecisions = parseFormalSpec({
		version: 1, requirementId: 'REQ-001', kind: 'OPERATION_RULE',
		intentStatement: { value: 'x', provenance: 'SPECIFIED' }, scope: { value: 'x', provenance: 'SPECIFIED' },
		operation: { value: 'cancel order', provenance: 'SPECIFIED' },
		inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: [],
		thenDecisions: null
	}, 'REQ-001');
	assert.equal(withNullThenDecisions.thenDecisions, undefined);

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
