import { SysArtifactState } from './sysLifecycle.js';

export type SysIntentProvenance = 'SPECIFIED' | 'OBSERVED' | 'DERIVED' | 'INFERRED' | 'UNKNOWN';
export type SysStructuredIntentState = SysArtifactState;
export type SysFormalSpecState = SysArtifactState;

export type SysIntentKind = 'OPERATION_RULE' | 'DATA_MODEL' | 'RELATIONSHIP' | 'INVARIANT' | 'WORKFLOW' | 'UNKNOWN';
export const SYS_INTENT_KINDS: readonly SysIntentKind[] = ['OPERATION_RULE', 'DATA_MODEL', 'RELATIONSHIP', 'INVARIANT', 'WORKFLOW', 'UNKNOWN'];
export const SYS_INTENT_KIND_LABEL: Record<SysIntentKind, string> = {
	OPERATION_RULE: 'Operation rule',
	DATA_MODEL: 'Data model',
	RELATIONSHIP: 'Relationship',
	INVARIANT: 'Invariant',
	WORKFLOW: 'Workflow',
	UNKNOWN: 'Unknown'
};

export interface SysIntentFact {
	readonly value: string;
	readonly provenance: SysIntentProvenance;
}

export interface SysStructuredIntent {
	readonly version: 1;
	readonly requirementId: string;
	/** Absent only in records written before kinds existed; those were all operation rules. */
	readonly kind?: SysIntentKind;
	readonly intentStatement: SysIntentFact;
	readonly scope: SysIntentFact;
	readonly operation: SysIntentFact;
	readonly inputs: readonly SysIntentFact[];
	readonly constraints: readonly SysIntentFact[];
	readonly effects: readonly SysIntentFact[];
	readonly failureBehavior: readonly SysIntentFact[];
	readonly unknowns: readonly string[];
}

/** A Structured Intent as sys-core holds it; `state` and `identity` are core's, never derived here. */
export interface SysStructuredIntentRecord {
	readonly sourceRequirement: string;
	readonly draft: SysStructuredIntent;
	readonly state: SysStructuredIntentState;
	readonly identity?: string;
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

export function parseStructuredIntent(value: unknown, requirementId: string, options: { readonly requireKind?: boolean } = {}): SysStructuredIntent {
	if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1 || (value as { requirementId?: unknown }).requirementId !== requirementId) {
		throw new Error('Structured Intent has an invalid header');
	}
	const raw = value as Record<string, unknown>;
	if ((raw.kind !== undefined || options.requireKind) && !SYS_INTENT_KINDS.includes(raw.kind as SysIntentKind)) {
		throw new Error('Structured Intent has an invalid kind');
	}
	if (!Array.isArray(raw.unknowns) || raw.unknowns.some(item => typeof item !== 'string')) {
		throw new Error('Structured Intent has invalid unknowns');
	}
	return {
		version: 1,
		requirementId,
		...(raw.kind !== undefined ? { kind: raw.kind as SysIntentKind } : {}),
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

export type SysFormalizationStatus = 'SUPPORTED' | 'UNSUPPORTED' | 'PARTIALLY_SUPPORTED';
export type SysRequiredContext = 'OPERATION' | 'ENTITY_MODEL' | 'WORKFLOW' | 'NONE';
export type SysFormalizationOutcome = 'FORMAL_SPEC_SUPPORTED' | 'PLATFORM_FORMAL_SPEC_GAP' | 'NOT_FORMALIZABLE';

export interface SysFormalizationCapability {
	readonly kind: SysIntentKind;
	readonly status: SysFormalizationStatus;
	readonly requiredContext: SysRequiredContext;
	readonly outcome: SysFormalizationOutcome;
}

const STATUSES: readonly SysFormalizationStatus[] = ['SUPPORTED', 'UNSUPPORTED', 'PARTIALLY_SUPPORTED'];
const CONTEXTS: readonly SysRequiredContext[] = ['OPERATION', 'ENTITY_MODEL', 'WORKFLOW', 'NONE'];
const OUTCOMES: readonly SysFormalizationOutcome[] = ['FORMAL_SPEC_SUPPORTED', 'PLATFORM_FORMAL_SPEC_GAP', 'NOT_FORMALIZABLE'];

/**
 * The capability is decided by sys-core (`sys-core intent capability`), never here. The editor only
 * validates the reply against the contract so a malformed answer cannot unlock Formal Spec generation,
 * and drops source binding from that contract: sys-core's `operationBinding` field is ignored, and its
 * legacy `OPERATION_BINDING_REQUIRED` outcome reads as supported, because a source symbol is no longer a
 * lifecycle prerequisite. A fresh object is returned so no stray binding field reaches the rest of the editor.
 */
export function parseFormalizationCapability(value: unknown): SysFormalizationCapability {
	const raw = value as Partial<Record<string, unknown>> | null;
	if (!raw || typeof raw !== 'object') { throw new Error('sys-core returned an invalid formalization capability'); }
	// A legacy reply only loses its binding requirement; it must not gain formalizability. An
	// unsupported kind that asked for a binding is still a platform gap, not a Formal Spec.
	const outcome = raw.outcome !== 'OPERATION_BINDING_REQUIRED'
		? raw.outcome
		: raw.status === 'UNSUPPORTED' ? 'PLATFORM_FORMAL_SPEC_GAP' : 'FORMAL_SPEC_SUPPORTED';
	if (!SYS_INTENT_KINDS.includes(raw.kind as SysIntentKind)
		|| !STATUSES.includes(raw.status as SysFormalizationStatus)
		|| !CONTEXTS.includes(raw.requiredContext as SysRequiredContext)
		|| !OUTCOMES.includes(outcome as SysFormalizationOutcome)) {
		throw new Error('sys-core returned an invalid formalization capability');
	}
	return {
		kind: raw.kind as SysIntentKind,
		status: raw.status as SysFormalizationStatus,
		requiredContext: raw.requiredContext as SysRequiredContext,
		outcome: outcome as SysFormalizationOutcome
	};
}

/** One human sentence for a capability that is not ready; undefined when a Formal Spec can be generated. */
export function formalizationNote(capability: SysFormalizationCapability): string | undefined {
	const label = SYS_INTENT_KIND_LABEL[capability.kind];
	switch (capability.outcome) {
		case 'FORMAL_SPEC_SUPPORTED': return undefined;
		case 'PLATFORM_FORMAL_SPEC_GAP': return `${label}: PLATFORM_FORMAL_SPEC_GAP — the current Sys Platform grammar does not represent this intent kind yet. Its confirmed Structured Intent remains the governed record.`;
		case 'NOT_FORMALIZABLE': return `${label} kind: nothing to formalize yet. Clarify the requirement and normalize again.`;
	}
}
