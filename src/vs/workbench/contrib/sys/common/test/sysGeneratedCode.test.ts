import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectLanguage, refuseToOverwrite, requestGeneratedCode } from '../sysGeneratedCode.js';

// The language is the project's, never the model's: the code is added to a source tree already
// written in one language.
test('reads the project language from the build file at the workspace root', () => {
	assert.deepEqual(projectLanguage(['pom.xml', 'src', '.sys']), { name: 'Java', sourceDir: 'src' });
	assert.deepEqual(projectLanguage(['build.gradle.kts', 'src']), { name: 'Java', sourceDir: 'src' });
	assert.deepEqual(projectLanguage(['go.mod']), { name: 'Go', sourceDir: '.' });
	assert.deepEqual(projectLanguage(['Cargo.toml']), { name: 'Rust', sourceDir: 'src' });
	assert.deepEqual(projectLanguage(['pyproject.toml']), { name: 'Python', sourceDir: '.' });
	// A TypeScript project has a package.json too, so the more specific marker has to win.
	assert.deepEqual(projectLanguage(['package.json', 'tsconfig.json']), { name: 'TypeScript', sourceDir: 'src' });
	assert.deepEqual(projectLanguage(['package.json']), { name: 'JavaScript', sourceDir: 'src' });
});

test('a project with no build file it recognizes gets no guess', () => {
	assert.equal(projectLanguage(['README.md', '.sys']), undefined);
	assert.equal(projectLanguage([]), undefined);
});

const originalFetch = globalThis.fetch;
const oneFile = (path: string, code = 'class A {}') => ({ files: [{ path, code }] });

test('sends the intent, the language and the project’s existing source files', async () => {
	let request: Record<string, unknown> | undefined;
	let url = '';
	globalThis.fetch = async (input, init) => {
		url = String(input);
		request = JSON.parse(String(init?.body));
		return new Response(JSON.stringify(oneFile('src/main/java/com/example/Category.java')), { status: 200 });
	};
	try {
		const files = await requestGeneratedCode('http://sidex/', 'm', '{"kind":"DATA_MODEL"}', 'Java', ['src/main/java/com/example/App.java']);
		assert.deepEqual(files, [{ path: 'src/main/java/com/example/Category.java', code: 'class A {}' }]);
		assert.equal(url, 'http://sidex/v1/sys/generate-code');
		assert.deepEqual(request, { model: 'm', intent: '{"kind":"DATA_MODEL"}', language: 'Java', sourceFiles: ['src/main/java/com/example/App.java'] });
	} finally { globalThis.fetch = originalFetch; }
});

// The server checks these paths too. This is the second check, because a path from here becomes a
// write into the user's project and one check between a model and their disk is not enough.
test('refuses a path that leaves the project, whatever the server returned', async () => {
	for (const path of ['../outside.java', '/etc/passwd', 'src/../../x.java', 'src\\..\\..\\x.java', '']) {
		globalThis.fetch = async () => new Response(JSON.stringify(oneFile(path)), { status: 200 });
		try { await assert.rejects(requestGeneratedCode('http://sidex', 'm', '{}', 'Java', []), /outside the project/, `accepted ${path}`); }
		finally { globalThis.fetch = originalFetch; }
	}
});

// Unlike the review page's scenarios, generated code is the whole point of the click: failing
// silently would leave the user staring at a button that did nothing.
test('surfaces the backend error instead of returning nothing', async () => {
	globalThis.fetch = async () => new Response(JSON.stringify({ error: 'anthropic is not connected' }), { status: 502 });
	try { await assert.rejects(requestGeneratedCode('http://sidex', 'm', '{}', 'Java', []), /SideX could not generate code: anthropic is not connected/); }
	finally { globalThis.fetch = originalFetch; }
});

test('an answer with no files is an error, not an empty write', async () => {
	globalThis.fetch = async () => new Response(JSON.stringify({ files: [] }), { status: 200 });
	try { await assert.rejects(requestGeneratedCode('http://sidex', 'm', '{}', 'Java', []), /returned no code/); }
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
