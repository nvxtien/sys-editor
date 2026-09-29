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
	assert.equal(/OrderService\.createOrder/.test(source), false);
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

/// Manifest building left the editor with the Verify button. It was there to turn a spec's own
/// operation into a verification run; with no button to start one, a manifest assembled in the
/// editor would be a governed artifact composed on the wrong side of the boundary.
///
/// This replaces the older test that Verify never prompted for a source symbol: there is no
/// Verify here to prompt.
test('the view builds no verification manifest of its own', () => {
	const source = view();
	for (const owned of ['specOperation(', 'buildManifest(', 'writeManifest(']) {
		assert.equal(source.includes(owned), false, `the view still assembles a manifest: ${owned}`);
	}
});
