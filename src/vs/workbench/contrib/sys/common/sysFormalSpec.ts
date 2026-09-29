import { SysArtifactState } from './sysLifecycle.js';

export type SysFormalSpecProvenance = 'SPECIFIED' | 'OBSERVED' | 'DERIVED' | 'INFERRED' | 'UNKNOWN';
export type SysFormalSpecState = SysArtifactState;
export type SysFormalSpecState = SysArtifactState;

export type SysFormalSpecKind = 'OPERATION_RULE' | 'DATA_MODEL' | 'RELATIONSHIP' | 'INVARIANT' | 'WORKFLOW' | 'UNKNOWN';
export const SYS_FORMAL_SPEC_KINDS: readonly SysFormalSpecKind[] = ['OPERATION_RULE', 'DATA_MODEL', 'RELATIONSHIP', 'INVARIANT', 'WORKFLOW', 'UNKNOWN'];
export const SYS_FORMAL_SPEC_KIND_LABEL: Record<SysFormalSpecKind, string> = {
	OPERATION_RULE: 'Operation rule',
	DATA_MODEL: 'Data model',
	RELATIONSHIP: 'Relationship',
	INVARIANT: 'Invariant',
	WORKFLOW: 'Workflow',
	UNKNOWN: 'Unknown'
};

export interface SysFormalSpecFact {
	readonly value: string;
	readonly provenance: SysFormalSpecProvenance;
}

/** One field of an entity: its own name and type, not a generic input fact. */
export interface SysFormalSpecField {
	readonly name: string;
	readonly type: string;
	readonly provenance: SysFormalSpecProvenance;
}

export interface SysFormalSpecEntity {
	readonly name: string;
	readonly fields: readonly SysFormalSpecField[];
}

export interface SysFormalSpecThenDecision {
	readonly scenario: string;
	readonly then: {
		readonly field: string;
		readonly becomes: string;
		readonly provenance: SysFormalSpecProvenance;
	};
}

export interface SysFormalSpec {
	readonly version: 1;
	readonly requirementId: string;
	/** Absent only in records written before kinds existed; those were all operation rules. */
	readonly kind?: SysFormalSpecKind;
	readonly intentStatement: SysFormalSpecFact;
	readonly scope: SysFormalSpecFact;
	/** null when the kind has no operation (a data model, a relationship); absent in older records. */
	readonly operation: SysFormalSpecFact | null;
	/** Stated by a data model; absent for kinds that describe no entities. */
	readonly entities?: readonly SysFormalSpecEntity[];
	/** How entities relate; absent for kinds that describe no relationships. */
	readonly relationships?: readonly SysFormalSpecFact[];
	readonly inputs: readonly SysFormalSpecFact[];
	readonly constraints: readonly SysFormalSpecFact[];
	readonly effects: readonly SysFormalSpecFact[];
	readonly failureBehavior: readonly SysFormalSpecFact[];
	readonly unknowns: readonly string[];
	/** Real Gherkin text, governed once confirmed. Absent in records written before this existed. */
	readonly behavior?: string;
	/** A scenario's optional structured Then, keyed by the scenario's own name. */
	readonly thenDecisions?: readonly SysFormalSpecThenDecision[];
}

/** A Formal Spec as sys-core holds it; `state` and `identity` are core's, never derived here. */
export interface SysFormalSpecRecord {
	readonly sourceRequirement: string;
	readonly draft: SysFormalSpec;
	readonly state: SysFormalSpecState;
	readonly identity?: string;
}

const provenance = new Set<SysFormalSpecProvenance>(['SPECIFIED', 'OBSERVED', 'DERIVED', 'INFERRED', 'UNKNOWN']);

function fact(value: unknown, label: string): SysFormalSpecFact {
	if (!value || typeof value !== 'object' || typeof (value as { value?: unknown }).value !== 'string' || !provenance.has((value as { provenance?: unknown }).provenance as SysFormalSpecProvenance)) {
		throw new Error(`Formal Spec has an invalid ${label}`);
	}
	return value as SysFormalSpecFact;
}

