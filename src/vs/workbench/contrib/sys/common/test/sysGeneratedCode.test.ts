import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectLanguage, requestGeneratedCode } from '../sysGeneratedCode.js';

// The language is the project's, never the model's: the editor names it, and the file it writes
// carries the extension that name implies.
test('reads the project language from the build file at the workspace root', () => {
	assert.deepEqual(projectLanguage(['pom.xml', 'src', '.sys']), { name: 'Java', extension: 'java' });
	assert.deepEqual(projectLanguage(['build.gradle.kts', 'src']), { name: 'Java', extension: 'java' });
	assert.deepEqual(projectLanguage(['go.mod']), { name: 'Go', extension: 'go' });
	assert.deepEqual(projectLanguage(['Cargo.toml']), { name: 'Rust', extension: 'rs' });
	assert.deepEqual(projectLanguage(['pyproject.toml']), { name: 'Python', extension: 'py' });
	// A TypeScript project has a package.json too, so the more specific marker has to win.
	assert.deepEqual(projectLanguage(['package.json', 'tsconfig.json']), { name: 'TypeScript', extension: 'ts' });
	assert.deepEqual(projectLanguage(['package.json']), { name: 'JavaScript', extension: 'js' });
});

test('a project with no build file it recognizes gets no guess', () => {
	assert.equal(projectLanguage(['README.md', '.sys']), undefined);
	assert.equal(projectLanguage([]), undefined);
});

const originalFetch = globalThis.fetch;

test('sends the approved intent and the project language, and returns the code', async () => {
	let request: Record<string, unknown> | undefined;
	let url = '';
	globalThis.fetch = async (input, init) => {
		url = String(input);
		request = JSON.parse(String(init?.body));
		return new Response(JSON.stringify({ code: 'public record Booking(String seat) {}' }), { status: 200 });
	};
	try {
		const code = await requestGeneratedCode('http://sidex/', 'm', '{"kind":"DATA_MODEL"}', 'Java');
		assert.equal(code, 'public record Booking(String seat) {}');
		assert.equal(url, 'http://sidex/v1/sys/generate-code');
		assert.deepEqual(request, { model: 'm', intent: '{"kind":"DATA_MODEL"}', language: 'Java' });
	} finally { globalThis.fetch = originalFetch; }
});

// Unlike the review page's scenarios, generated code is the whole point of the click: failing
// silently would leave the user staring at a button that did nothing.
test('surfaces the backend error instead of returning nothing', async () => {
	globalThis.fetch = async () => new Response(JSON.stringify({ error: 'anthropic is not connected' }), { status: 502 });
	try { await assert.rejects(requestGeneratedCode('http://sidex', 'm', '{}', 'Java'), /SideX could not generate code: anthropic is not connected/); }
	finally { globalThis.fetch = originalFetch; }
});

test('an empty answer is an error, not an empty file', async () => {
	globalThis.fetch = async () => new Response(JSON.stringify({ code: '   ' }), { status: 200 });
	try { await assert.rejects(requestGeneratedCode('http://sidex', 'm', '{}', 'Java'), /returned no code/); }
	finally { globalThis.fetch = originalFetch; }
});
