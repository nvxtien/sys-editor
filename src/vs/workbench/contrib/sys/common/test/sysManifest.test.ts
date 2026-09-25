import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildManifest, specOperation } from '../sysManifest.js';

const input = {
	projectId: 'cinema-booking',
	projectRoot: '/tmp/cinema',
	operation: 'create booking',
	ruleId: 'REQ-001',
	title: 'Requested seats non-empty',
	specFile: '/tmp/cinema/.sys/specs/REQ-001.spec'
};

test('the manifest carries the semantic operation verbatim', () => {
	assert.equal(buildManifest(input).target_operation, 'create booking');
	assert.equal(buildManifest(input).project_id, 'cinema-booking');
	assert.equal(buildManifest(input).project_root, '/tmp/cinema');
});

test('the manifest declares no source anchor, because the platform recovers source', () => {
	const rule = buildManifest(input).rules[0];
	assert.equal('source_anchor' in rule, false);
	assert.deepEqual(rule.spec_anchor, { kind: 'SPEC', label: 'REQ-001.spec', file: '/tmp/cinema/.sys/specs/REQ-001.spec' });
	assert.equal(rule.id, 'REQ-001');
	assert.equal(rule.title, 'Requested seats non-empty');
});

test('the manifest never derives a source symbol from the operation', () => {
	const json = JSON.stringify(buildManifest({ ...input, operation: 'create booking' }));
	assert.doesNotMatch(json, /BookingService/);
	assert.equal(json.includes('"symbol"'), false);
});

test('specOperation reads the semantic Operation declaration', () => {
	assert.equal(specOperation('Requirement: Cinema booking\n\nOperation: create booking\n\nProperty: x.\n'), 'create booking');
	assert.equal(specOperation('Operation:    create booking   \n'), 'create booking');
});

test('specOperation takes the first declaration when a spec repeats it', () => {
	assert.equal(specOperation('Operation: create booking\nOperation: cancel booking\n'), 'create booking');
});

test('specOperation refuses a spec with no operation, without suggesting a binding', () => {
	for (const bad of ['Requirement: Cinema booking\n', 'Operation:\n', 'Operation:    \n', '']) {
		assert.throws(() => specOperation(bad), (error: Error) => /Operation:/.test(error.message) && !/Class\.method|bind/i.test(error.message));
	}
});

test('a semantic operation keeps its spaces and is never validated as a qualified symbol', async () => {
	assert.equal(buildManifest({ ...input, operation: 'cancel a confirmed booking' }).target_operation, 'cancel a confirmed booking');
	const module = await import('../sysManifest.js') as Record<string, unknown>;
	assert.equal(module.validateTargetOperation, undefined);
});
