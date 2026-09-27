import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as project from '../sysProject.js';
import * as intent from '../sysFormalSpec.js';
import { EMPTY_PROJECT, addRequirement, loadProjectState, parseProject, removeRequirement, serializeProject, setPlatformRoot, titleOf } from '../sysProject.js';
import { SysLifecycle } from '../sysLifecycle.js';

const files = (m: Record<string, string>) => async (p: string) => m[p];
const A = '/a/.sys/project.json';

const lifecycle = (id: string, overrides: Partial<SysLifecycle> = {}): SysLifecycle => ({
	requirementId: id,
	requirement: { present: true, approved: false, identity: 'sha256:r' },
	formalSpec: { state: 'NOT_CREATED', identity: null },
	status: 'FORMAL_SPEC_NOT_CREATED',
	...overrides
});
// Approval and staleness come from sys-core; these tests only prove the editor renders what core says.
const core = (byId: Record<string, SysLifecycle | undefined> = {}) => async (id: string) => id in byId ? byId[id] : lifecycle(id);
const noCore = async () => undefined;

test('no .sys state -> NO_SYS_PROJECT_YET, never a fixture', async () => {
	assert.deepEqual(await loadProjectState(['/a'], files({}), core()), { kind: 'NO_SYS_PROJECT_YET' });
});

test('no workspace and multi-root are bounded states, not a guess', async () => {
	assert.equal((await loadProjectState([], files({}), core())).kind, 'NO_WORKSPACE');
	assert.equal((await loadProjectState(['/a', '/b'], files({}), core())).kind, 'UNSUPPORTED_MULTI_ROOT_WORKSPACE');
});

test('ids are sequential, stable and independent of text; removal never renumbers', () => {
	const p1 = addRequirement(EMPTY_PROJECT).project;
	const p2 = addRequirement(p1).project;
	assert.deepEqual(p2.requirements.map(r => r.id), ['REQ-001', 'REQ-002']);
	assert.equal(addRequirement(removeRequirement(p2, 'REQ-001')).id, 'REQ-003');
});

test('persist and reload: project.json + requirement file + core lifecycle give the same id, title and honest DRAFT status', async () => {
	const p = addRequirement(EMPTY_PROJECT).project;
	const state = await loadProjectState(['/a'], files({ [A]: serializeProject(p), '/a/.sys/requirements/REQ-001.md': '# A booking needs a seat\nmore' }), core());
	assert.deepEqual(state, { kind: 'READY', project: p, rows: [{ id: 'REQ-001', title: 'A booking needs a seat', status: 'DRAFT_UNFORMALIZED', missing: false, empty: false, formalSpecState: 'NOT_CREATED' }] });
});

test('workspace A state never appears in workspace B', async () => {
	const read = files({ [A]: serializeProject(addRequirement(EMPTY_PROJECT).project) });
	assert.equal((await loadProjectState(['/a'], read, core())).kind, 'READY');
	assert.deepEqual(await loadProjectState(['/b'], read, core()), { kind: 'NO_SYS_PROJECT_YET' });
});

test('every state on a row is exactly what sys-core reported', async () => {
	const p = addRequirement(EMPTY_PROJECT).project;
	const reported = lifecycle('REQ-001', { requirement: { present: true, approved: true, identity: 'sha256:r' }, formalSpec: { state: 'APPROVED', identity: 'sha256:i' } });
	const state = await loadProjectState(['/a'], files({ [A]: serializeProject(p), '/a/.sys/requirements/REQ-001.md': 'x' }), core({ 'REQ-001': reported }));
	const row = (state as { rows: Record<string, unknown>[] }).rows[0];
	assert.equal(row.status, 'APPROVED_UNFORMALIZED');
	assert.equal(row.formalSpecState, 'APPROVED');
});

test('approval fields left in project.json by older editors are ignored and dropped, never trusted', async () => {
	const legacy = JSON.stringify({ version: 1, requirements: [{ id: 'REQ-001', approvedText: 'x', approvedSpecText: 'spec', approvedSpecIntent: 'intent' }] });
	const parsed = parseProject(legacy);
	assert.deepEqual(parsed, { version: 1, requirements: [{ id: 'REQ-001' }] });
	const state = await loadProjectState(['/a'], files({ [A]: legacy, '/a/.sys/requirements/REQ-001.md': 'x' }), core());
	assert.equal((state as { rows: { status: string }[] }).rows[0].status, 'DRAFT_UNFORMALIZED', 'an editor-side approval must not count');
	assert.ok(!serializeProject(parsed as never).includes('approved'));
});

