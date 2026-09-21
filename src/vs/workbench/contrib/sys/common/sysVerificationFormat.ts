/**
 * Deterministic formatters for structured verification.v0.1 objects.
 *
 * Every function switches on a contract `kind` tag and reads only fields the platform sent.
 * Anything unrecognised throws Unformattable; callers turn that into a bounded raw-JSON view.
 * Formatting is presentation only: no meaning is derived, no field is guessed.
 */

type Obj = Record<string, unknown>;

export class Unformattable extends Error { }

const DEBUG_JSON_LIMIT = 400;

export function boundedJson(value: unknown): string {
	const text = JSON.stringify(value) ?? 'undefined';
	return text.length > DEBUG_JSON_LIMIT ? `${text.slice(0, DEBUG_JSON_LIMIT)}…` : text;
}

function no(what: string, value: unknown): never {
	throw new Unformattable(`${what}: ${boundedJson(value)}`);
}

function o(value: unknown, what: string): Obj {
	return (typeof value === 'object' && value !== null && !Array.isArray(value)) ? value as Obj : no(what, value);
}

function s(value: unknown, what: string): string {
	return typeof value === 'string' ? value : no(what, value);
}

function a(value: unknown, what: string): unknown[] {
	return Array.isArray(value) ? value : no(what, value);
}

/** receiver.property; a null/absent part is simply omitted (the platform sends property:null). */
function ref(receiver: unknown, property: unknown): string {
	return [receiver, property].filter(part => typeof part === 'string' && part).join('.');
}

