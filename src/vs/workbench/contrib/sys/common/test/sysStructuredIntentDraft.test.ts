import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestStructuredIntent } from '../sysStructuredIntentDraft.js';

const originalFetch = globalThis.fetch;
test('normalizes only the requirement and preserves an authoritative operation when supplied', async () => {
	let request: Record<string, unknown> | undefined;
	globalThis.fetch = async (_input, init) => {
		request = JSON.parse(String(init?.body));
		return new Response(JSON.stringify({ structuredIntent: JSON.stringify({ version: 1, requirementId: 'REQ-001', intentStatement: { value: 'seat', provenance: 'SPECIFIED' }, scope: { value: 'booking', provenance: 'DERIVED' }, operation: { value: 'BookingService.createBooking', provenance: 'OBSERVED' }, inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: ['exception type'] }) }), { status: 200 });
	};
	try {
		const result = await requestStructuredIntent('http://sidex/', 'm', 'REQ-001', 'A booking needs a seat.', 'BookingService.createBooking');
		assert.equal(result.operation.value, 'BookingService.createBooking');
		assert.deepEqual(request, { model: 'm', intent: 'A booking needs a seat.', operation: 'BookingService.createBooking' });
	} finally { globalThis.fetch = originalFetch; }
});

test('rejects provider output that is not a Structured Intent', async () => {
	globalThis.fetch = async () => new Response(JSON.stringify({ structuredIntent: JSON.stringify({ version: 1, requirementId: 'REQ-001' }) }), { status: 200 });
	try { await assert.rejects(requestStructuredIntent('http://sidex', 'm', 'REQ-001', 'intent'), /Structured Intent has invalid/); }
	finally { globalThis.fetch = originalFetch; }
});
