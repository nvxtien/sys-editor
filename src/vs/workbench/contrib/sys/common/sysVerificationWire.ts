/**
 * verification.v0.1 wire decoder + adapter into the UI-facing VerificationProject.
 *
 * sys-platform is the semantic authority. This module only validates structure, checks the
 * schema version, and formats structured semantic objects deterministically by their `kind`
 * field. It never parses prose, never derives a verdict, and never special-cases a rule.
 */

import { Unformattable, boundedJson, formatProofSafe, formatSemanticExpression, formatWitnessesSafe } from './sysVerificationFormat.js';
import {
	VerificationAnchor,
	VerificationDisposition,
	VerificationObligation,
	VerificationProject,
	VerificationProvenance,
	VerificationRule,
	VerificationSemanticView
} from './sysVerification.js';

export const SUPPORTED_VERIFICATION_SCHEMA = 'verification.v0.1';

/** Infrastructure/contract failures. Never a semantic disposition. */
export type VerificationErrorCode =
	| 'CONFIG_MISSING'
	| 'EXECUTABLE_NOT_FOUND'
	| 'MANIFEST_NOT_FOUND'
	| 'PLATFORM_EXECUTION_ERROR'
	| 'INVALID_JSON'
	| 'UNSUPPORTED_SCHEMA_VERSION'
	| 'MALFORMED_CONTRACT'
	| 'EMPTY_RULE_SET'
	| 'TIMEOUT'
	| 'CANCELLED';

export class VerificationTransportError extends Error {
	constructor(readonly code: VerificationErrorCode, message: string) {
		super(message);
		this.name = 'VerificationTransportError';
	}
}

const WIRE_DISPOSITIONS: ReadonlySet<string> = new Set(['SYNCED', 'DRIFTED', 'CONFLICTED', 'PARTIAL', 'NOT_OBSERVED', 'UNSUPPORTED']);
const PROVENANCES: ReadonlySet<string> = new Set(['SPECIFIED', 'OBSERVED', 'DERIVED', 'INFERRED']);

type Obj = Record<string, unknown>;

function malformed(path: string, expected: string): never {
	throw new VerificationTransportError('MALFORMED_CONTRACT', `${path}: expected ${expected}`);
}

function obj(value: unknown, path: string): Obj {
	return (typeof value === 'object' && value !== null && !Array.isArray(value)) ? value as Obj : malformed(path, 'object');
}

function str(value: unknown, path: string): string {
	return typeof value === 'string' ? value : malformed(path, 'string');
}

function optStr(value: unknown, path: string): string | undefined {
	return value === undefined || value === null ? undefined : str(value, path);
}

function arr(value: unknown, path: string): unknown[] {
	return Array.isArray(value) ? value : malformed(path, 'array');
}

function disposition(value: unknown, path: string): VerificationDisposition {
	const s = str(value, path);
	return WIRE_DISPOSITIONS.has(s) ? s as VerificationDisposition : malformed(path, `one of ${[...WIRE_DISPOSITIONS].join('|')}, got "${s}"`);
}

function semanticView(value: unknown, path: string): VerificationSemanticView | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}
	const o = obj(value, path);
	const kind = str(o.kind, `${path}.kind`);
	const provenance = str(o.provenance, `${path}.provenance`);
	if (!PROVENANCES.has(provenance)) {
		malformed(`${path}.provenance`, 'SPECIFIED|OBSERVED|DERIVED|INFERRED');
	}
	// data is any JSON value: the platform sends arrays for multi-effect objects
	if (o.data === undefined || o.data === null) {
		malformed(`${path}.data`, 'JSON value');
	}
	const data = o.data;
	const completeness = str(o.completeness, `${path}.completeness`);
	let expression: string | undefined;
	let why = '';
	try {
		// arrays are multi-effect payloads: format them as an EFFECTS object of the declared kind
		expression = formatSemanticExpression(Array.isArray(data) ? { kind, data } : data, provenance);
	} catch (e) {
		why = e instanceof Unformattable ? ` (${e.message})` : '';
	}
	return {
		kind,
		data,
		completeness,
		provenance: provenance as VerificationProvenance,
		expression,
		summary: optStr(o.summary, `${path}.summary`)
			?? (expression ? kind : `Unsupported semantic kind "${kind}"${why} — structured data preserved, meaning not interpreted`),
		// unknown kinds expose bounded debug JSON instead of an inferred meaning
		evidence: expression ? undefined : [boundedJson(data)]
	};
}

