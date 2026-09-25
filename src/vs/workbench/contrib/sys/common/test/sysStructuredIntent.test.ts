import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStructuredIntent, serializeStructuredIntent } from '../sysStructuredIntent.js';

// Approval, exact-content binding and staleness are decided by sys-core
// (sys-core/tests/lifecycle_state.rs). This file covers only the candidate schema.

const draft = parseStructuredIntent({
	version: 1,
	requirementId: 'REQ-001',
	intentStatement: { value: 'A booking request must contain at least one seat.', provenance: 'SPECIFIED' },
	scope: { value: 'Booking creation', provenance: 'DERIVED' },
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
	assert.match(serializeStructuredIntent({ ...draft, intentStatement: { value: 'Dòng đầu\n日本語', provenance: 'SPECIFIED' } }), /日本語/);
});

test('a candidate with the wrong shape or provenance is rejected, never coerced', () => {
	assert.throws(() => parseStructuredIntent({ ...draft, requirementId: 'REQ-002' }, 'REQ-001'), /invalid header/);
	assert.throws(() => parseStructuredIntent({ ...draft, scope: { value: 's', provenance: 'GUESSED' } }, 'REQ-001'), /invalid scope/);
	assert.throws(() => parseStructuredIntent({ ...draft, inputs: { seats: { value: 's', provenance: 'SPECIFIED' } } }, 'REQ-001'), /invalid inputs/);
	assert.throws(() => parseStructuredIntent({ ...draft, unknowns: [1] }, 'REQ-001'), /invalid unknowns/);
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
	const intent = parseStructuredIntent(dataModelRaw, 'REQ-001');
	assert.equal(intent.operation, null);
	assert.equal(intent.entities?.length, 2);
	assert.equal(intent.entities?.[0].name, 'Category');
	assert.deepEqual(intent.entities?.[0].fields[0], { name: 'id', type: 'INT', provenance: 'SPECIFIED' });
	assert.equal(intent.relationships?.[0].value, 'Each Book belongs to exactly one Category');
});

test('an operation rule still parses its operation fact and needs no entities', () => {
	const rule = parseStructuredIntent({
		version: 1, requirementId: 'REQ-001', kind: 'OPERATION_RULE',
		intentStatement: { value: 'x', provenance: 'SPECIFIED' }, scope: { value: 'x', provenance: 'SPECIFIED' },
		operation: { value: 'create booking', provenance: 'SPECIFIED' },
		inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: []
	}, 'REQ-001');
	assert.equal(rule.operation?.value, 'create booking');
	assert.equal(rule.entities, undefined);
});

test('a malformed entity or relationship is rejected, never half-read', () => {
	assert.throws(() => parseStructuredIntent({ ...dataModelRaw, entities: [{ name: 'Category' }] }, 'REQ-001'), /invalid entities/);
	assert.throws(() => parseStructuredIntent({ ...dataModelRaw, entities: [{ name: '', fields: [] }] }, 'REQ-001'), /invalid entities/);
	assert.throws(() => parseStructuredIntent({ ...dataModelRaw, entities: [{ name: 'C', fields: [{ name: 'id' }] }] }, 'REQ-001'), /invalid entities/);
	assert.throws(() => parseStructuredIntent({ ...dataModelRaw, relationships: ['plain string'] }, 'REQ-001'), /invalid relationships/);
});

test('a record written before entities existed still parses unchanged', () => {
	const legacy = parseStructuredIntent({
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
