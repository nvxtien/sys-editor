import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickRecents } from '../welcomeRecent.js';

test('shows folder name and parent path', () => {
	assert.deepEqual(pickRecents(['/Volumes/Work/dev/sys-editor'], 5), [{ path: '/Volumes/Work/dev/sys-editor', name: 'sys-editor', parent: '/Volumes/Work/dev' }]);
});

test('keeps order, drops duplicates, limits the count', () => {
	const rows = pickRecents(['/a/x', '/a/y', '/a/x', '/b/z'], 2);
	assert.deepEqual(rows.map(r => r.path), ['/a/x', '/a/y']);
});

test('tolerates trailing slashes and a root-level folder', () => {
	assert.deepEqual(pickRecents(['/a/x/'], 5)[0], { path: '/a/x', name: 'x', parent: '/a' });
	assert.deepEqual(pickRecents(['/x'], 5)[0], { path: '/x', name: 'x', parent: '/' });
});

test('no recents -> empty list', () => {
	assert.deepEqual(pickRecents([], 5), []);
});
