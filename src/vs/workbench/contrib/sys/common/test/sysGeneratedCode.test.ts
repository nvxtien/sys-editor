import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refuseToOverwrite, requestGeneratedCode } from '../sysGeneratedCode.js';

const originalFetch = globalThis.fetch;

// The editor forwards the platform's context unread and brings the answer back unread. What the
// answer means is sys-core's to say.
test('carries the prepared context to the provider and the answer home', async () => {
	let request: Record<string, unknown> | undefined;
	let url = '';
	globalThis.fetch = async (input, init) => {
		url = String(input);
		request = JSON.parse(String(init?.body));
		return new Response(JSON.stringify({ candidate: '=== src/A.java ===\nclass A {}' }), { status: 200 });
	};
	try {
		const answer = await requestGeneratedCode('http://sidex/', 'm', 'THE PREPARED CONTEXT');
		assert.equal(answer, '=== src/A.java ===\nclass A {}');
		assert.equal(url, 'http://sidex/v1/sys/generate-code');
		assert.deepEqual(request, { model: 'm', intent: 'THE PREPARED CONTEXT' });
	} finally { globalThis.fetch = originalFetch; }
});

test('surfaces the backend error instead of returning nothing', async () => {
	globalThis.fetch = async () => new Response(JSON.stringify({ error: 'anthropic is not connected' }), { status: 502 });
	try { await assert.rejects(requestGeneratedCode('http://sidex', 'm', '{}'), /SideX could not generate code: anthropic is not connected/); }
	finally { globalThis.fetch = originalFetch; }
});

test('an empty answer is an error, not an empty write', async () => {
	globalThis.fetch = async () => new Response(JSON.stringify({ candidate: '   ' }), { status: 200 });
	try { await assert.rejects(requestGeneratedCode('http://sidex', 'm', '{}'), /returned no code/); }
	finally { globalThis.fetch = originalFetch; }
});

// Generating over a file the user wrote destroys work no undo brings back. The model usually
// avoids the clash on its own, having been shown the project's files — which is exactly why this
// last line of defence needs a test that does not depend on the model behaving.
test('a generation that would overwrite an existing file writes nothing and names it', () => {
	assert.doesNotThrow(() => refuseToOverwrite([]));
	assert.throws(() => refuseToOverwrite(['src/main/java/com/example/Category.java']),
		/Nothing was written: src\/main\/java\/com\/example\/Category\.java already exists in this project\. Delete it first/);
	assert.throws(() => refuseToOverwrite(['a/Category.java', 'a/Book.java']),
		/Nothing was written: a\/Category\.java, a\/Book\.java already exist in this project\. Delete them first/);
});
