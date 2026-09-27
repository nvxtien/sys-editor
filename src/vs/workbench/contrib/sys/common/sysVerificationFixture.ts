import { VerificationProject } from './sysVerification.js';

/**
 * Sample verification data covering the shapes the Verification view must render:
 * precondition/collection, state/effect, relational, and a compound rule with
 * mixed obligation outcomes.
 */
export const SAMPLE_VERIFICATION_PROJECT: VerificationProject = {
	projectId: 'sample-project',
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
					governed: { summary: 'requestedItems must be non-empty', expression: 'NonEmpty(requestedItems)', provenance: 'SPECIFIED' },
					recovered: { summary: 'guard rejects when the requested list has no elements', expression: 'requestedItems.length > 0', evidence: ['requestedItems.length == 0 => reject'], provenance: 'DERIVED' },
					why: 'recovered emptiness guard exactly represents the negation of governed non-emptiness',
					reasons: [],
					completeness: 'COMPLETE',
					anchors: [
						{ kind: 'SOURCE', label: 'OrderService.createOrder', file: 'OrderService.java', symbol: 'createOrder' },
						{ kind: 'SPEC', label: 'order.spec:12' }
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
					governed: { summary: 'requestedItems.size must be >= 1', expression: 'Cardinality(requestedItems) >= 1', provenance: 'SPECIFIED' },
					recovered: { summary: 'recovered size check matches the governed lower bound', expression: 'requestedItems.size() >= 1', provenance: 'DERIVED' },
					why: 'recovered cardinality check is proof-equivalent to the governed bound',
					reasons: [],
					completeness: 'COMPLETE',
					anchors: [
						{ kind: 'SOURCE', label: 'OrderService.createOrder', file: 'OrderService.java', symbol: 'createOrder' },
						{ kind: 'SPEC', label: 'order.spec:14' }
					]
				}
			]
		},
		{
			id: 'B2',
			title: 'Requested seats distinct by Item.id',
			aggregateDisposition: 'SYNCED',
			obligations: [
				{
					id: 'B2-distinctness',
					kind: 'RELATIONAL',
					disposition: 'SYNCED',
					governed: { summary: 'requestedItems must be distinct by Item.id', expression: 'DistinctBy(requestedItems, Item.id)', provenance: 'SPECIFIED' },
					recovered: {
						summary: 'duplicate exists when two requested seats share the same id',
						expression: 'ExistsDuplicateBy(requestedItems, Item.id)',
						evidence: [
							'i ∈ [0, |requestedItems|)',
							'j ∈ [i+1, |requestedItems|)',
							'requestedItems[i].id == requestedItems[j].id',
							'Return(true)'
						],
						provenance: 'DERIVED'
					},
					why: 'violation(DistinctBy(requestedItems, Item.id)) <=> ExistsDuplicateBy(requestedItems, Item.id); duplicate witness exactly represents violation of governed distinctness',
					reasons: [],
					completeness: 'BOUNDED',
					anchors: [
						{ kind: 'SOURCE', label: 'OrderService.hasDuplicate', file: 'OrderService.java', symbol: 'hasDuplicate' },
						{ kind: 'SPEC', label: 'order.spec:20' }
					]
				}
			]
		},
		{
			id: 'B8',
			title: 'Order status guarded transition',
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
						{ kind: 'SPEC', label: 'order.spec:28' }
					]
				},
				{
					id: 'B8-effect',
					kind: 'EFFECT',
					disposition: 'SYNCED',
					governed: { summary: 'order.status becomes CONFIRMED', expression: 'order.status := OrderStatus.CONFIRMED', provenance: 'SPECIFIED' },
					recovered: { summary: 'recovered mutation sets the confirmed status exactly', expression: 'order.status = OrderStatus.CONFIRMED', provenance: 'DERIVED' },
					why: 'recovered exact state mutation matches the governed effect',
					reasons: [],
					completeness: 'COMPLETE',
					anchors: [
						{ kind: 'SOURCE', label: 'OrderService.confirmOrder', file: 'OrderService.java', symbol: 'confirmOrder' },
						{ kind: 'SPEC', label: 'order.spec:30' }
					]
				}
			]
		},
		{
			id: 'hall-consistency',
			title: 'Warehouse consistency',
			aggregateDisposition: 'PARTIAL',
			obligations: [
				{
					id: 'hall-consistency-obligation',
					kind: 'RELATIONAL',
					disposition: 'UNSUPPORTED',
					governed: { summary: 'requested warehouse must match schedule warehouse', expression: 'Warehouse(request) == Warehouse(schedule)', provenance: 'SPECIFIED' },
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
					governed: { summary: 'occupied items must not exceed warehouse capacity', expression: 'Occupancy(warehouse) <= Capacity(warehouse)', provenance: 'SPECIFIED' },
					recovered: undefined,
					why: undefined,
					reasons: ['UNSUPPORTED_SEMANTIC_CLASS'],
					completeness: 'UNKNOWN',
					anchors: []
				}
			]
		},
		{
			id: 'past-schedule',
			title: 'Past-schedule rule',
			aggregateDisposition: 'UNSUPPORTED',
			obligations: [
				{
					id: 'past-schedule-obligation',
					kind: 'PRECONDITION',
					disposition: 'UNSUPPORTED',
					governed: { summary: 'order must not target a schedule already in the past', expression: 'Schedule(order) >= Now()', provenance: 'SPECIFIED' },
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
