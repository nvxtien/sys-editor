import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideNavigation, NavigationModel } from '../sysVerificationNavigation.js';
import { VerificationSourceSpan } from '../sysVerification.js';

const DIGEST = 'sha256:' + 'a'.repeat(64);
const span: VerificationSourceSpan = { startOffset: 863, endOffset: 2045, startLine: 29, startColumn: 5, endLine: 55, endColumn: 6, sourceDigest: DIGEST };
// 60 lines; every line has 40 characters (max column 41), except line 55 which is "    }" (max column 6)
const model: NavigationModel = { lineCount: 60, lineMaxColumn: line => (line === 55 ? 6 : 41) };
const base = { span, hasSymbol: true, currentDigest: DIGEST, dirty: false, model };

test('fresh, fitting span is revealed as the whole declaration', () => {
	const d = decideNavigation(base);
	assert.equal(d.action, 'REVEAL_SPAN');
	assert.deepEqual((d as { range: unknown }).range, { startLineNumber: 29, startColumn: 5, endLineNumber: 55, endColumn: 6 });
	assert.equal((d as { message: string }).message, 'opened at declaration');
});

test('a span wins over a symbol: the symbol provider is not consulted', () => {
	assert.equal(decideNavigation({ ...base, hasSymbol: true }).action, 'REVEAL_SPAN');
});

test('stale digest is never revealed', () => {
	const d = decideNavigation({ ...base, currentDigest: 'sha256:' + 'b'.repeat(64) });
	assert.deepEqual(d, { action: 'FILE_ONLY', message: 'opened file only: file changed since verification (refresh)' });
});

test('a dirty editor is treated as stale even if the disk digest matches', () => {
	assert.equal(decideNavigation({ ...base, dirty: true }).action, 'FILE_ONLY');
});

test('digest that cannot be computed is not silently trusted', () => {
	const d = decideNavigation({ ...base, currentDigest: undefined });
	assert.equal(d.action, 'FILE_ONLY');
	assert.match((d as { message: string }).message, /cannot verify/);
});

test('out-of-range line or column is not clamped', () => {
	assert.equal(decideNavigation({ ...base, span: { ...span, endLine: 61 } }).action, 'FILE_ONLY');
	assert.equal(decideNavigation({ ...base, span: { ...span, startColumn: 42 } }).action, 'FILE_ONLY');
	assert.equal(decideNavigation({ ...base, span: { ...span, endColumn: 7 } }).action, 'FILE_ONLY');
	assert.equal(decideNavigation({ ...base, model: undefined }).action, 'FILE_ONLY');
	const d = decideNavigation({ ...base, span: { ...span, endLine: 61 } });
	assert.match((d as { message: string }).message, /does not fit/);
});

test('no span: symbol fallback when there is a symbol, otherwise file only', () => {
	assert.deepEqual(decideNavigation({ ...base, span: undefined, hasSymbol: true }), { action: 'SYMBOL_FALLBACK' });
	assert.deepEqual(decideNavigation({ ...base, span: undefined, hasSymbol: false }),
		{ action: 'FILE_ONLY', message: 'opened file only: no observed location' });
});

test('a stale or unfit span never falls back to the symbol provider', () => {
	for (const d of [decideNavigation({ ...base, currentDigest: 'sha256:' + 'c'.repeat(64) }), decideNavigation({ ...base, span: { ...span, endLine: 99 } })]) {
		assert.equal(d.action, 'FILE_ONLY');
	}
});