test('when sys-core cannot answer the row says so and invents no state', async () => {
	const p = addRequirement(EMPTY_PROJECT).project;
	const state = await loadProjectState(['/a'], files({ [A]: serializeProject(p), '/a/.sys/requirements/REQ-001.md': 'x' }), noCore);
	assert.deepEqual((state as { rows: unknown }).rows, [{ id: 'REQ-001', title: 'x', status: 'DRAFT_UNFORMALIZED', missing: false, empty: false, lifecycleUnavailable: true }]);
});

test('a requirement file deleted by hand is shown as missing, not hidden or approved', async () => {
	const p = addRequirement(EMPTY_PROJECT).project;
	const gone = lifecycle('REQ-001', { requirement: { present: false, approved: false, identity: null } });
	const state = await loadProjectState(['/a'], files({ [A]: serializeProject(p) }), core({ 'REQ-001': gone }));
	assert.deepEqual((state as { rows: unknown }).rows, [{ id: 'REQ-001', title: '(file missing)', status: 'DRAFT_UNFORMALIZED', missing: true, empty: false, formalSpecState: 'NOT_CREATED' }]);
});

test('titleOf uses the first non-empty line without markdown heading marks', () => {
	assert.equal(titleOf('\n\n## Seats\nbody'), 'Seats');
	assert.equal(titleOf('   '), '(empty)');
});

test('malformed state is MALFORMED_SYS_PROJECT, not empty, fixture or verified', async () => {
	for (const bad of ['{nope', '{"version":2,"requirements":[]}', '{"version":1,"requirements":[{"id":"x"}]}',
		'{"version":1,"requirements":[{"id":"REQ-001"},{"id":"REQ-001"}]}']) {
		assert.equal((await loadProjectState(['/a'], files({ [A]: bad }), core())).kind, 'MALFORMED_SYS_PROJECT', bad);
	}
	assert.ok('malformed' in (parseProject('{nope') as object));
});

test('I/O failure is IO_ERROR', async () => {
	assert.equal((await loadProjectState(['/a'], async () => { throw new Error('EACCES'); }, core())).kind, 'IO_ERROR');
});

test('platformRoot is workspace config, independent of requirements', () => {
	const p = setPlatformRoot(addRequirement(EMPTY_PROJECT).project, '/opt/sys-platform');
	assert.equal(p.platformRoot, '/opt/sys-platform');
	assert.equal(p.requirements.length, 1);
	assert.ok(!('platformRoot' in setPlatformRoot(p, undefined)));
});

test('a non-string platformRoot in a hand-edited file is MALFORMED_SYS_PROJECT', async () => {
	assert.equal((await loadProjectState(['/a'], files({ [A]: '{"version":1,"requirements":[],"platformRoot":7}' }), core())).kind, 'MALFORMED_SYS_PROJECT');
});


test('the editor keeps no lifecycle rules of its own: approval, staleness and generation gates live in sys-core', () => {
	// specFile and SYS_SPECS_DIR went with the frozen grammar, and hasSpec with them: the row no
	// longer reads a file per requirement to answer a question about an artifact that is gone.
	for (const gone of ['approveRequirement', 'statusOf', 'structuredIntentFile', 'SYS_INTENTS_DIR', 'specFile', 'SYS_SPECS_DIR']) {
		assert.ok(!(gone in project), `sysProject still exports ${gone}`);
	}
	for (const gone of ['formalSpecState', 'approveFormalSpec', 'formalSpecState', 'canGenerateFormalSpec', 'formalizationCapability']) {
		assert.ok(!(gone in intent), `sysFormalSpec still exports ${gone}`);
	}
});

// A requirement created but not yet written has nothing to normalize or approve. Offering those
// actions leads straight to "Save the raw requirement before normalizing intent."
test('a requirement with no text yet is marked empty', async () => {
	const project = { version: 1 as const, requirements: [{ id: 'REQ-001' }] };
	const state = await loadProjectState(['file:///w'], async path =>
		path.endsWith('project.json') ? JSON.stringify(project) : path.endsWith('REQ-001.md') ? '   \n\n' : undefined,
		async () => undefined);
	const row = (state as { rows: { empty: boolean; missing: boolean; title: string }[] }).rows[0];
	assert.equal(row.empty, true);
	assert.equal(row.missing, false, 'the file exists, it is just blank');
	assert.equal(row.title, '(empty)');
});

test('a requirement with text is not empty', async () => {
	const project = { version: 1 as const, requirements: [{ id: 'REQ-001' }] };
	const state = await loadProjectState(['file:///w'], async path =>
		path.endsWith('project.json') ? JSON.stringify(project) : path.endsWith('REQ-001.md') ? 'A booking needs a seat' : undefined,
		async () => undefined);
	assert.equal((state as { rows: { empty: boolean }[] }).rows[0].empty, false);
});
