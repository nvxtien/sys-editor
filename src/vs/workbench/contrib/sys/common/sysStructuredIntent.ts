export type SysIntentProvenance = 'SPECIFIED' | 'OBSERVED' | 'DERIVED' | 'INFERRED' | 'UNKNOWN';
export type SysStructuredIntentState = 'NOT_CREATED' | 'DRAFT' | 'APPROVED' | 'STALE';
export type SysFormalSpecState = 'NOT_CREATED' | 'DRAFT' | 'APPROVED' | 'STALE';

export interface SysIntentFact {
	readonly value: string;
	readonly provenance: SysIntentProvenance;
}

export interface SysStructuredIntent {
	readonly version: 1;
	readonly requirementId: string;
	readonly intentStatement: SysIntentFact;
	readonly scope: SysIntentFact;
	readonly operation: SysIntentFact;
	readonly inputs: readonly SysIntentFact[];
	readonly constraints: readonly SysIntentFact[];
	readonly effects: readonly SysIntentFact[];
	readonly failureBehavior: readonly SysIntentFact[];
	readonly unknowns: readonly string[];
}

export interface SysStructuredIntentRecord {
	readonly sourceRequirement: string;
	readonly draft: SysStructuredIntent;
	readonly approvedContent?: string;
}

const provenance = new Set<SysIntentProvenance>(['SPECIFIED', 'OBSERVED', 'DERIVED', 'INFERRED', 'UNKNOWN']);

function fact(value: unknown, label: string): SysIntentFact {
	if (!value || typeof value !== 'object' || typeof (value as { value?: unknown }).value !== 'string' || !provenance.has((value as { provenance?: unknown }).provenance as SysIntentProvenance)) {
		throw new Error(`Structured Intent has an invalid ${label}`);
	}
	return value as SysIntentFact;
}

function facts(value: unknown, label: string): readonly SysIntentFact[] {
	if (!Array.isArray(value)) { throw new Error(`Structured Intent has an invalid ${label}`); }
	return value.map((item, index) => fact(item, `${label}[${index}]`));
}

export function parseStructuredIntent(value: unknown, requirementId: string): SysStructuredIntent {
	if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1 || (value as { requirementId?: unknown }).requirementId !== requirementId) {
		throw new Error('Structured Intent has an invalid header');
	}
	const raw = value as Record<string, unknown>;
	if (!Array.isArray(raw.unknowns) || raw.unknowns.some(item => typeof item !== 'string')) {
		throw new Error('Structured Intent has invalid unknowns');
	}
	return {
		version: 1,
		requirementId,
		intentStatement: fact(raw.intentStatement, 'intentStatement'),
		scope: fact(raw.scope, 'scope'),
		operation: fact(raw.operation, 'operation'),
		inputs: facts(raw.inputs, 'inputs'),
		constraints: facts(raw.constraints, 'constraints'),
		effects: facts(raw.effects, 'effects'),
		failureBehavior: facts(raw.failureBehavior, 'failureBehavior'),
		unknowns: raw.unknowns,
	};
}

export function serializeStructuredIntent(intent: SysStructuredIntent): string {
	return JSON.stringify(intent, null, 2) + '\n';
}

export function structuredIntentState(record: SysStructuredIntentRecord | undefined, currentRequirement: string): SysStructuredIntentState {
	if (!record) { return 'NOT_CREATED'; }
	if (record.sourceRequirement !== currentRequirement) { return 'STALE'; }
	if (!record.approvedContent) { return 'DRAFT'; }
	return record.approvedContent === serializeStructuredIntent(record.draft) ? 'APPROVED' : 'STALE';
}

export function approveStructuredIntent(record: SysStructuredIntentRecord, currentRequirement: string): SysStructuredIntentRecord {
	if (record.sourceRequirement !== currentRequirement) { throw new Error('Structured Intent is stale; normalize the current requirement first.'); }
	return { ...record, approvedContent: serializeStructuredIntent(record.draft) };
}

export function canGenerateFormalSpec(record: SysStructuredIntentRecord | undefined, currentRequirement: string): boolean {
	return structuredIntentState(record, currentRequirement) === 'APPROVED' && record?.draft.operation.provenance !== 'UNKNOWN' && record.draft.operation.value.trim() !== '';
}

export function formalSpecState(approvedSpec: string | undefined, approvedIntent: string | undefined, currentSpec: string | undefined, currentIntent: SysStructuredIntentRecord | undefined, currentRequirement: string): SysFormalSpecState {
	if (!currentSpec) { return 'NOT_CREATED'; }
	if (!approvedSpec || !approvedIntent) { return 'DRAFT'; }
	if (structuredIntentState(currentIntent, currentRequirement) !== 'APPROVED') { return 'STALE'; }
	return approvedSpec === currentSpec && approvedIntent === serializeStructuredIntent(currentIntent!.draft) ? 'APPROVED' : 'STALE';
}
