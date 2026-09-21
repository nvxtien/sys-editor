/**
 * Presentation contract for the Semantic Verification Workbench.
 *
 * sys-platform is authoritative for every disposition and reason below.
 * Nothing here may be derived from display text or source inspection;
 * fields absent from the platform must render as missing, not fabricated.
 */

export type VerificationDisposition =
	| 'SYNCED'
	| 'DRIFTED'
	| 'CONFLICTED'
	| 'PARTIAL'
	| 'NOT_OBSERVED'
	| 'UNSUPPORTED'
	| 'WRONG_OPERATION_SCOPE';

export type VerificationProvenance = 'SPECIFIED' | 'OBSERVED' | 'DERIVED' | 'INFERRED';

export type VerificationContractStatus = 'READY' | 'PLATFORM_CONTRACT_GAP';

export interface VerificationAnchor {
	readonly kind: 'SOURCE' | 'SPEC';
	readonly label: string;
	readonly file?: string;
	readonly symbol?: string;
	readonly range?: string;
}

export interface VerificationSemanticView {
	readonly summary: string;
	readonly expression?: string;
	readonly evidence?: readonly string[];
	readonly provenance: VerificationProvenance;
	/** Live contract only: structured object as sent by the platform, plus its completeness. */
	readonly kind?: string;
	readonly data?: unknown;
	readonly completeness?: string;
}

export interface VerificationObligation {
	readonly id: string;
	readonly kind: string;
	readonly disposition: VerificationDisposition;
	readonly governed?: VerificationSemanticView;
	readonly recovered?: VerificationSemanticView;
	readonly why?: string;
	readonly reasons: readonly string[];
	readonly completeness?: 'COMPLETE' | 'BOUNDED' | 'UNKNOWN';
	/** Live contract only: structured platform evidence, one bounded line per entry. */
	readonly evidence?: readonly string[];
	/** Live contract only: structured proof rendered line by line. */
	readonly proof?: readonly string[];
	readonly anchors: readonly VerificationAnchor[];
}

export interface VerificationRule {
	readonly id: string;
	readonly title: string;
	readonly aggregateDisposition: VerificationDisposition;
	/** Live contract only: rule-level structured evidence (e.g. exists-witnesses). */
	readonly evidence?: readonly string[];
	readonly obligations: readonly VerificationObligation[];
}

export interface VerificationProject {
	readonly projectId: string;
	readonly contractStatus: VerificationContractStatus;
	readonly dataSource?: 'LIVE' | 'FIXTURE';
	readonly rules: readonly VerificationRule[];
	readonly missingPlatformFields?: readonly string[];
}

export const ALL_DISPOSITIONS: readonly VerificationDisposition[] = [
	'SYNCED', 'DRIFTED', 'CONFLICTED', 'PARTIAL', 'NOT_OBSERVED', 'UNSUPPORTED', 'WRONG_OPERATION_SCOPE'
];

/** Deterministic label; never inferred from any other field. */
export function dispositionLabel(disposition: VerificationDisposition): string {
	switch (disposition) {
		case 'SYNCED': return 'Synced';
		case 'DRIFTED': return 'Drifted';
		case 'CONFLICTED': return 'Conflicted';
		case 'PARTIAL': return 'Partial';
		case 'NOT_OBSERVED': return 'Not observed';
		case 'UNSUPPORTED': return 'Unsupported';
		case 'WRONG_OPERATION_SCOPE': return 'Wrong operation scope';
	}
}

export type DispositionFilter = VerificationDisposition | 'ALL';

export function filterRulesByDisposition(rules: readonly VerificationRule[], filter: DispositionFilter): readonly VerificationRule[] {
	if (filter === 'ALL') {
		return rules;
	}
	return rules.filter(rule => rule.aggregateDisposition === filter || rule.obligations.some(o => o.disposition === filter));
}

/** Keeps the current selection across a data refresh only if that id still exists. */
export function pickStableSelection(rules: readonly VerificationRule[], previousSelectedId: string | undefined): string | undefined {
	if (!previousSelectedId) {
		return undefined;
	}
	const stillExists = rules.some(rule => rule.id === previousSelectedId || rule.obligations.some(o => o.id === previousSelectedId));
	return stillExists ? previousSelectedId : undefined;
}
