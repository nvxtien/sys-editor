import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canApplySysProposal, decodeDraftPreview, decodePendingProposal, isSysWorkspaceMissing, validateDraftCandidate } from '../sysPlatformFlow.js';

test('draft preview must be validated and contain editable spec text', () => {
	assert.deepEqual(decodeDraftPreview(JSON.stringify({ command: 'requirement', draftSpec: 'Operation: transfer', operation: 'transfer', validationState: 'VALIDATED' })), {
		draftSpec: 'Operation: transfer', operation: 'transfer', validationState: 'VALIDATED'
	});
	assert.throws(() => decodeDraftPreview('{"draftSpec":"x"}'), /incomplete or unvalidated/);
	assert.throws(() => decodeDraftPreview('not json'), /invalid preview JSON/);
	assert.throws(() => decodeDraftPreview(JSON.stringify({ command: 'requirement', draftSpec: '  ', operation: 'transfer', validationState: 'VALIDATED' })), /incomplete or unvalidated/);
	assert.throws(() => decodeDraftPreview(JSON.stringify({ command: 'requirement', draftSpec: 'Operation: transfer', operation: 'transfer', validationState: 'UNVALIDATED' })), /incomplete or unvalidated/);
});

test('validated draft candidates are written, previewed, and removed in order', async () => {
	const events: string[] = [];
	const result = await validateDraftCandidate(
		'/project/.sys/proposals/draft-1.spec',
		'Operation: transfer',
		async (path, text) => { events.push(`write:${path}:${text}`); },
		async path => { events.push(`preview:${path}`); return JSON.stringify({ command: 'requirement', draftSpec: 'Operation: transfer', operation: 'transfer', validationState: 'VALIDATED' }); },
		async path => { events.push(`remove:${path}`); }
	);
	assert.equal(result.validationState, 'VALIDATED');
	assert.deepEqual(events, [
		'write:/project/.sys/proposals/draft-1.spec:Operation: transfer',
		'preview:/project/.sys/proposals/draft-1.spec',
		'remove:/project/.sys/proposals/draft-1.spec'
	]);
});

test('invalid draft preview still removes the temporary candidate', async () => {
	let removed = false;
	await assert.rejects(validateDraftCandidate(
		'/project/.sys/proposals/draft-2.spec',
		'bad candidate',
		async () => undefined,
		async () => '{"draftSpec":"bad"}',
		async () => { removed = true; }
	), /incomplete or unvalidated/);
	assert.equal(removed, true);
});

test('only VERIFIED_SYNCED proposals can be applied', () => {
	const base = { kind: 'provider-code', requirementId: 'r', version: 1, targetFile: '/app.java', diff: 'diff' };
	assert.equal(canApplySysProposal(decodePendingProposal(JSON.stringify({ ...base, verificationState: 'VERIFIED_SYNCED' }))), true);
	assert.equal(canApplySysProposal(decodePendingProposal(JSON.stringify({ ...base, verificationState: 'NOT_VERIFIED_DETERMINISTIC_BACKEND' }))), false);
	assert.equal(canApplySysProposal(decodePendingProposal(JSON.stringify({ ...base, verificationState: 'FAILED' }))), false);
});

test('only the missing-workspace response triggers in-editor initialization', () => {
	assert.equal(isSysWorkspaceMissing(new Error('Initialize Sys Platform in this project first with `sys init .`.')), true);
	assert.equal(isSysWorkspaceMissing(new Error('draft provider is not configured')), false);
	assert.equal(isSysWorkspaceMissing('no Sys Platform workspace found'), false);
});
