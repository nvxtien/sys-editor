import { formalizationNote, SYS_INTENT_KIND_LABEL, SysFormalizationCapability, SysIntentEntity, SysIntentFact, SysIntentProvenance, SysStructuredIntentRecord } from './sysStructuredIntent.js';

const PROVENANCE: Record<SysIntentProvenance, string> = {
	SPECIFIED: 'stated by you',
	OBSERVED: 'observed in the source code',
	DERIVED: 'derived from what you stated',
	INFERRED: '⚠ model’s guess, please check',
	UNKNOWN: '⚠ unknown, needs an answer'
};

const oneLine = (text: string) => text.replace(/\s*\n\s*/g, ' ').trim();

function line(fact: SysIntentFact): string {
	const value = fact.provenance === 'UNKNOWN' && fact.value.trim().toUpperCase() === 'UNKNOWN' ? 'Not stated' : oneLine(fact.value);
	return `${value} — ${PROVENANCE[fact.provenance]}`;
}

/**
 * Scenarios are multi-line Gherkin, so they are fenced and kept verbatim — `line()` would collapse
 * them to one line and `list()` would bullet them, and either makes them unreadable.
 */
function scenarioSection(gherkin: string): string[] {
	return ['## Scenarios', '', '```gherkin', gherkin.trimEnd(), '```', ''];
}

function entitySections(entities: readonly SysIntentEntity[]): string[] {
	return entities.flatMap(entity => [
		`### ${entity.name}`,
		'',
		entity.fields.length ? entity.fields.map(field => `- ${field.name}: ${field.type} — ${PROVENANCE[field.provenance]}`).join('\n') : '_No fields stated._',
		''
	]);
}

function list(facts: readonly SysIntentFact[]): string {
	return facts.length ? facts.map(fact => `- ${line(fact)}`).join('\n') : '_None stated._';
}

/**
 * A plain-language projection of the Structured Intent JSON for human review. It is derived from the
 * same record that gets confirmed, never edited, and never a second source of truth.
 */
export function renderStructuredIntentReview(record: SysStructuredIntentRecord, capability: SysFormalizationCapability | undefined, scenarios?: string): string {
	const d = record.draft;
	const status = record.state === 'APPROVED' ? 'CONFIRMED' : record.state === 'STALE' ? 'STALE — the requirement changed after this was reviewed' : 'DRAFT — not yet confirmed';
	const quoted = record.sourceRequirement.trim().split('\n').map(text => `> ${text}`).join('\n');
	// Each kind states different things. A data model has entities and relationships and no
	// operation; rendering it with the operation-rule layout asked the reader for an operation that
	// does not exist. Sections a kind does not use are left out rather than shown empty.
	const describesEntities = d.entities !== undefined || d.relationships !== undefined;
	const scenarioLines = scenarios?.trim() ? scenarioSection(scenarios) : [];
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
		`# ${d.requirementId} — Structured Intent review`,
		'',
		`Status: ${status}`,
		'',
		`_Generated view — do not edit. What you confirm is ${d.requirementId}.intent.json; this page only shows it in plain language. Items marked ⚠ need your attention._`,
		'',
		'## Kind',
		'',
		d.kind ? `${SYS_INTENT_KIND_LABEL[d.kind]} — ⚠ model’s classification, please check` : `${SYS_INTENT_KIND_LABEL.OPERATION_RULE} — recorded before kinds existed`,
		'',
		capability ? formalizationNote(capability) ?? 'A Formal Spec can be generated from this intent once it is confirmed.' : 'What can be formalized for this kind could not be read from sys-core.',
		'',
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
