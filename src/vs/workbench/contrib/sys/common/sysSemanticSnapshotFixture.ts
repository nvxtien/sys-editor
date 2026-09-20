import { SysProjectSnapshot } from './sysSemanticSnapshot.js';

export const CINEMA_BOOKING_SNAPSHOT: SysProjectSnapshot = {
	project: 'Cinema Booking (Fixture)', mode: 'FIXTURE', integration: 'READY', governedIntent: 'AVAILABLE',
	semanticItems: [
		{ id: 'balance-amount', title: 'Account balance', displayText: 'source account balance >= amount', disposition: 'SUPPORTED_EXACT', evidenceRefs: [{ id: 'f1', label: 'booking.spec:12' }], governedRef: 'rule://balance-amount', parsed: true },
		{ id: 'booking-unique', title: 'Booking code uniqueness', displayText: 'booking code must be unique', disposition: 'UNSUPPORTED', reason: 'UNSUPPORTED_UNIQUENESS', evidenceRefs: [{ id: 'f2', label: 'booking.spec:24' }], parsed: true },
		{ id: 'customer-binding', title: 'Customer validation', displayText: 'customer validation', disposition: 'UNRESOLVED', reason: 'UNRESOLVED_BINDING', evidenceRefs: [{ id: 'f3', label: 'booking.spec:31' }] },
		{ id: 'confirmed-status', title: 'Status transition rules', displayText: 'status transition rules', disposition: 'UNRESOLVED', reason: 'CONFIRMED_NOT_GOVERNED', evidenceRefs: [{ id: 'f4', label: 'human-intent:status-transition' }], confirmedHumanIntent: true },
	],
	recoveredMeaning: { state: 'PARTIAL', operations: ['createBooking'] }, sync: 'PARTIAL', reviewsRequiringAttention: 3,
	syncItems: [{ ruleId: 'balance-amount', label: 'Account balance', state: 'SYNCED', eligible: true }, { ruleId: 'booking-unique', label: 'Booking code uniqueness', state: 'NEVER_RUN', eligible: false }, { ruleId: 'customer-binding', label: 'Customer validation', state: 'NEVER_RUN', eligible: false }],
	reviews: [{ title: 'Booking code uniqueness', governed: 'UNSUPPORTED', recovered: 'UNKNOWN', state: 'NOT ELIGIBLE', evidence: 'UNSUPPORTED_UNIQUENESS', disposition: 'UNSUPPORTED' }],
	evidence: { operation: 'createBooking', recoveredSourcePaths: 6, fullyRecoveredGuards: 1, falseGreens: 0 },
};

export const LIVE_PLATFORM_API_GAP_SNAPSHOT: SysProjectSnapshot = { ...CINEMA_BOOKING_SNAPSHOT, project: 'Live workspace', mode: 'LIVE', integration: 'PLATFORM_API_GAP', governedIntent: 'NOT_AVAILABLE', semanticItems: [], recoveredMeaning: { state: 'NOT_AVAILABLE', operations: [] }, sync: 'NEVER_RUN', reviewsRequiringAttention: 0, syncItems: [], reviews: [], evidence: { operation: '', recoveredSourcePaths: 0, fullyRecoveredGuards: 0, falseGreens: 0 } };
