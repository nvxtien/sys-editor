import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanGherkinScenarioLines } from '../../browser/sysBehaviorCodeLensProvider.js';

test('finds a Scenario line inside a fenced gherkin block', () => {
	const text = [
		'# REQ-001 — Formal Spec review',
		'',
		'## Scenarios',
		'',
		'```gherkin',
		'Feature: Order lifecycle',
		'',
		'  Scenario: Cancel order clears its status',
		'    Given a thing',
		'    When it happens',
		'    Then it changes',
		'```',
		''
	].join('\n');
	const found = scanGherkinScenarioLines(text);
	assert.equal(found.length, 1);
	assert.equal(found[0].keyword, 'Scenario');
	assert.equal(found[0].scenarioName, 'Cancel order clears its status');
	assert.equal(text.split('\n')[found[0].line], '  Scenario: Cancel order clears its status');
});

test('finds a Scenario Outline line too, and multiple scenarios', () => {
	const text = ['```gherkin', 'Feature: X', '', '  Scenario: One', '  Scenario Outline: Two', '```'].join('\n');
	const found = scanGherkinScenarioLines(text);
	assert.equal(found.length, 2);
	assert.equal(found[0].keyword, 'Scenario');
	assert.equal(found[1].keyword, 'Scenario Outline');
	assert.equal(found[1].scenarioName, 'Two');
});

test('ignores a Scenario-looking line outside any fenced gherkin block', () => {
	const text = ['## Scenarios', '', 'Not fenced: Scenario: This should not count', '', '```gherkin', 'Feature: X', '```'].join('\n');
	assert.deepEqual(scanGherkinScenarioLines(text), []);
});

test('a document with no fenced gherkin block finds nothing, does not error', () => {
	assert.deepEqual(scanGherkinScenarioLines('# REQ-002 — Formal Spec review\n\n## Entities\n\n### Category\n'), []);
});
