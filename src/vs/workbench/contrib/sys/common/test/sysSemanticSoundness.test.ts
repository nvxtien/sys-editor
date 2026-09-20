import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CINEMA_BOOKING_SNAPSHOT, LIVE_PLATFORM_API_GAP_SNAPSHOT } from '../sysSemanticSnapshotFixture.js';

test('soundness fixture keeps dispositions and eligibility distinct', () => {
	const items = CINEMA_BOOKING_SNAPSHOT.semanticItems;
	assert.equal(items.find(item => item.id === 'balance-amount')?.disposition, 'SUPPORTED_EXACT');
	assert.equal(items.find(item => item.id === 'booking-unique')?.disposition, 'UNSUPPORTED');
	assert.equal(items.find(item => item.id === 'booking-unique')?.parsed, true);
	assert.equal(CINEMA_BOOKING_SNAPSHOT.syncItems.find(item => item.ruleId === 'booking-unique')?.eligible, false);
	assert.equal(items.find(item => item.id === 'confirmed-status')?.confirmedHumanIntent, true);
});

test('live contract gap never substitutes fixture semantics', () => {
	assert.equal(LIVE_PLATFORM_API_GAP_SNAPSHOT.mode, 'LIVE');
	assert.equal(LIVE_PLATFORM_API_GAP_SNAPSHOT.integration, 'PLATFORM_API_GAP');
	assert.deepEqual(LIVE_PLATFORM_API_GAP_SNAPSHOT.semanticItems, []);
	assert.equal(LIVE_PLATFORM_API_GAP_SNAPSHOT.recoveredMeaning.state, 'NOT_AVAILABLE');
});
