import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBinding, decodeProgramIrFunctionNames } from '../sysBindingCheck.js';

const IR = JSON.stringify({ functions: [{ name: 'BookingService.createBooking' }, { name: 'BookingService.hasDuplicate' }] });

test('decodeProgramIrFunctionNames reads only functions[].name from the same program IR reverse.ProjectMain emits', () => {
	assert.deepEqual(decodeProgramIrFunctionNames(IR), ['BookingService.createBooking', 'BookingService.hasDuplicate']);
});

test('decodeProgramIrFunctionNames on malformed/foreign JSON is empty, never a guess', () => {
	assert.deepEqual(decodeProgramIrFunctionNames('not json'), []);
	assert.deepEqual(decodeProgramIrFunctionNames('{"functions":"nope"}'), []);
	assert.deepEqual(decodeProgramIrFunctionNames('{"functions":[{"name":7}]}'), []);
});

test('checkBinding: FOUND when the qualified name is present', () => {
	assert.deepEqual(checkBinding(IR, 'BookingService.createBooking'), { kind: 'FOUND' });
});

test('checkBinding: NOT_FOUND when the project IR has no such function', () => {
	assert.deepEqual(checkBinding(IR, 'BookingService.missing'), { kind: 'NOT_FOUND' });
});

test('checkBinding never matches on unqualified/partial name', () => {
	assert.deepEqual(checkBinding(IR, 'createBooking'), { kind: 'NOT_FOUND' });
});

test('runBindingCheck: FOUND/NOT_FOUND on a clean run, CHECK_ERROR on a failing or malformed run', async () => {
	const { runBindingCheck } = await import('../sysBindingCheck.js');
	const ok = { run: async () => ({ exitCode: 0, stdout: IR, stderr: '' }) };
	assert.deepEqual(await runBindingCheck(ok as never, { platformRoot: '/p', projectRoot: '/proj' }, 'BookingService.createBooking'), { kind: 'FOUND' });
	const failing = { run: async () => ({ exitCode: 1, stdout: '', stderr: 'javac error' }) };
	const err = await runBindingCheck(failing as never, { platformRoot: '/p', projectRoot: '/proj' }, 'A.b') as { kind: string; reason: string };
	assert.equal(err.kind, 'CHECK_ERROR');
	assert.match(err.reason, /javac error/);
	const garbled = { run: async () => ({ exitCode: 0, stdout: 'not json', stderr: '' }) };
	assert.equal((await runBindingCheck(garbled as never, { platformRoot: '/p', projectRoot: '/proj' }, 'A.b') as { kind: string }).kind, 'CHECK_ERROR');
});

test('runBindingCheck spawns exactly reverse.ProjectMain the way spec-code-sync does', async () => {
	const { runBindingCheck } = await import('../sysBindingCheck.js');
	let seen: unknown;
	const spy = { run: async (cmd: string, args: string[], timeoutMs: number) => { seen = { cmd, args, timeoutMs }; return { exitCode: 0, stdout: IR, stderr: '' }; } };
	await runBindingCheck(spy as never, { platformRoot: '/p', projectRoot: '/proj' }, 'A.b', 5000);
	assert.deepEqual(seen, { cmd: 'java', args: ['-cp', '/p/build/classes', 'reverse.ProjectMain', '/proj'], timeoutMs: 5000 });
});
