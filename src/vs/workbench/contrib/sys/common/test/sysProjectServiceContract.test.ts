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
