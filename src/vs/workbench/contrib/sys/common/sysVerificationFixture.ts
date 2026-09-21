import { VerificationProject } from './sysVerification.js';

/**
 * Cinema Booking pilot data, shaped exactly like the platform's proven
 * E2E semantic proof (precondition/collection, state/effect, relational,
 * and a compound rule with mixed obligation outcomes).
 */
export const CINEMA_BOOKING_VERIFICATION_PROJECT: VerificationProject = {
	projectId: 'cinema-booking',
	contractStatus: 'READY',
	rules: [
		{
			id: 'B1',
			title: 'Requested seats non-empty',
			aggregateDisposition: 'SYNCED',
			obligations: [
				{
					id: 'B1-precondition',
					kind: 'PRECONDITION',
					disposition: 'SYNCED',
					governed: { summary: 'requestedSeats must be non-empty', expression: 'NonEmpty(requestedSeats)', provenance: 'SPECIFIED' },
					recovered: { summary: 'guard rejects when the requested list has no elements', expression: 'requestedSeats.length > 0', evidence: ['requestedSeats.length == 0 => reject'], provenance: 'DERIVED' },
					why: 'recovered emptiness guard exactly represents the negation of governed non-emptiness',
					reasons: [],
					completeness: 'COMPLETE',
					anchors: [
						{ kind: 'SOURCE', label: 'BookingService.createBooking', file: 'BookingService.java', symbol: 'createBooking' },
						{ kind: 'SPEC', label: 'booking.spec:12' }
					]
				}
			]
		},
		{
			id: 'B3',
			title: 'Cardinality / empty-request rule',
			aggregateDisposition: 'SYNCED',
			obligations: [
				{
					id: 'B3-cardinality',
					kind: 'PRECONDITION',
					disposition: 'SYNCED',
					governed: { summary: 'requestedSeats.size must be >= 1', expression: 'Cardinality(requestedSeats) >= 1', provenance: 'SPECIFIED' },
					recovered: { summary: 'recovered size check matches the governed lower bound', expression: 'requestedSeats.size() >= 1', provenance: 'DERIVED' },
					why: 'recovered cardinality check is proof-equivalent to the governed bound',
					reasons: [],
					completeness: 'COMPLETE',
					anchors: [
						{ kind: 'SOURCE', label: 'BookingService.createBooking', file: 'BookingService.java', symbol: 'createBooking' },
						{ kind: 'SPEC', label: 'booking.spec:14' }
					]
				}
			]
		},
		{
			id: 'B2',
			title: 'Requested seats distinct by Seat.id',
			aggregateDisposition: 'SYNCED',
			obligations: [
				{
					id: 'B2-distinctness',
					kind: 'RELATIONAL',
					disposition: 'SYNCED',
					governed: { summary: 'requestedSeats must be distinct by Seat.id', expression: 'DistinctBy(requestedSeats, Seat.id)', provenance: 'SPECIFIED' },
					recovered: {
						summary: 'duplicate exists when two requested seats share the same id',
						expression: 'ExistsDuplicateBy(requestedSeats, Seat.id)',
						evidence: [
							'i ∈ [0, |requestedSeats|)',
							'j ∈ [i+1, |requestedSeats|)',
							'requestedSeats[i].id == requestedSeats[j].id',
							'Return(true)'
						],
						provenance: 'DERIVED'
					},
					why: 'violation(DistinctBy(requestedSeats, Seat.id)) <=> ExistsDuplicateBy(requestedSeats, Seat.id); duplicate witness exactly represents violation of governed distinctness',
					reasons: [],
					completeness: 'BOUNDED',
					anchors: [
						{ kind: 'SOURCE', label: 'BookingService.hasDuplicate', file: 'BookingService.java', symbol: 'hasDuplicate' },
						{ kind: 'SPEC', label: 'booking.spec:20' }
					]
				}
			]
		},
		{
			id: 'B8',
			title: 'Booking status guarded transition',
			aggregateDisposition: 'CONFLICTED',
			obligations: [
				{
					id: 'B8-guard',
					kind: 'GUARD',
					disposition: 'WRONG_OPERATION_SCOPE',
					governed: { summary: 'legacy status guard must hold before confirmation', expression: 'Guard(status == PENDING)', provenance: 'SPECIFIED' },
					recovered: undefined,
					why: 'the guard was governed against a different operation than the one exercised; not observed in the operation actually recovered',
					reasons: ['NOT_OBSERVED_IN_RECOVERED_OPERATION_SCOPE'],
					completeness: 'UNKNOWN',
					anchors: [
						{ kind: 'SPEC', label: 'booking.spec:28' }
					]
				},
				{
					id: 'B8-effect',
					kind: 'EFFECT',
					disposition: 'SYNCED',
					governed: { summary: 'booking.status becomes CONFIRMED', expression: 'booking.status := BookingStatus.CONFIRMED', provenance: 'SPECIFIED' },
					recovered: { summary: 'recovered mutation sets the confirmed status exactly', expression: 'booking.status = BookingStatus.CONFIRMED', provenance: 'DERIVED' },
					why: 'recovered exact state mutation matches the governed effect',
					reasons: [],
					completeness: 'COMPLETE',
					anchors: [
						{ kind: 'SOURCE', label: 'BookingService.confirmBooking', file: 'BookingService.java', symbol: 'confirmBooking' },
						{ kind: 'SPEC', label: 'booking.spec:30' }
					]
				}
			]
		},
		{
			id: 'hall-consistency',
			title: 'Hall consistency',
			aggregateDisposition: 'PARTIAL',
			obligations: [
				{
					id: 'hall-consistency-obligation',
					kind: 'RELATIONAL',
					disposition: 'UNSUPPORTED',
					governed: { summary: 'requested hall must match showtime hall', expression: 'Hall(request) == Hall(showtime)', provenance: 'SPECIFIED' },
					recovered: undefined,
					why: undefined,
					reasons: ['UNSUPPORTED_SEMANTIC_CLASS'],
					completeness: 'UNKNOWN',
					anchors: []
				}
			]
		},
		{
			id: 'occupancy',
			title: 'Occupancy',
			aggregateDisposition: 'UNSUPPORTED',
			obligations: [
				{
					id: 'occupancy-obligation',
					kind: 'RELATIONAL',
					disposition: 'UNSUPPORTED',
					governed: { summary: 'occupied seats must not exceed hall capacity', expression: 'Occupancy(hall) <= Capacity(hall)', provenance: 'SPECIFIED' },
					recovered: undefined,
					why: undefined,
					reasons: ['UNSUPPORTED_SEMANTIC_CLASS'],
					completeness: 'UNKNOWN',
					anchors: []
				}
			]
		},
		{
			id: 'past-showtime',
			title: 'Past-showtime rule',
			aggregateDisposition: 'UNSUPPORTED',
			obligations: [
				{
					id: 'past-showtime-obligation',
					kind: 'PRECONDITION',
					disposition: 'UNSUPPORTED',
					governed: { summary: 'booking must not target a showtime already in the past', expression: 'Showtime(booking) >= Now()', provenance: 'SPECIFIED' },
					recovered: undefined,
					why: undefined,
					reasons: ['UNSUPPORTED_SEMANTIC_CLASS'],
					completeness: 'UNKNOWN',
					anchors: []
				}
			]
		}
	]
};
