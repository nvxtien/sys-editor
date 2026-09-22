import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickStableSelection } from '../sysVerification.js';
import { decodeVerificationV01, isNoVerificationRun, VerificationTransportError } from '../sysVerificationWire.js';
import { loadLiveVerification, VerificationTransport } from '../sysVerificationLive.js';

const here = dirname(fileURLToPath(import.meta.url));
const golden = readFileSync(join(here, 'verification-v0.1.cinema.json'), 'utf8');
const project = decodeVerificationV01(golden);
const rule = (id: string) => project.rules.find(r => r.id === id)!;
const ob = (ruleId: string, kind: string) => rule(ruleId).obligations.find(o => o.kind === kind)!;
const cfg = { platformBinary: '/bin/scs', manifestPath: '/m.json', timeoutMs: 1000 };
const transport = (over: Partial<VerificationTransport> & { stdout?: string; exitCode?: number | null; stderr?: string } = {}): VerificationTransport => ({
	exists: over.exists ?? (async () => true),
	run: over.run ?? (async () => ({ exitCode: over.exitCode ?? 0, stdout: over.stdout ?? golden, stderr: over.stderr ?? '' }))
});
const code = async (p: Promise<unknown>) => p.then(() => 'NO_ERROR', e => (e as VerificationTransportError).code ?? String(e));

test('decodes verification.v0.1 and marks the data source LIVE', () => {
	assert.equal(project.projectId, 'cinema-booking');
	assert.equal(project.dataSource, 'LIVE');
});

test('B1/B3/B2/state-effect aggregates are SYNCED from the live contract; B8 is CONFLICTED', () => {
	for (const id of ['B1', 'B3', 'B2', 'STATE_EFFECT']) {
		assert.equal(rule(id).aggregateDisposition, 'SYNCED', id);
	}
	assert.equal(rule('B8').aggregateDisposition, 'CONFLICTED');
});

test('B2 governed DISTINCT_BY and recovered EXISTS_DUPLICATE_BY keep structure', () => {
	const g = ob('B2', 'guard').governed!;
	const r = ob('B2', 'guard').recovered!;
	assert.equal(g.kind, 'DISTINCT_BY');
	assert.equal(g.provenance, 'SPECIFIED');
	assert.equal(g.expression, 'DistinctBy(requested.seats, by=[id])');
	assert.equal(r.kind, 'EXISTS_DUPLICATE_BY');
	assert.equal(r.provenance, 'DERIVED');
	assert.equal(r.expression, 'ExistsDuplicateBy(requestedSeats, by=[id])');
	assert.equal(r.completeness, 'EXACT');
});

test('B2 full live evidence maps into the UI contract from structured fields', () => {
	assert.deepEqual(rule('B2').evidence, [
		'ExistsWitness',
		'i ∈ [0, |requestedSeats|)',
		'j ∈ [i + 1, |requestedSeats|)',
		'requestedSeats[i].id == requestedSeats[j].id',
		'Return(true)',
		'provenance = DERIVED',
		'completeness = EXACT'
	]);
	assert.deepEqual(ob('B2', 'guard').proof, [
		'RELATIONAL_EQUIVALENCE / VIOLATION_EQUIVALENCE',
		'violation(DistinctBy(requested.seats, by=[id])) <=> ExistsDuplicateBy(requestedSeats, by=[id])',
		'result = PROVEN',
		'obligation: SAME_COLLECTION', 'obligation: SAME_PROJECTION', 'obligation: PAIRWISE_DOMAIN',
		'obligation: EQUALITY_PREDICATE', 'obligation: CORRECT_POLARITY', 'obligation: COMPATIBLE_FAILURE_EFFECT'
	]);
});

test('supported live kinds never fall back to "Unsupported semantic kind" (B1)', () => {
	for (const o of rule('B1').obligations) {
		for (const v of [o.governed, o.recovered]) {
			assert.ok(v!.expression !== undefined, `${o.id} ${v!.kind}`);
			assert.doesNotMatch(v!.summary, /Unsupported/);
		}
	}
	assert.equal(ob('B1', 'guard').governed!.expression, 'isEmpty(requested.seats)');
	assert.equal(ob('B1', 'guard').recovered!.expression, 'UNKNOWN OR isEmpty(requestedSeats)');
	assert.equal(ob('B1', 'effects').governed!.expression, 'Failure(com.example.cinema.BookingRejectedException)');
});

