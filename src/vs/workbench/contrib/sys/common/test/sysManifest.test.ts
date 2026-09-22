import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildManifest, validateTargetOperation } from '../sysManifest.js';

const input = {
	projectId: 'my-java21-app',
	projectRoot: '/Volumes/Work/dev/my-java21-app',
	targetOperation: 'BookingService.createBooking',
	sourceFile: '/Volumes/Work/dev/my-java21-app/src/main/java/com/example/BookingService.java',
	ruleId: 'REQ-001',
	title: 'A booking request must contain at least one seat.',
	specFile: '/Volumes/Work/dev/my-java21-app/.sys/specs/REQ-001.spec'
};

test('buildManifest matches the real verification.v0.1 manifest shape, one rule per requirement', () => {
	assert.deepEqual(buildManifest(input), {
		project_id: 'my-java21-app',
		project_root: '/Volumes/Work/dev/my-java21-app',
		target_operation: 'BookingService.createBooking',
		rules: [{
			id: 'REQ-001',
			title: 'A booking request must contain at least one seat.',
			spec_file: '/Volumes/Work/dev/my-java21-app/.sys/specs/REQ-001.spec',
			source_anchor: { kind: 'SOURCE', label: 'BookingService.createBooking', file: input.sourceFile, symbol: 'createBooking' },
			spec_anchor: { kind: 'SPEC', label: 'REQ-001.spec', file: input.specFile }
		}]
	});
});

test('symbol is the last segment of a dotted operation, even when nested', () => {
	assert.equal(buildManifest({ ...input, targetOperation: 'com.example.Outer.Inner.run' }).target_operation, 'com.example.Outer.Inner.run');
	assert.equal(buildManifest({ ...input, targetOperation: 'com.example.Outer.Inner.run' }).rules[0].source_anchor.symbol, 'run');
});

test('validateTargetOperation accepts a qualified name and rejects anything else', () => {
	assert.equal(validateTargetOperation('BookingService.createBooking'), undefined);
	for (const bad of ['createBooking', 'A.', '.b', '1A.b']) {
		assert.ok(validateTargetOperation(bad));
	}
});
