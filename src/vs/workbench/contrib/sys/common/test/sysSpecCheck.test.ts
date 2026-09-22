import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ontologyCompilerBinary, runSpecCheck } from '../sysSpecCheck.js';

test('ontologyCompilerBinary points at the exact binary spec-code-sync\'s own pipeline compiles the expected side with', () => {
	assert.equal(ontologyCompilerBinary('/p'), '/p/ontology-compiler/target/debug/ontology-compiler');
});

test('runSpecCheck: PARSE_OK on a clean compile', async () => {
	const ok = { run: async () => ({ exitCode: 0, stdout: '{}', stderr: '' }) };
	assert.deepEqual(await runSpecCheck(ok as never, '/p', '/a/.sys/specs/REQ-001.spec'), { kind: 'PARSE_OK' });
});

test('runSpecCheck: PARSE_ERROR carries the compiler\'s own message; a nonzero exit is its normal "no" answer', async () => {
	const bad = { run: async () => ({ exitCode: 1, stdout: '', stderr: 'unexpected token at line 3' }) };
	assert.deepEqual(await runSpecCheck(bad as never, '/p', '/a/.sys/specs/REQ-001.spec'), { kind: 'PARSE_ERROR', reason: 'unexpected token at line 3' });
});

test('runSpecCheck: CHECK_ERROR when the tool itself cannot run', async () => {
	const missing = { run: async () => { throw new Error('EXECUTABLE_NOT_FOUND: no such file'); } };
	const r = await runSpecCheck(missing as never, '/p', '/a/.sys/specs/REQ-001.spec') as { kind: string; reason: string };
	assert.equal(r.kind, 'CHECK_ERROR');
	assert.match(r.reason, /EXECUTABLE_NOT_FOUND/);
});

test('runSpecCheck spawns exactly ontology-compiler compile <file>', async () => {
	let seen: unknown;
	const spy = { run: async (cmd: string, args: string[], timeoutMs: number) => { seen = { cmd, args, timeoutMs }; return { exitCode: 0, stdout: '', stderr: '' }; } };
	await runSpecCheck(spy as never, '/p', '/a/.sys/specs/REQ-001.spec', 5000);
	assert.deepEqual(seen, { cmd: '/p/ontology-compiler/target/debug/ontology-compiler', args: ['compile', '/a/.sys/specs/REQ-001.spec'], timeoutMs: 5000 });
});
