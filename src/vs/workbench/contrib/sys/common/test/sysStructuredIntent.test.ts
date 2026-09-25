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
