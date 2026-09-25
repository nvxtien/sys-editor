import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Compiled out of the source tree, so the repo root is the working directory the suite is run from.
const view = () => readFileSync(join(process.cwd(), 'src/vs/workbench/contrib/sys/browser/sysSemanticWorkbenchView.ts'), 'utf8');

test('the workbench renders no Bind operation action', () => {
	assert.equal(/Bind operation/.test(view()), false);
	assert.equal(/_bindOperation/.test(view()), false);
});

test('the workbench asks for no class, method, symbol or source root', () => {
	const source = view();
	assert.equal(/Class\.method/i.test(source), false);
	assert.equal(/ClassName\.methodName/.test(source), false);
	assert.equal(/BookingService\.createBooking/.test(source), false);
	assert.equal(/validateTargetOperation/.test(source), false);
	assert.equal(/Source root|source-root|Code file to update|Source file containing/.test(source), false);
});

test('the code-proposal action that demanded an implementation target is gone', () => {
	assert.equal(/_approveSpecAndReviewProposal|Approve spec & review code/.test(view()), false);
});

test('no action label reintroduces binding under another name', () => {
	const labels = [...view().matchAll(/this\._action\(actions, '([^']+)'/g)].map(match => match[1]);
	assert.ok(labels.length > 0, 'expected to find action labels');
	for (const label of labels) {
		assert.doesNotMatch(label, /bind|link|attach|map|target|symbol|class|method|source/i);
	}
});

test('Verify builds its manifest from the spec, not from a prompt', () => {
	const source = view();
	assert.match(source, /specOperation\(/);
	const verify = source.slice(source.indexOf('private async _verify('), source.indexOf('private _renderRequirementRow('));
	assert.equal(/quickInputService|showOpenDialog/.test(verify), false);
});
