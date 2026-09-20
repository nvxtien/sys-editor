import { SysProjectSnapshot } from './sysSemanticSnapshot.js';

const bookingRules = [
	{ id: 'non-empty-seats', label: 'non-empty seats', description: 'requestedSeats must contain at least one seat' },
	{ id: 'distinct-seats', label: 'distinct seats', description: 'requestedSeats must contain distinct seats' },
	{ id: 'hall-consistency', label: 'hall consistency', description: 'every requested seat hall must match the showtime hall' },
	{ id: 'past-showtime', label: 'past showtime', description: 'showtime must not be in the past under Asia/Ho_Chi_Minh' },
	{ id: 'seat-exclusivity', label: 'seat exclusivity', description: 'each (showtime, seat) may have at most one CONFIRMED booking' },
	{ id: 'successful-status', label: 'successful status', description: 'successful booking is CONFIRMED' },
] as const;

export const CINEMA_BOOKING_SNAPSHOT: SysProjectSnapshot = {
	project: 'Cinema Booking',
	governedIntent: 'AVAILABLE',
	recoveredSourceMeaning: 'PARTIAL',
	sync: 'PARTIAL',
	unresolvedIntent: ['customer validation', 'status transition rules'],
	reviewsRequiringAttention: 1,
	operations: [{ name: 'createBooking', rules: bookingRules }],
	governedRules: bookingRules,
	syncItems: bookingRules.slice(0, 5).map(rule => ({
		ruleId: rule.id,
		label: rule.label,
		governed: 'KNOWN',
		recovered: 'UNKNOWN',
		state: 'PARTIAL',
	})),
	reviews: [{
		title: 'Hall consistency',
		governed: 'seat.hallName == showtime.hallName',
		recovered: 'UNKNOWN',
		state: 'PARTIAL / UNKNOWN',
		evidence: 'source recovery could not recover the guard',
	}],
	evidence: {
		operation: 'createBooking',
		recoveredSourcePaths: 6,
		fullyRecoveredGuards: 0,
		falseGreens: 0,
	},
};
