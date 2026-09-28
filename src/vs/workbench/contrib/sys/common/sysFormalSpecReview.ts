import { formalizationNote, SYS_FORMAL_SPEC_KIND_LABEL, SysFormalizationCapability, SysFormalSpecEntity, SysFormalSpecFact, SysFormalSpecProvenance, SysFormalSpecRecord } from './sysFormalSpec.js';

const PROVENANCE: Record<SysFormalSpecProvenance, string> = {
	SPECIFIED: 'stated by you',
	OBSERVED: 'observed in the source code',
	DERIVED: 'derived from what you stated',
	INFERRED: '⚠ model’s guess, please check',
	UNKNOWN: '⚠ unknown, needs an answer'
};

const oneLine = (text: string) => text.replace(/\s*\n\s*/g, ' ').trim();

function line(fact: SysFormalSpecFact): string {
	const value = fact.provenance === 'UNKNOWN' && fact.value.trim().toUpperCase() === 'UNKNOWN' ? 'Not stated' : oneLine(fact.value);
	return `${value} — ${PROVENANCE[fact.provenance]}`;
}

/**
 * Scenarios are multi-line Gherkin, so they are fenced and kept verbatim — `line()` would collapse
 * them to one line and `list()` would bullet them, and either makes them unreadable.
 */
function scenarioSection(gherkin: string, isPreview: boolean): string[] {
	return [
		'## Scenarios',
		'',
		...(isPreview ? ['⚠ preview only — not yet part of the confirmed Formal Spec', ''] : []),
		'```gherkin', gherkin.trimEnd(), '```', ''
	];
}

function entitySections(entities: readonly SysFormalSpecEntity[]): string[] {
	return entities.flatMap(entity => [
		`### ${entity.name}`,
		'',
		entity.fields.length ? entity.fields.map(field => `- ${field.name}: ${field.type} — ${PROVENANCE[field.provenance]}`).join('\n') : '_No fields stated._',
		''
	]);
}

function list(facts: readonly SysFormalSpecFact[]): string {
	return facts.length ? facts.map(fact => `- ${line(fact)}`).join('\n') : '_None stated._';
}

/**
 * Only a kind the platform can actually formalize is promised a Formal Spec. A kind it cannot
 * formalize says nothing: the promise would be false, and the reason is platform vocabulary the
 * reader did not ask for. A capability sys-core could not answer is not a gap, and says so.
 */
function capabilityLines(capability: SysFormalizationCapability | undefined): string[] {
	if (!capability) { return ['What can be formalized for this kind could not be read from sys-core.', '']; }
	if (capability.outcome === 'FORMAL_SPEC_SUPPORTED') { return ['A Formal Spec can be generated from this intent once it is confirmed.', '']; }
	const note = formalizationNote(capability);
	return note ? [note, ''] : [];
}

/**
 * A plain-language projection of the Formal Spec JSON for human review. It is derived from the
 * same record that gets confirmed, never edited, and never a second source of truth.
 */
export function renderFormalSpecReview(record: SysFormalSpecRecord, capability: SysFormalizationCapability | undefined, scenarios?: string, scenariosArePreview = false): string {
	const d = record.draft;
	const status = record.state === 'APPROVED' ? 'CONFIRMED' : record.state === 'STALE' ? 'STALE — the requirement changed after this was reviewed' : 'DRAFT — not yet confirmed';
	const quoted = record.sourceRequirement.trim().split('\n').map(text => `> ${text}`).join('\n');
	// Each kind states different things. A data model has entities and relationships and no
	// operation; rendering it with the operation-rule layout asked the reader for an operation that
	// does not exist. Sections a kind does not use are left out rather than shown empty.
	const describesEntities = d.entities !== undefined || d.relationships !== undefined;
	const scenarioLines = scenarios?.trim() ? scenarioSection(scenarios, scenariosArePreview) : [];
	const sections = describesEntities
		? [
			...scenarioLines,
			...(d.entities?.length ? ['## Entities', '', ...entitySections(d.entities)] : []),
			...(d.relationships?.length ? ['## Relationships', '', list(d.relationships), ''] : []),
			...(d.constraints.length ? ['## Constraints', '', list(d.constraints), ''] : [])
		]
		: [
			...scenarioLines,
			...(d.operation ? ['## Operation', '', line(d.operation), ''] : []),
			'## Inputs', '', list(d.inputs), '',
			'## Constraints', '', list(d.constraints), '',
			'## Effects', '', list(d.effects), '',
			'## Failure behavior', '', list(d.failureBehavior), ''
		];
	return [
		`# ${d.requirementId} — Formal Spec review`,
		'',
		`Status: ${status}`,
		'',
		`_Generated view — do not edit. What you confirm is ${d.requirementId}.intent.json; this page only shows it in plain language. Items marked ⚠ need your attention._`,
		'',
		'## Kind',
		'',
		d.kind ? `${SYS_FORMAL_SPEC_KIND_LABEL[d.kind]} — ⚠ model’s classification, please check` : `${SYS_FORMAL_SPEC_KIND_LABEL.OPERATION_RULE} — recorded before kinds existed`,
		'',
		...capabilityLines(capability),
		'## Intent',
		'',
		line(d.intentStatement),
		'',
		'## Scope',
		'',
		line(d.scope),
		'',
		...sections,
		'## Open questions',
		'',
		d.unknowns.length ? d.unknowns.map(text => `- ${oneLine(text)}`).join('\n') : '_None._',
		'',
		'## Your original requirement',
		'',
		quoted,
		''
	].join('\n');
}