test('B8 values come straight from the live contract (no expected effect encoded)', () => {
	const doc = JSON.parse(golden);
	const wire = doc.rules.find((r: { id: string }) => r.id === 'B8');
	assert.equal(rule('B8').aggregateDisposition, wire.aggregateDisposition);
	assert.deepEqual(rule('B8').obligations.map(o => o.disposition), wire.obligations.map((o: { disposition: string }) => o.disposition));
	assert.equal(ob('B8', 'guard').governed!.expression, 'seat.hall name != showtime.hall name');
});

test('state/effect maps structured STATE_MUTATION for both sides', () => {
	const e = ob('STATE_EFFECT', 'effects');
	assert.equal(e.governed!.expression, 'booking.status becomes BookingStatus.CONFIRMED');
	assert.equal(e.recovered!.expression, 'booking.status = BookingStatus.CONFIRMED');
});

test('B8 guard keeps NOT_OBSERVED + WRONG_OPERATION_SCOPE reason; aggregate is not green', () => {
	const guard = ob('B8', 'guard');
	assert.equal(guard.disposition, 'NOT_OBSERVED');
	assert.deepEqual(guard.reasons, ['WRONG_OPERATION_SCOPE']);
	assert.notEqual(rule('B8').aggregateDisposition, 'SYNCED');
});

test('stable rule and obligation ids are preserved verbatim', () => {
	assert.deepEqual(project.rules.map(r => r.id).sort(), ['B1', 'B2', 'B3', 'B8', 'STATE_EFFECT']);
	assert.deepEqual(rule('B8').obligations.map(o => o.id), ['B8:guard', 'B8:effects']);
});

test('source and spec anchors survive mapping', () => {
	const anchors = ob('B1', 'guard').anchors;
	const src = anchors.find(a => a.kind === 'SOURCE')!;
	const spec = anchors.find(a => a.kind === 'SPEC')!;
	assert.ok(src.file!.endsWith('BookingService.java'));
	assert.equal(src.symbol, 'createBooking');
	assert.ok(spec.file!.endsWith('b1.spec'));
});

test('unknown semantic kind stays structured and bounded, without a crash', () => {
	const doc = JSON.parse(golden);
	doc.rules[0].obligations[0].governed = { kind: 'FUTURE_KIND', data: { x: 'y'.repeat(2000) }, provenance: 'SPECIFIED', completeness: 'EXACT' };
	const view = decodeVerificationV01(JSON.stringify(doc)).rules[0].obligations[0].governed!;
	assert.equal(view.kind, 'FUTURE_KIND');
	assert.equal(view.expression, undefined);
	assert.match(view.summary, /Unsupported semantic kind "FUTURE_KIND"/);
	assert.ok(view.evidence![0].length <= 401);
});

test('unsupported / missing schema version is an explicit error', () => {
	assert.throws(() => decodeVerificationV01(JSON.stringify({ schemaVersion: 'verification.v0.2', projectId: 'p', rules: [] })), { code: 'UNSUPPORTED_SCHEMA_VERSION' });
	assert.throws(() => decodeVerificationV01('{"projectId":"p","rules":[]}'), { code: 'UNSUPPORTED_SCHEMA_VERSION' });
});

test('invalid JSON, malformed fields, unknown disposition and empty rules each have a distinct error', () => {
	assert.throws(() => decodeVerificationV01('not json'), { code: 'INVALID_JSON' });
	assert.throws(() => decodeVerificationV01('{"schemaVersion":"verification.v0.1","projectId":"p"}'), { code: 'MALFORMED_CONTRACT' });
	const bad = JSON.parse(golden);
	bad.rules[0].aggregateDisposition = 'GREEN';
	assert.throws(() => decodeVerificationV01(JSON.stringify(bad)), { code: 'MALFORMED_CONTRACT' });
	assert.throws(() => decodeVerificationV01('{"schemaVersion":"verification.v0.1","projectId":"p","rules":[]}'), { code: 'EMPTY_RULE_SET' });
});

