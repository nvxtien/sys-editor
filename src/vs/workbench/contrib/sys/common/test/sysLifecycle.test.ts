import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLifecycle, SysLifecycle } from '../sysLifecycle.js';

// Approval and staleness are decided by sys-core (sys-core/tests/lifecycle_state.rs). The editor only
// accepts a reply in the exact contract shape and renders it.

const reply = (overrides: Record<string, unknown> = {}) => ({
	requirementId: 'REQ-001',
	requirement: { present: true, approved: false, identity: 'sha256:aa' },
	structuredIntent: { state: 'DRAFT', identity: 'sha256:bb' },
	status: 'INTENT_DRAFT',
	...overrides
});

test('accepts the exact lifecycle contract from sys-core', () => {
	const expected: SysLifecycle = reply() as SysLifecycle;
	assert.deepEqual(parseLifecycle(JSON.parse(JSON.stringify(reply()))), expected);
});

test('every artifact state is accepted and nothing else', () => {
	for (const state of ['NOT_CREATED', 'DRAFT', 'APPROVED', 'STALE']) {
		assert.equal(parseLifecycle(reply({ structuredIntent: { state, identity: null } })).structuredIntent.state, state);
	}
	assert.throws(() => parseLifecycle(reply({ structuredIntent: { state: 'VERIFIED', identity: null } })), /invalid lifecycle/);
	assert.throws(() => parseLifecycle(reply({ structuredIntent: { state: 'approved', identity: null } })), /invalid lifecycle/);
});

test('a malformed reply is rejected rather than read as a state', () => {
	for (const bad of [null, 'APPROVED', 7, reply({ requirement: null }), reply({ requirement: { present: 'yes', approved: false, identity: null } }), reply({ requirementId: 5 }), reply({ status: undefined }), reply({ structuredIntent: { state: 'DRAFT' } })]) {
		assert.throws(() => parseLifecycle(bad), /invalid lifecycle/, JSON.stringify(bad));
	}
});

// A workspace running an older sys-core still sends formalSpec. It names an artifact that no
// longer exists, so it is ignored -- rejecting the whole reply would black out the row instead.
test('a reply from a core that predates the freeze still parses', () => {
	const older = parseLifecycle(reply({ formalSpec: { state: 'APPROVED', identity: 'sha256:cc' } }));
	assert.equal(older.status, 'INTENT_DRAFT');
	assert.equal('formalSpec' in older, false);
});
