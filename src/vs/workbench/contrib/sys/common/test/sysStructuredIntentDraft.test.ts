import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestStructuredIntent } from '../sysStructuredIntentDraft.js';

const originalFetch = globalThis.fetch;
test('normalizes only the requirement and never carries a source operation', async () => {
	let request: Record<string, unknown> | undefined;
	globalThis.fetch = async (_input, init) => {
		request = JSON.parse(String(init?.body));
		return new Response(JSON.stringify({ structuredIntent: JSON.stringify({ version: 1, requirementId: 'REQ-001', kind: 'OPERATION_RULE', intentStatement: { value: 'seat', provenance: 'SPECIFIED' }, scope: { value: 'booking', provenance: 'DERIVED' }, operation: { value: 'create booking', provenance: 'SPECIFIED' }, inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: ['exception type'] }) }), { status: 200 });
	};
	try {
		const result = await requestStructuredIntent('http://sidex/', 'm', 'REQ-001', 'A booking needs a seat.');
		assert.equal(result.operation.value, 'create booking');
		assert.equal(request?.model, 'm');
		assert.equal(request?.intent, 'A booking needs a seat.');
		// Normalization takes the requirement alone; no source symbol is ever sent with it.
		assert.equal('operation' in (request ?? {}), false);
	} finally { globalThis.fetch = originalFetch; }
});

test('rejects provider output that is not a Structured Intent', async () => {
	globalThis.fetch = async () => new Response(JSON.stringify({ structuredIntent: JSON.stringify({ version: 1, requirementId: 'REQ-001' }) }), { status: 200 });
	try { await assert.rejects(requestStructuredIntent('http://sidex', 'm', 'REQ-001', 'intent'), /Structured Intent has (an )?invalid/); }
	finally { globalThis.fetch = originalFetch; }
});

function captureTraces(): { lines: string[]; restore: () => void } {
	const original = console.info;
	const lines: string[] = [];
	console.info = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
	return { lines, restore: () => { console.info = original; } };
}

const fact = (value: string) => ({ value, provenance: 'SPECIFIED' });

test('sends the correlation id in the body (no custom header, so no CORS preflight to fail) and traces each client stage', async () => {
	let headers: Record<string, string> = {};
	let body: Record<string, unknown> = {};
	globalThis.fetch = async (_input, init) => {
		headers = init?.headers as Record<string, string>;
		body = JSON.parse(String(init?.body));
		return new Response(JSON.stringify({ structuredIntent: JSON.stringify({ version: 1, requirementId: 'REQ-001', kind: 'OPERATION_RULE', intentStatement: fact('a'), scope: fact('b'), operation: fact('c'), inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: [] }) }), { status: 200 });
	};
	const traces = captureTraces();
	try {
		await requestStructuredIntent('http://127.0.0.1:55847', 'm', 'REQ-001', 'intent', 'req-42');
		assert.equal(body.requestId, 'req-42');
		assert.deepEqual(Object.keys(headers), ['Content-Type']);
		assert.deepEqual(traces.lines.map(line => line.match(/stage=(\w+)/)?.[1]), ['request_sent', 'response', 'parsed']);
		assert.ok(traces.lines.every(line => line.includes('id=req-42')));
		assert.match(traces.lines[0], /url=http:\/\/127\.0\.0\.1:55847\/v1\/sys\/normalize-intent/);
	} finally { traces.restore(); globalThis.fetch = originalFetch; }
});

test('explains a contract violation instead of failing silently (object-keyed inputs from a real provider)', async () => {
	globalThis.fetch = async () => new Response(JSON.stringify({ structuredIntent: JSON.stringify({ version: 1, requirementId: 'REQ-001', kind: 'OPERATION_RULE', intentStatement: fact('a'), scope: fact('b'), operation: fact('c'), inputs: { Category_class: fact('x') }, constraints: [], effects: fact('e'), failureBehavior: fact('f'), unknowns: [] }) }), { status: 200 });
	const traces = captureTraces();
	try {
		await assert.rejects(requestStructuredIntent('http://sidex', 'm', 'REQ-001', 'intent', 'req-7'), /does not match the Structured Intent contract \(Structured Intent has an invalid inputs\)\. Nothing was saved/);
		assert.ok(traces.lines.some(line => line.includes('id=req-7 stage=rejected')));
	} finally { traces.restore(); globalThis.fetch = originalFetch; }
});

test('surfaces the backend error text when the provider fails', async () => {
	globalThis.fetch = async () => new Response(JSON.stringify({ error: 'openai is not connected' }), { status: 502 });
	try { await assert.rejects(requestStructuredIntent('http://sidex', 'm', 'REQ-001', 'intent'), /SideX could not normalize the requirement: openai is not connected/); }
	finally { globalThis.fetch = originalFetch; }
});

test('a normalized answer without a kind is rejected: a kind is never assumed for new intents', async () => {
	globalThis.fetch = async () => new Response(JSON.stringify({ structuredIntent: JSON.stringify({ version: 1, requirementId: 'REQ-001', intentStatement: fact('a'), scope: fact('b'), operation: fact('c'), inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: [] }) }), { status: 200 });
	try { await assert.rejects(requestStructuredIntent('http://sidex', 'm', 'REQ-001', 'intent'), /Structured Intent has an invalid kind\)\. Nothing was saved/); }
	finally { globalThis.fetch = originalFetch; }
});
