import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSysDraftOperationBinding, assertSysDraftServerAvailable, requestSysFormalSpecDraft } from '../sysFormalSpecDraft.js';

test('requires an authoritative operation binding before drafting', () => {
	assert.throws(() => assertSysDraftOperationBinding(undefined), /Bind this requirement to a source operation before drafting/);
	assert.doesNotThrow(() => assertSysDraftOperationBinding('BookingService.createBooking'));
});

test('requires the local SideX server unless a custom server URL is configured', () => {
	assert.throws(() => assertSysDraftServerAvailable(false, undefined), /SideX server is not running/);
	assert.doesNotThrow(() => assertSysDraftServerAvailable(true, undefined));
	assert.doesNotThrow(() => assertSysDraftServerAvailable(false, 'https://sidex.example'));
});

const originalFetch = globalThis.fetch;
const replaceFetch = (fetch: typeof globalThis.fetch) => {
	globalThis.fetch = fetch;
	return () => { globalThis.fetch = originalFetch; };
};

test('sends the selected model and only the saved intent to the one-shot endpoint', async () => {
	let requestUrl = '';
	let requestInit: RequestInit | undefined;
	const restore = replaceFetch(async (input, init) => {
		requestUrl = String(input);
		requestInit = init;
		return new Response(JSON.stringify({ draftSpec: 'Requirement: Booking\n\nOperation: create booking\n\nThe operation is allowed when booking status is READY.' }), { status: 200 });
	});
	try {
		const result = await requestSysFormalSpecDraft('http://127.0.0.1:7433/', 'openrouter/model-x', 'A booking must have one seat.');
		assert.equal(result, 'Requirement: Booking\n\nOperation: create booking\n\nThe operation is allowed when booking status is READY.');
		assert.equal(requestUrl, 'http://127.0.0.1:7433/v1/sys/draft-spec');
		assert.equal(requestInit?.method, 'POST');
		assert.equal(requestInit?.headers && (requestInit.headers as Record<string, string>)['Content-Type'], 'application/json');
		assert.deepEqual(JSON.parse(String(requestInit?.body)), { model: 'openrouter/model-x', intent: 'A booking must have one seat.' });
		assert.ok(requestInit?.signal instanceof AbortSignal);
	} finally {
		restore();
	}
});

test('preserves provider text for Platform validation', async () => {
	const draft = '```text\nRequirement: Booking\n\nOperation: create booking\n```';
	const restore = replaceFetch(async () => new Response(JSON.stringify({ draftSpec: draft }), { status: 200 }));
	try {
		assert.equal(await requestSysFormalSpecDraft('http://sidex', 'm', 'intent'), draft);
	} finally {
		restore();
	}
});

test('reports SideX error responses without treating them as a draft', async () => {
	const restore = replaceFetch(async () => new Response(JSON.stringify({ error: 'provider request failed' }), { status: 502 }));
	try {
		await assert.rejects(requestSysFormalSpecDraft('http://sidex', 'm', 'intent'), /provider request failed/);
	} finally {
		restore();
	}
});

test('rejects malformed JSON and responses without non-empty draftSpec', async () => {
	for (const body of ['not json', '{}', JSON.stringify({ draftSpec: '  ' })]) {
		const restore = replaceFetch(async () => new Response(body, { status: 200 }));
		try {
			await assert.rejects(requestSysFormalSpecDraft('http://sidex', 'm', 'intent'));
		} finally {
			restore();
		}
	}
});

test('reports network and timeout failures as actionable SideX errors', async () => {
	const restore = replaceFetch(async () => { throw new DOMException('The operation timed out', 'TimeoutError'); });
	try {
		await assert.rejects(requestSysFormalSpecDraft('http://sidex', 'm', 'intent'), /SideX/);
	} finally {
		restore();
	}
});
