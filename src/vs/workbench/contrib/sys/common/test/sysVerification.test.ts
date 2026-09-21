import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispositionLabel, filterRulesByDisposition, pickStableSelection } from '../sysVerification.js';
import { CINEMA_BOOKING_VERIFICATION_PROJECT } from '../sysVerificationFixture.js';

const rules = CINEMA_BOOKING_VERIFICATION_PROJECT.rules;
const find = (id: string) => rules.find(r => r.id === id)!;

test('B1/B3 precondition and B2 relational rules are SYNCED end to end', () => {
	assert.equal(find('B1').aggregateDisposition, 'SYNCED');
	assert.equal(find('B3').aggregateDisposition, 'SYNCED');
	const b2 = find('B2');
	assert.equal(b2.aggregateDisposition, 'SYNCED');
	assert.equal(b2.obligations[0].governed?.expression, 'DistinctBy(requestedSeats, Seat.id)');
	assert.equal(b2.obligations[0].recovered?.expression, 'ExistsDuplicateBy(requestedSeats, Seat.id)');
	assert.ok(b2.obligations[0].recovered?.evidence && b2.obligations[0].recovered.evidence.length > 0);
});

test('B8 aggregate CONFLICTED never hides its independently SYNCED effect obligation', () => {
	const b8 = find('B8');
	assert.equal(b8.aggregateDisposition, 'CONFLICTED');
	const guard = b8.obligations.find(o => o.kind === 'GUARD')!;
	const effect = b8.obligations.find(o => o.kind === 'EFFECT')!;
	assert.equal(guard.disposition, 'WRONG_OPERATION_SCOPE');
	assert.equal(effect.disposition, 'SYNCED');
	// the aggregate being CONFLICTED must not remove or relabel the synced sub-obligation
	assert.equal(b8.obligations.includes(effect), true);
});

test('governed semantics are SPECIFIED and recovered semantics are DERIVED', () => {
	const b2 = find('B2').obligations[0];
	assert.equal(b2.governed?.provenance, 'SPECIFIED');
	assert.equal(b2.recovered?.provenance, 'DERIVED');
});

test('unsupported rules carry missing evidence and anchors explicitly rather than fabricating them', () => {
	const occupancy = find('occupancy');
	assert.equal(occupancy.aggregateDisposition, 'UNSUPPORTED');
	assert.equal(occupancy.obligations[0].recovered, undefined);
	assert.deepEqual(occupancy.obligations[0].anchors, []);
});

test('NOT_OBSERVED/WRONG_OPERATION_SCOPE guard obligation is distinct from CONFLICTED itself', () => {
	const guard = find('B8').obligations.find(o => o.kind === 'GUARD')!;
	assert.notEqual(guard.disposition, 'CONFLICTED');
	assert.equal(dispositionLabel(guard.disposition), 'Wrong operation scope');
});

test('dispositionLabel is a deterministic switch, not derived from any other field', () => {
	assert.equal(dispositionLabel('SYNCED'), 'Synced');
	assert.equal(dispositionLabel('UNSUPPORTED'), 'Unsupported');
	assert.equal(dispositionLabel('NOT_OBSERVED'), 'Not observed');
});

test('filterRulesByDisposition narrows by aggregate or obligation disposition', () => {
	assert.deepEqual(filterRulesByDisposition(rules, 'ALL').map(r => r.id), rules.map(r => r.id));
	const conflicted = filterRulesByDisposition(rules, 'CONFLICTED');
	assert.deepEqual(conflicted.map(r => r.id), ['B8']);
	const wrongScope = filterRulesByDisposition(rules, 'WRONG_OPERATION_SCOPE');
	assert.deepEqual(wrongScope.map(r => r.id), ['B8']);
});

test('selection survives a data refresh only if the id still exists', () => {
	assert.equal(pickStableSelection(rules, 'B2'), 'B2');
	assert.equal(pickStableSelection(rules, 'B2-distinctness'), 'B2-distinctness');
	assert.equal(pickStableSelection(rules, 'does-not-exist'), undefined);
	assert.equal(pickStableSelection(rules, undefined), undefined);
});
