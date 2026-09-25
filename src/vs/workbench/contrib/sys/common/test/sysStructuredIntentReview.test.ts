import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderStructuredIntentReview } from '../sysStructuredIntentReview.js';
import { SysStructuredIntentRecord } from '../sysStructuredIntent.js';

const fact = (value: string, provenance: 'SPECIFIED' | 'OBSERVED' | 'DERIVED' | 'INFERRED' | 'UNKNOWN') => ({ value, provenance });

function record(overrides: Partial<SysStructuredIntentRecord['draft']> = {}, approvedContent?: string): SysStructuredIntentRecord {
	return {
		sourceRequirement: 'Data Model\n - each book belongs to one category\n',
		state: approvedContent ? 'APPROVED' : 'DRAFT',
		draft: {
			version: 1,
			requirementId: 'REQ-001',
			intentStatement: fact('Define Category and Book with a one-to-many relationship', 'SPECIFIED'),
			scope: fact('Data model only', 'INFERRED'),
			operation: fact('UNKNOWN', 'UNKNOWN'),
			inputs: [fact('Category: id (INT), category_name (string)', 'SPECIFIED')],
			constraints: [fact('Each book belongs to exactly one category', 'SPECIFIED'), fact('category_id must reference a category', 'DERIVED')],
			effects: [],
			failureBehavior: [],
			unknowns: ['Which operation implements this?', 'Cascade behaviour on delete'],
			...overrides
		}
	};
}

test('renders every section as plain text with no JSON syntax', () => {
	const text = renderStructuredIntentReview(record(), undefined);
	for (const heading of ['# REQ-001 — Structured Intent review', '## Intent', '## Scope', '## Operation', '## Inputs', '## Constraints', '## Effects', '## Failure behavior', '## Open questions', '## Your original requirement']) {
		assert.ok(text.includes(heading), `missing ${heading}`);
	}
	assert.ok(!/["{}]/.test(text.replace(/> .*/g, '')), 'no JSON punctuation outside the quoted requirement');
	assert.ok(text.includes('- Category: id (INT), category_name (string) — stated by you'));
	assert.ok(text.includes('- Which operation implements this?'));
	assert.ok(text.includes('> Data Model'));
});

test('tells the reviewer what to check: model guesses and unknowns are flagged, explicit facts are not', () => {
	const text = renderStructuredIntentReview(record(), undefined);
	assert.ok(text.includes('Data model only — ⚠ model’s guess, please check'));
	assert.ok(text.includes('Not bound yet — ⚠ unknown, needs an answer'));
	assert.ok(text.includes('category_id must reference a category — derived from what you stated'));
	assert.ok(!text.includes('Define Category and Book with a one-to-many relationship — ⚠'));
});

test('says so when a list is empty instead of showing a blank section', () => {
	const text = renderStructuredIntentReview(record(), undefined);
	assert.ok(/## Effects\n\n_None stated\._/.test(text));
	assert.ok(/## Failure behavior\n\n_None stated\._/.test(text));
});

test('shows a bound operation as a fact and reflects draft versus approved state', () => {
	const draft = renderStructuredIntentReview(record({ operation: fact('BookingService.createBooking', 'SPECIFIED') }), undefined);
	assert.ok(draft.includes('BookingService.createBooking — stated by you'));
	assert.ok(draft.includes('Status: DRAFT — not yet confirmed'));
	const approved = renderStructuredIntentReview(record({}, 'x'), undefined);
	assert.ok(approved.includes('Status: CONFIRMED'));
});

test('keeps multi-line values on one line so bullets stay intact', () => {
	const text = renderStructuredIntentReview(record({ inputs: [fact('line one\nline two', 'SPECIFIED')] }), undefined);
	assert.ok(text.includes('- line one line two — stated by you'));
});

test('states that the file is generated and that the JSON is what gets confirmed', () => {
	const text = renderStructuredIntentReview(record(), undefined);
	assert.ok(text.includes('Generated view — do not edit'));
	assert.ok(text.includes('REQ-001.intent.json'));
});

test('says when the requirement changed after the intent was reviewed', () => {
	const stale = renderStructuredIntentReview({ ...record(), state: 'STALE' }, undefined);
	assert.ok(stale.includes('Status: STALE — the requirement changed after this was reviewed'));
});
