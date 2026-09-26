import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestIntentScenarios } from '../sysIntentScenarios.js';

const originalFetch = globalThis.fetch;

test('sends the intent JSON and returns the scenarios', async () => {
	let body: Record<string, unknown> | undefined;
	globalThis.fetch = async (_input, init) => {
		body = JSON.parse(String(init?.body));
		return new Response(JSON.stringify({ scenarios: 'Scenario: A\n  Given b' }), { status: 200 });
	};
	try {
		const text = await requestIntentScenarios('http://sidex/', 'm', '{"kind":"DATA_MODEL"}');
		assert.equal(text, 'Scenario: A\n  Given b');
		assert.equal(body?.model, 'm');
		assert.equal(body?.intent, '{"kind":"DATA_MODEL"}');
	} finally { globalThis.fetch = originalFetch; }
});

// Scenarios are a reading aid. A provider that is down, slow or misconfigured must not stop the
// reviewer opening the page that shows what they are confirming.
test('a provider failure yields no scenarios instead of throwing', async () => {
	for (const fail of [
		async () => { throw new Error('offline'); },
		async () => new Response('{"error":"provider exploded"}', { status: 502 }),
		async () => new Response('not json', { status: 200 })
	]) {
		globalThis.fetch = fail as typeof globalThis.fetch;
		try {
			assert.equal(await requestIntentScenarios('http://sidex/', 'm', '{}'), undefined);
		} finally { globalThis.fetch = originalFetch; }
	}
});

test('an empty reply means the intent states no behaviour to show', async () => {
	globalThis.fetch = async () => new Response(JSON.stringify({ scenarios: '   ' }), { status: 200 });
	try {
		assert.equal(await requestIntentScenarios('http://sidex/', 'm', '{}'), undefined);
	} finally { globalThis.fetch = originalFetch; }
});