test('additive unknown JSON fields are ignored', () => {
	const doc = JSON.parse(golden);
	doc.futureTopLevel = 1;
	doc.rules[0].futureField = { a: 1 };
	assert.equal(decodeVerificationV01(JSON.stringify(doc)).rules.length, 5);
});

test('non-zero exit, missing manifest and missing config are transport errors, never dispositions', async () => {
	assert.equal(await code(loadLiveVerification(transport({ exitCode: 1, stderr: 'boom' }), cfg)), 'PLATFORM_EXECUTION_ERROR');
	assert.equal(await code(loadLiveVerification(transport({ exists: async () => false }), cfg)), 'MANIFEST_NOT_FOUND');
	assert.equal(await code(loadLiveVerification(transport(), { ...cfg, platformBinary: '' })), 'CONFIG_MISSING');
	assert.equal(await code(loadLiveVerification(transport({ stdout: 'oops' }), cfg)), 'INVALID_JSON');
});

test('an untouched workspace is empty, while actual configuration errors remain errors', () => {
	assert.equal(isNoVerificationRun(new VerificationTransportError('NO_VERIFICATION_RUN', '')), true);
	assert.equal(isNoVerificationRun(new VerificationTransportError('CONFIG_MISSING', '')), false);
});

test('unknown proof and evidence kinds stay bounded', () => {
	const doc = JSON.parse(golden);
	const b2 = doc.rules.find((r: { id: string }) => r.id === 'B2');
	b2.obligations[0].proof.kind = 'FUTURE_PROOF';
	b2.recovered.data.witnesses[0].binders[0].domain.kind = 'set';
	const live = decodeVerificationV01(JSON.stringify(doc)).rules.find(r => r.id === 'B2')!;
	assert.match(live.obligations[0].proof![0], /^Unsupported proof/);
	assert.match(live.evidence![0], /^Unsupported evidence/);
	assert.ok(live.evidence![0].length < 600);
});

test('a failing live run never falls back to fixture data', async () => {
	const failing = transport({ run: async () => { throw new VerificationTransportError('EXECUTABLE_NOT_FOUND', 'nope'); } });
	const result = await loadLiveVerification(failing, cfg).then(p => p, e => e);
	assert.ok(result instanceof VerificationTransportError);
	assert.equal((result as { rules?: unknown }).rules, undefined);
});

test('live CLI transport receives the selected project root as cwd', async () => {
	let seenCwd: string | undefined;
	const config = { ...cfg, cwd: '/project root' } as typeof cfg & { cwd: string };
	const withCwd = transport({ run: async (...args: unknown[]) => {
		seenCwd = args[3] as string | undefined;
		return { exitCode: 0, stdout: golden, stderr: '' };
	} });
	await loadLiveVerification(withCwd, config);
	assert.equal(seenCwd, '/project root');
});

test('the transport is invoked with an argument array (no shell string)', async () => {
	let seen: [string, string[]] | undefined;
	await loadLiveVerification(transport({ run: async (c, a) => { seen = [c, a]; return { exitCode: 0, stdout: golden, stderr: '' }; } }), cfg);
	assert.deepEqual(seen, ['/bin/scs', ['verification-v0.1', '/m.json']]);
});

test('refresh keeps rule and obligation selection by stable id, and drops vanished ids', () => {
	assert.equal(pickStableSelection(project.rules, 'B8'), 'B8');
	assert.equal(pickStableSelection(project.rules, 'B8:guard'), 'B8:guard');
	assert.equal(pickStableSelection(project.rules, 'Requested seats distinct by Seat.id'), undefined);
	assert.equal(pickStableSelection(project.rules.filter(r => r.id !== 'B8'), 'B8'), undefined);
});

