import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approveStructuredIntent, canGenerateFormalSpec, formalSpecState, parseStructuredIntent, serializeStructuredIntent, structuredIntentState, SysStructuredIntentRecord } from '../sysStructuredIntent.js';

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

test('approval binds to exact intent content and raw requirement', () => {
	const record: SysStructuredIntentRecord = { sourceRequirement: 'A booking request must contain at least one seat.', draft };
	const approved = approveStructuredIntent(record, record.sourceRequirement);
	assert.equal(structuredIntentState(approved, record.sourceRequirement), 'APPROVED');
	assert.equal(structuredIntentState(approved, `${record.sourceRequirement}!`), 'STALE');
	assert.equal(structuredIntentState({ ...approved, draft: { ...draft, unknowns: ['different'] } }, record.sourceRequirement), 'STALE');
});

test('Formal Spec generation requires approved intent and authoritative operation', () => {
	const record: SysStructuredIntentRecord = { sourceRequirement: 'raw', draft };
	assert.equal(canGenerateFormalSpec(record, 'raw'), false);
	const bound = { ...draft, operation: { value: 'BookingService.createBooking', provenance: 'OBSERVED' as const } };
	const approved = approveStructuredIntent({ ...record, draft: bound }, 'raw');
	assert.equal(canGenerateFormalSpec(approved, 'raw'), true);
});

test('serialized intent survives Unicode and newlines', () => {
	assert.match(serializeStructuredIntent({ ...draft, intentStatement: { value: 'Dòng đầu\n日本語', provenance: 'SPECIFIED' } }), /日本語/);
});

test('upstream edits make an approved Formal Spec stale', () => {
	const bound = { ...draft, operation: { value: 'BookingService.createBooking', provenance: 'OBSERVED' as const } };
	const intent = approveStructuredIntent({ sourceRequirement: 'raw', draft: bound }, 'raw');
	const spec = serializeStructuredIntent(bound);
	assert.equal(formalSpecState(spec, serializeStructuredIntent(bound), spec, intent, 'raw'), 'APPROVED');
	assert.equal(formalSpecState(spec, serializeStructuredIntent(bound), spec, intent, 'changed'), 'STALE');
	assert.equal(formalSpecState(spec, serializeStructuredIntent(bound), `${spec}!`, intent, 'raw'), 'STALE');
});