function entities(value: unknown): readonly SysFormalSpecEntity[] {
	if (!Array.isArray(value)) { throw new Error('Formal Spec has invalid entities'); }
	return value.map(entity => {
		const raw = entity as { name?: unknown; fields?: unknown };
		if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || !raw.name.trim() || !Array.isArray(raw.fields)) {
			throw new Error('Formal Spec has invalid entities');
		}
		return {
			name: raw.name,
			fields: raw.fields.map(field => {
				const f = field as { name?: unknown; type?: unknown; provenance?: unknown };
				if (!f || typeof f !== 'object' || typeof f.name !== 'string' || !f.name.trim() || typeof f.type !== 'string' || !provenance.has(f.provenance as SysFormalSpecProvenance)) {
					throw new Error('Formal Spec has invalid entities');
				}
				return { name: f.name, type: f.type, provenance: f.provenance as SysFormalSpecProvenance };
			})
		};
	});
}

function thenDecisions(value: unknown): readonly SysFormalSpecThenDecision[] {
	if (!Array.isArray(value)) { throw new Error('Formal Spec has invalid thenDecisions'); }
	return value.map(entry => {
		const raw = entry as { scenario?: unknown; then?: unknown };
		if (!raw || typeof raw !== 'object' || typeof raw.scenario !== 'string' || !raw.scenario.trim()) {
			throw new Error('Formal Spec has invalid thenDecisions');
		}
		const then = raw.then as { field?: unknown; becomes?: unknown; provenance?: unknown };
		if (!then || typeof then !== 'object' || typeof then.field !== 'string' || !then.field.trim()
			|| typeof then.becomes !== 'string' || !provenance.has(then.provenance as SysFormalSpecProvenance)) {
			throw new Error('Formal Spec has invalid thenDecisions');
		}
		return { scenario: raw.scenario, then: { field: then.field, becomes: then.becomes, provenance: then.provenance as SysFormalSpecProvenance } };
	});
}

/**
 * Absent is not the same as wrong. A kind that states no inputs, effects or failures omits them —
 * the normalize prompt asks a data model to do exactly that — so a missing list is an empty one.
 * A list that is present but malformed is still rejected.
 */
function facts(value: unknown, label: string): readonly SysFormalSpecFact[] {
	if (value === undefined || value === null) { return []; }
	if (!Array.isArray(value)) { throw new Error(`Formal Spec has an invalid ${label}`); }
	return value.map((item, index) => fact(item, `${label}[${index}]`));
}

export function parseFormalSpec(value: unknown, requirementId: string, options: { readonly requireKind?: boolean } = {}): SysFormalSpec {
	if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1 || (value as { requirementId?: unknown }).requirementId !== requirementId) {
		throw new Error('Formal Spec has an invalid header');
	}
	const raw = value as Record<string, unknown>;
	if ((raw.kind !== undefined || options.requireKind) && !SYS_FORMAL_SPEC_KINDS.includes(raw.kind as SysFormalSpecKind)) {
		throw new Error('Formal Spec has an invalid kind');
	}
	if (raw.unknowns !== undefined && raw.unknowns !== null
		&& (!Array.isArray(raw.unknowns) || raw.unknowns.some(item => typeof item !== 'string'))) {
		throw new Error('Formal Spec has invalid unknowns');
	}
	if (raw.behavior !== undefined && raw.behavior !== null && typeof raw.behavior !== 'string') {
		throw new Error('Formal Spec has an invalid behavior');
	}
	return {
		version: 1,
		requirementId,
		...(raw.kind !== undefined ? { kind: raw.kind as SysFormalSpecKind } : {}),
		intentStatement: fact(raw.intentStatement, 'intentStatement'),
		scope: fact(raw.scope, 'scope'),
		operation: raw.operation === null ? null : fact(raw.operation, 'operation'),
		...(raw.entities === undefined ? {} : { entities: entities(raw.entities) }),
		...(raw.relationships === undefined ? {} : { relationships: facts(raw.relationships, 'relationships') }),
		inputs: facts(raw.inputs, 'inputs'),
		constraints: facts(raw.constraints, 'constraints'),
		effects: facts(raw.effects, 'effects'),
		failureBehavior: facts(raw.failureBehavior, 'failureBehavior'),
		unknowns: (raw.unknowns as readonly string[] | undefined) ?? [],
		...(typeof raw.behavior === 'string' ? { behavior: raw.behavior } : {}),
		// Loose equality is deliberate here: treat both `undefined` and a serialized `null` as absent.
		...(raw.thenDecisions == null ? {} : { thenDecisions: thenDecisions(raw.thenDecisions) }),
	};
}

export function serializeFormalSpec(intent: SysFormalSpec): string {
	return JSON.stringify(intent, null, 2) + '\n';
}