test('live adapter sources contain no domain-specific branch or prose inference', () => {
	for (const f of ['../sysVerificationWire.ts', '../sysVerificationLive.ts', '../../browser/sysVerificationProviderService.ts']) {
		const src = readFileSync(join(here, f), 'utf8')
			.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
			.replace(/^.*CINEMA_BOOKING_VERIFICATION_PROJECT.*$/gm, ''); // explicit fixture mode is the only allowed reference
		assert.doesNotMatch(src, /Booking|Cinema|Seat|['"]B[0-9]+['"]/i, f);
		assert.doesNotMatch(src, /\.(match|includes|startsWith)\(.*(title|summary|why)/, f);
	}
});

// Real platform probe: set SYS_SPEC_CODE_SYNC_BIN and SYS_VERIFICATION_MANIFEST to run it.
const bin = process.env.SYS_SPEC_CODE_SYNC_BIN;
const manifest = process.env.SYS_VERIFICATION_MANIFEST;
test('real Cinema Booking probe: platform stdout decodes to the UI contract', { skip: !bin || !manifest }, () => {
	const live = decodeVerificationV01(execFileSync(bin!, ['verification-v0.1', manifest!], { encoding: 'utf8', maxBuffer: 1 << 26 }));
	const agg = Object.fromEntries(live.rules.map(r => [r.id, r.aggregateDisposition]));
	assert.deepEqual(agg, { B1: 'SYNCED', B2: 'SYNCED', B3: 'SYNCED', B8: 'CONFLICTED', STATE_EFFECT: 'SYNCED' });
	const b8 = live.rules.find(r => r.id === 'B8')!;
	assert.equal(b8.obligations.find(o => o.kind === 'guard')!.disposition, 'NOT_OBSERVED');
	assert.deepEqual(b8.obligations.find(o => o.kind === 'guard')!.reasons, ['WRONG_OPERATION_SCOPE']);
});

const decodedAnchors = () => project.rules.flatMap(r => r.obligations.flatMap(o => o.anchors ?? []));

test('decoder keeps the observed span on SOURCE anchors only', () => {
	const anchors = decodedAnchors();
	assert.ok(anchors.length > 0);
	const source = anchors.filter(a => a.kind === 'SOURCE');
	const spec = anchors.filter(a => a.kind === 'SPEC');
	assert.ok(source.length > 0 && source.every(a => a.span !== undefined), 'every SOURCE anchor of the golden has a span');
	assert.ok(spec.every(a => a.span === undefined), 'SPEC anchors have no span');
	const span = source[0].span!;
	assert.deepEqual([span.startLine, span.startColumn, span.endLine, span.endColumn], [29, 5, 55, 6]);
	assert.match(span.sourceDigest, /^sha256:[0-9a-f]{64}$/);
});

const withSpan = (mutate: (span: Record<string, unknown>) => void) => {
	const doc = JSON.parse(golden);
	const anchor = doc.rules[1].obligations[0].anchors.find((a: { kind: string }) => a.kind === 'SOURCE');
	mutate(anchor.span);
	return decodeVerificationV01(JSON.stringify(doc)).rules[1].obligations[0].anchors!.find(a => a.kind === 'SOURCE')!;
};

test('a malformed span is dropped, the anchor and the rest of the contract survive', () => {
	const bad: Array<[string, (s: Record<string, unknown>) => void]> = [
		['string offset', s => { s.startOffset = '863'; }],
		['fractional line', s => { s.startLine = 29.5; }],
		['zero line', s => { s.startLine = 0; }],
		['zero column', s => { s.startColumn = 0; }],
		['negative offset', s => { s.startOffset = -1; }],
		['inverted offsets', s => { s.endOffset = 1; }],
		['end line before start', s => { s.endLine = 3; }],
		['end column before start on one line', s => { s.endLine = 29; s.endColumn = 1; }],
		['missing digest', s => { delete s.sourceDigest; }],
		['bad digest', s => { s.sourceDigest = 'forged'; }],
		['missing field', s => { delete s.endColumn; }]
	];
	for (const [name, mutate] of bad) {
		const anchor = withSpan(mutate);
		assert.equal(anchor.span, undefined, name);
		assert.ok(anchor.file && anchor.symbol === 'createBooking', `${name}: anchor is still usable`);
	}
	const doc = JSON.parse(golden);
	doc.rules[1].obligations[0].anchors[0].span = 'not an object';
	assert.equal(decodeVerificationV01(JSON.stringify(doc)).rules.length, 5, 'contract survives a non-object span');
});