function anchor(value: unknown, path: string): VerificationAnchor {
	const o = obj(value, path);
	const kind = str(o.kind, `${path}.kind`);
	if (kind !== 'SOURCE' && kind !== 'SPEC') {
		malformed(`${path}.kind`, 'SOURCE|SPEC');
	}
	return {
		kind,
		label: str(o.label, `${path}.label`),
		file: optStr(o.file ?? o.uri, `${path}.file`),
		symbol: optStr(o.symbol, `${path}.symbol`),
		range: optStr(o.range, `${path}.range`)
	};
}

function reasons(value: unknown, path: string): string[] {
	return arr(value, path).map((r, i) => {
		const o = obj(r, `${path}[${i}]`);
		const code = str(o.code, `${path}[${i}].code`);
		const message = optStr(o.message, `${path}[${i}].message`);
		return message ? `${code}: ${message}` : code;
	});
}

/** Structured evidence entries → bounded, kind-tagged lines. No interpretation. */
function evidence(value: unknown, path: string): string[] {
	return arr(value, path).map((e, i) => {
		const o = obj(e, `${path}[${i}]`);
		return `${str(o.kind, `${path}[${i}].kind`)}: ${boundedJson(o.data)}`;
	});
}

function obligation(value: unknown, path: string): VerificationObligation {
	const o = obj(value, path);
	return {
		id: str(o.id, `${path}.id`),
		kind: str(o.kind, `${path}.kind`),
		disposition: disposition(o.disposition, `${path}.disposition`),
		governed: semanticView(o.governed, `${path}.governed`),
		recovered: semanticView(o.recovered, `${path}.recovered`),
		reasons: reasons(o.reasons ?? [], `${path}.reasons`),
		evidence: evidence(o.evidence ?? [], `${path}.evidence`),
		proof: o.proof === undefined || o.proof === null ? undefined : formatProofSafe(o.proof),
		anchors: arr(o.anchors ?? [], `${path}.anchors`).map((a, i) => anchor(a, `${path}.anchors[${i}]`))
	};
}

/** Witnesses ride on the rule-level recovered behavior object under the contract key `witnesses`. */
function ruleEvidence(recovered: unknown): string[] | undefined {
	const data = (recovered as { data?: { witnesses?: unknown } } | undefined)?.data;
	return data && !Array.isArray(data) && data.witnesses !== undefined ? formatWitnessesSafe(data.witnesses) : undefined;
}

function rule(value: unknown, path: string): VerificationRule {
	const o = obj(value, path);
	const id = str(o.id, `${path}.id`);
	return {
		id,
		title: optStr(o.title, `${path}.title`) ?? id,
		evidence: ruleEvidence(o.recovered),
		aggregateDisposition: disposition(o.aggregateDisposition, `${path}.aggregateDisposition`),
		obligations: arr(o.obligations, `${path}.obligations`).map((ob, i) => obligation(ob, `${path}.obligations[${i}]`))
	};
}

/** Decode raw platform stdout. Throws VerificationTransportError; never returns a partial project. */
export function decodeVerificationV01(stdout: string): VerificationProject {
	let json: unknown;
	try {
		json = JSON.parse(stdout);
	} catch (e) {
		throw new VerificationTransportError('INVALID_JSON', `stdout is not valid JSON: ${(e as Error).message}`);
	}
	const root = obj(json, '$');
	if (root.schemaVersion !== SUPPORTED_VERIFICATION_SCHEMA) {
		throw new VerificationTransportError('UNSUPPORTED_SCHEMA_VERSION', `expected ${SUPPORTED_VERIFICATION_SCHEMA}, got ${boundedJson(root.schemaVersion)}`);
	}
	const rules = arr(root.rules, '$.rules').map((r, i) => rule(r, `$.rules[${i}]`));
	if (!rules.length) {
		throw new VerificationTransportError('EMPTY_RULE_SET', 'platform returned no rules');
	}
	return { projectId: str(root.projectId, '$.projectId'), contractStatus: 'READY', dataSource: 'LIVE', rules };
}