const ORDERED_OPS: Readonly<Record<string, string>> = { LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
const COMPARISON_OPS: Readonly<Record<string, string>> = { IS: '==', IS_NOT: '!=' };

/** Operand of COMPARE / ATOM value. */
function formatOperand(node: unknown): string {
	const n = o(node, 'operand');
	switch (n.kind) {
		case 'PROPERTY': return ref(n.receiver, n.property);
		case 'CONSTANT': return s(n.value, 'constant value');
		case 'ENUM_LITERAL': return `${s(n.enum_type, 'enum_type')}.${s(n.member, 'member')}`;
		default: return no('unsupported operand kind', node);
	}
}

/** Semantic-object data → expression text. Nested OR/AND keep explicit grouping. */
export function formatSemanticExpression(data: unknown, provenance: string, nested = false): string {
	const n = o(data, 'semantic data');
	switch (n.kind) {
		case 'DISTINCT_BY':
			return `DistinctBy(${ref(n.collection, n.property)}, by=[${a(n.by, 'by').map(String).join(', ')}])`;
		case 'EXISTS_DUPLICATE_BY':
			return `ExistsDuplicateBy(${ref(n.collection, n.property)}, by=[${a(n.by, 'by').map(String).join(', ')}])`;
		case 'COLLECTION_EMPTINESS': {
			const base = `isEmpty(${ref(n.collection, n.property)})`;
			return n.comparison === 'IS' ? base : n.comparison === 'IS_NOT' ? `not ${base}` : no('emptiness comparison', n.comparison);
		}
		case 'OR':
		case 'AND': {
			const text = a(n.terms, 'terms').map(t => formatSemanticExpression(t, provenance, true)).join(` ${n.kind} `);
			return nested ? `(${text})` : text;
		}
		case 'UNKNOWN':
			return 'UNKNOWN';
		case 'COMPARE': {
			const op = ORDERED_OPS[s(n.op, 'compare op')] ?? no('unsupported compare operator', n.op);
			return `${formatOperand(n.left)} ${op} ${formatOperand(n.right)}`;
		}
		case 'ATOM': {
			const op = COMPARISON_OPS[s(n.comparison, 'atom comparison')] ?? no('unsupported atom comparison', n.comparison);
			const value = o(n.value, 'atom value');
			const rhs = value.reference !== undefined
				? (() => { const r = o(value.reference, 'atom reference'); return ref(r.receiver, r.property); })()
				: no('unsupported atom value', n.value);
			return `${ref(n.receiver, n.property)} ${op} ${rhs}`;
		}
		case 'FAILURE':
			return `Failure(${s(n.type, 'failure type')})`;
		case 'EFFECTS': {
			const effects = a(n.data ?? n.effects, 'effects').map(e => formatSemanticExpression(e, provenance));
			return effects.length ? `Effects[\n${effects.map(e => `  ${e}`).join('\n')}\n]` : 'Effects[]';
		}
		case 'STATE_MUTATION': {
			const value = o(n.value, 'mutation value');
			const rhs = value.kind === 'ENUM_LITERAL' || value.kind === 'PROPERTY' || value.kind === 'CONSTANT' ? formatOperand(value) : no('unsupported mutation value', value);
			return `${ref(n.receiver, n.property)} ${provenance === 'SPECIFIED' ? 'becomes' : '='} ${rhs}`;
		}
		default:
			return no('unsupported semantic kind', n.kind);
	}
}

// ---- EXISTS_WITNESS ---------------------------------------------------------------------------

/** Structural binder identity: operation + scope + ordinal. displayName is presentation only. */
function binderKey(binder: unknown): string {
	const b = o(binder, 'binder');
	return `${s(b.operation, 'binder.operation')}|${a(b.scope, 'binder.scope').join('.')}|${b.ordinal}`;
}

function formatWitnessExpr(node: unknown, names: ReadonlyMap<string, string>): string {
	const n = o(node, 'witness expression');
	switch (n.kind) {
		case 'literal': return s(n.value, 'literal value');
		case 'parameter': return s(n.name, 'parameter name');
		case 'cardinality': return `|${formatWitnessExpr(n.collection, names)}|`;
		case 'add': return `${formatWitnessExpr(n.left, names)} + ${formatWitnessExpr(n.right, names)}`;
		case 'ref': {
			const key = binderKey(n.binder);
			return names.get(key) ?? `<unresolved binder ${key}>`;
		}
		case 'indexedaccess': return `${formatWitnessExpr(n.collection, names)}[${formatWitnessExpr(n.index, names)}]`;
		case 'property': return `${formatWitnessExpr(n.receiver, names)}.${s(n.property, 'property')}`;
		case 'equal': return `${formatWitnessExpr(n.left, names)} == ${formatWitnessExpr(n.right, names)}`;
		default: return no('unsupported witness expression kind', n.kind);
	}
}

/** One EXISTS_WITNESS entry → display lines. Binder references resolve by structural binderKey only. */
export function formatExistsWitness(witness: unknown): string[] {
	const w = o(witness, 'witness');
	const names = new Map<string, string>();
	const lines = ['ExistsWitness'];
	for (const entry of a(w.binders, 'binders')) {
		const e = o(entry, 'binder entry');
		const b = o(e.binder, 'binder');
		names.set(binderKey(b), s(b.display_name, 'binder.display_name'));
		const d = o(e.domain, 'binder domain');
		if (d.kind !== 'range') {
			no('unsupported domain kind', d.kind);
		}
		const step = o(d.step, 'range step');
		const stepText = step.kind === 'literal' && step.value === '1' ? '' : `, step ${formatWitnessExpr(step, names)}`;
		lines.push(`${b.display_name} ∈ [${formatWitnessExpr(d.start, names)}, ${formatWitnessExpr(d.end_exclusive, names)})${stepText}`);
	}
	lines.push(formatWitnessExpr(w.predicate, names));
	const exit = o(o(w.evidence, 'witness evidence').exit, 'witness exit');
	if (exit.kind !== 'return') {
		no('unsupported exit kind', exit.kind);
	}
	lines.push(`Return(${formatWitnessExpr(exit.value, names)})`);
	lines.push(`provenance = ${s(w.provenance, 'witness provenance')}`, `completeness = ${s(w.completeness, 'witness completeness')}`);
	return lines;
}

// ---- proof ------------------------------------------------------------------------------------

function objectExpression(view: unknown): string {
	const v = o(view, 'proof side');
	return formatSemanticExpression(v.data, s(v.provenance, 'proof side provenance'));
}

/** Proof object → display lines. VIOLATION_EQUIVALENCE keeps its polarity: violation(G) <=> R, never G == R. */
export function formatProof(proof: unknown): string[] {
	const p = o(proof, 'proof');
	if (p.kind !== 'RELATIONAL_EQUIVALENCE') {
		no('unsupported proof kind', p.kind);
	}
	const relation = s(p.relation, 'proof relation');
	if (relation !== 'VIOLATION_EQUIVALENCE') {
		no('unsupported proof relation', relation);
	}
	return [
		`${p.kind} / ${relation}`,
		`violation(${objectExpression(p.governed)}) <=> ${objectExpression(p.recovered)}`,
		`result = ${s(p.result, 'proof result')}`,
		...a(p.obligations, 'proof obligations').map(ob => `obligation: ${s(ob, 'proof obligation')}`)
	];
}

/** Same as formatProof but never throws: unknown proofs stay bounded and explicit. */
export function formatProofSafe(proof: unknown): string[] {
	try {
		return formatProof(proof);
	} catch (e) {
		return [`Unsupported proof — ${e instanceof Unformattable ? e.message : String(e)}`];
	}
}

export function formatWitnessesSafe(witnesses: unknown): string[] {
	return a(witnesses, 'witnesses').flatMap(w => {
		try {
			return formatExistsWitness(w);
		} catch (e) {
			return [`Unsupported evidence — ${e instanceof Unformattable ? e.message : String(e)}`];
		}
	});
}
