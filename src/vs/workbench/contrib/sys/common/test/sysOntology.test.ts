import { test } from 'node:test';
import assert from 'node:assert/strict';
import { governedAbout, readGoverned, systemOntologyBinary } from '../sysOntology.js';

const transport = (result: { exitCode: number; stdout: string; stderr: string }) => ({
	run: async (...args: unknown[]) => { seen.push(args); return result; }
});
let seen: unknown[][] = [];

const REPORT = JSON.stringify({
	statements: [
		{ id: 'st:1', requirement: 'REQ-002', predicate: 'DECLARED_TYPE', says: 'Book is a governed concept', concepts: ['Book'], state: 'GOVERNED_NOT_CHECKED' },
		{ id: 'st:2', requirement: 'REQ-002', predicate: 'RELATES_TO', says: 'Each Book belongs to exactly one Category', concepts: ['Book', 'Category'], state: 'GOVERNED_NOT_CHECKED' }
	],
	concepts: ['Book', 'Category'],
	unreadable: []
});

test('asks the platform what this workspace governs, and carries the answer home', async () => {
	seen = [];
	const result = await readGoverned(transport({ exitCode: 0, stdout: REPORT, stderr: '' }), '/p', '/w');
	assert.equal(result.kind, 'READ');
	assert.equal(seen[0][0], systemOntologyBinary('/p'));
	assert.deepEqual(seen[0][1], ['statements', '/w']);
	if (result.kind === 'READ') {
		assert.equal(result.governed.statements.length, 2);
		// The sentence is the platform's. The editor never composes one.
		assert.equal(result.governed.statements[0].says, 'Book is a governed concept');
	}
});

// A relationship is about both of its ends, so asking about either finds it.
test('asking about a concept finds everything said about it', async () => {
	const result = await readGoverned(transport({ exitCode: 0, stdout: REPORT, stderr: '' }), '/p', '/w');
	if (result.kind !== 'READ') { throw new Error('expected READ'); }
	assert.equal(governedAbout(result.governed, 'Book').length, 2);
	assert.equal(governedAbout(result.governed, 'Category').length, 1);
	assert.equal(governedAbout(result.governed, 'Nothing').length, 0);
});

// A view that cannot reach the platform must say so, not quietly show nothing — an empty list and
// a broken pipe look identical to a reader.
test('an unreachable platform is reported, not swallowed', async () => {
	for (const result of [
		await readGoverned({ run: async () => { throw new Error('binary not found'); } }, '/p', '/w'),
		await readGoverned(transport({ exitCode: 1, stdout: '', stderr: 'boom' }), '/p', '/w'),
		await readGoverned(transport({ exitCode: 0, stdout: 'not json', stderr: '' }), '/p', '/w')
	]) {
		assert.equal(result.kind, 'UNAVAILABLE');
		if (result.kind === 'UNAVAILABLE') { assert.ok(result.reason.length > 2, result.reason); }
	}
});

// No verdict is claimed, because none has been earned: these statements have never met any code.
test('nothing claims a verdict the platform did not give', async () => {
	const result = await readGoverned(transport({ exitCode: 0, stdout: REPORT, stderr: '' }), '/p', '/w');
	if (result.kind !== 'READ') { throw new Error('expected READ'); }
	assert.ok(result.governed.statements.every(s => s.state === 'GOVERNED_NOT_CHECKED'));
});

// Which concepts are over budget, and by how much, is the platform's answer -- the editor
// renders this list, it computes nothing about what "too crowded" means.
test('a crowded concept from the platform is carried home unchanged', async () => {
	const report = JSON.stringify({ ...JSON.parse(REPORT), crowded: [{ concept: 'Book', count: 13 }] });
	const result = await readGoverned(transport({ exitCode: 0, stdout: report, stderr: '' }), '/p', '/w');
	if (result.kind !== 'READ') { throw new Error('expected READ'); }
	assert.deepEqual(result.governed.crowded, [{ concept: 'Book', count: 13 }]);
});

// An older system-ontology sends no crowded field at all; the editor must still read the reply.
test('a reply from a core that predates the budget field still parses', async () => {
	const result = await readGoverned(transport({ exitCode: 0, stdout: REPORT, stderr: '' }), '/p', '/w');
	if (result.kind !== 'READ') { throw new Error('expected READ'); }
	assert.equal(result.governed.crowded, undefined);
});