export type SysFormalizationStatus = 'SUPPORTED' | 'UNSUPPORTED' | 'PARTIALLY_SUPPORTED';
export type SysRequiredContext = 'OPERATION' | 'ENTITY_MODEL' | 'WORKFLOW' | 'NONE';
export type SysFormalizationOutcome = 'FORMAL_SPEC_SUPPORTED' | 'OPERATION_UNSPECIFIED' | 'PLATFORM_FORMAL_SPEC_GAP' | 'NOT_FORMALIZABLE';

export interface SysFormalizationCapability {
	readonly kind: SysFormalSpecKind;
	readonly status: SysFormalizationStatus;
	readonly requiredContext: SysRequiredContext;
	readonly outcome: SysFormalizationOutcome;
	/** Governed constructs this intent's facts require; absent from an older sys-core. */
	readonly requiredConstructs?: readonly string[];
	/** The subset the platform cannot represent yet, named so a reader knows what is missing. */
	readonly unsupportedConstructs?: readonly string[];
}

const STATUSES: readonly SysFormalizationStatus[] = ['SUPPORTED', 'UNSUPPORTED', 'PARTIALLY_SUPPORTED'];
const CONTEXTS: readonly SysRequiredContext[] = ['OPERATION', 'ENTITY_MODEL', 'WORKFLOW', 'NONE'];
const OUTCOMES: readonly SysFormalizationOutcome[] = ['FORMAL_SPEC_SUPPORTED', 'OPERATION_UNSPECIFIED', 'PLATFORM_FORMAL_SPEC_GAP', 'NOT_FORMALIZABLE'];

/**
 * The capability is decided by sys-core (`sys-core intent capability`), never here. The editor only
 * validates the reply against the contract so a malformed answer cannot unlock Formal Spec generation.
 * Source binding is not part of that contract: sys-core's `operationBinding` field is ignored, and a
 * reply still carrying the retired `OPERATION_BINDING_REQUIRED` outcome is refused rather than read as
 * supported — such a sys-core would reject the very generation the button would offer. A fresh object
 * is returned so no stray binding field reaches the rest of the editor.
 */
export function parseFormalizationCapability(value: unknown): SysFormalizationCapability {
	const raw = value as Partial<Record<string, unknown>> | null;
	if (!raw || typeof raw !== 'object') { throw new Error('sys-core returned an invalid formalization capability'); }
	const outcome = raw.outcome;
	if (!SYS_FORMAL_SPEC_KINDS.includes(raw.kind as SysFormalSpecKind)
		|| !STATUSES.includes(raw.status as SysFormalizationStatus)
		|| !CONTEXTS.includes(raw.requiredContext as SysRequiredContext)
		|| !OUTCOMES.includes(outcome as SysFormalizationOutcome)) {
		throw new Error('sys-core returned an invalid formalization capability');
	}
	return {
		kind: raw.kind as SysFormalSpecKind,
		status: raw.status as SysFormalizationStatus,
		requiredContext: raw.requiredContext as SysRequiredContext,
		outcome: outcome as SysFormalizationOutcome,
		...constructs(raw.requiredConstructs, 'requiredConstructs'),
		...constructs(raw.unsupportedConstructs, 'unsupportedConstructs')
	};
}

/** Additive: an older sys-core sends neither set, and the editor must still read the reply. */
function constructs(value: unknown, key: 'requiredConstructs' | 'unsupportedConstructs'): Record<string, readonly string[]> {
	if (value === undefined) { return {}; }
	if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
		throw new Error('sys-core returned an invalid formalization capability');
	}
	return { [key]: value as readonly string[] };
}

/** One human sentence for a capability that is not ready; undefined when a Formal Spec can be generated. */
export function formalizationNote(capability: SysFormalizationCapability): string | undefined {
	const label = SYS_FORMAL_SPEC_KIND_LABEL[capability.kind];
	switch (capability.outcome) {
		case 'FORMAL_SPEC_SUPPORTED': return undefined;
		case 'OPERATION_UNSPECIFIED': return `${label}: this Formal Spec states no operation, and a Formal Spec must declare one. Clarify which operation the requirement governs and normalize again.`;
		// No note: the page already shows the kind and everything the intent states. Narrating the
		// platform's own limits on top of that is vocabulary the reader did not ask for, in the
		// middle of reading their own requirement back.
		case 'PLATFORM_FORMAL_SPEC_GAP': return undefined;
		case 'NOT_FORMALIZABLE': return undefined;
	}
}
