import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// These tests are compiled out of the source tree, so the repo root is the working directory the
// suite is run from, not a path relative to this file.
const read = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');

test('the project service no longer binds operations', () => {
	const source = read('src/vs/workbench/contrib/sys/browser/sysProjectService.ts');
	assert.equal(/bindOperation/.test(source), false);
	assert.equal(/bind-operation/.test(source), false);
});

test('no service error copy tells a user to bind an operation', () => {
	const source = read('src/vs/workbench/contrib/sys/browser/sysProjectService.ts');
	for (const message of source.match(/'[^']*'/g) ?? []) {
		assert.doesNotMatch(message, /bind (its|this|the) operation/i);
	}
});

// Deleting a requirement removed its files but left sys-core holding the record, intent and spec.
// Ids are reused, so the next requirement created inherited the deleted one's approved intent.
test('deleting a requirement also tells sys-core to forget it', () => {
	const source = read('src/vs/workbench/contrib/sys/browser/sysProjectService.ts');
	const body = source.slice(source.indexOf('async deleteRequirement('), source.indexOf('async deleteRequirement(') + 900);
	assert.match(body, /'requirement', 'forget'/, 'delete leaves sys-core state behind');
	// sys-core must be asked before the project file forgets the id, or a failure there would
	// leave an orphan the editor can no longer see or clean up.
	assert.ok(
		body.indexOf("'forget'") < body.indexOf('removeRequirement'),
		'sys-core is told to forget only after the requirement is already gone from the project'
	);
});

// Every sys-core call is a network round trip to a server that may not answer. Without a deadline
// the action never settles, and since a running action disables its button, the row goes silent:
// every later click is swallowed and the app looks dead.
test('no sys-core call can hang forever', () => {
	const source = read('src/vs/workbench/contrib/sys/browser/sysProjectService.ts');
	const body = source.slice(source.indexOf('private async coreResponse('), source.indexOf('private async coreResponse(') + 1200);
	assert.match(body, /AbortSignal\.timeout|setTimeout|Promise\.race/, 'coreResponse has no deadline');
});
