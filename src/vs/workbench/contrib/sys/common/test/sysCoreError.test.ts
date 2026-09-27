import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sysCoreErrorMessage } from '../sysCoreError.js';

// The platform names the condition; saying it in a person's words is the editor's job. A reader
// met with UNKNOWN_PROJECT_LANGUAGE is being shown the platform's vocabulary, which is exactly
// what the review page was cleaned of.
test('turns a platform error code into a sentence, keeping its detail', () => {
	assert.equal(
		sysCoreErrorMessage('{"error":"UNKNOWN_PROJECT_LANGUAGE","detail":"pom.xml, go.mod"}'),
		'Could not tell what language this project is written in, so no code was generated. Looked for pom.xml, go.mod at the project root.'
	);
	assert.match(sysCoreErrorMessage('{"error":"FORMAL_SPEC_NOT_APPROVED"}'), /Confirm this Formal Spec first/);
	assert.match(sysCoreErrorMessage('{"error":"NO_GENERATED_FILES"}'), /no files/i);
	assert.match(sysCoreErrorMessage('{"error":"UNSAFE_GENERATED_PATH","detail":"../x.java"}'), /outside the project.*\.\.\/x\.java/);
});

// A code the editor has no sentence for must still say something a person can act on, and must
// never print a bare identifier on its own.
test('an unrecognized code still reads as a sentence', () => {
	const message = sysCoreErrorMessage('{"error":"SOME_NEW_THING","detail":"x"}');
	assert.match(message, /^Sys Platform could not complete this/);
	assert.match(message, /SOME_NEW_THING/, 'the code is still shown, so a bug report can name it');
});

// Not everything reaching here is a core error: HTTP failures and timeouts arrive as plain text.
test('text that is not a platform error is passed through unchanged', () => {
	assert.equal(sysCoreErrorMessage('sys-core did not answer in time'), 'sys-core did not answer in time');
	assert.equal(sysCoreErrorMessage(''), 'Sys Platform could not complete this and gave no reason.');
});
