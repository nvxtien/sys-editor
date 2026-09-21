import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_PROJECT, addRequirement, approveRequirement, loadProjectState, parseProject, removeRequirement, serializeProject, statusOf, titleOf } from '../sysProject.js';

const files = (m: Record<string, string>) => async (p: string) => m[p];
const A = '/a/.sys/project.json';

test('no .sys state -> NO_SYS_PROJECT_YET, never a fixture', async () => {
	assert.deepEqual(await loadProjectState(['/a'], files({})), { kind: 'NO_SYS_PROJECT_YET' });
});

test('no workspace and multi-root are bounded states, not a guess', async () => {
	assert.equal((await loadProjectState([], files({}))).kind, 'NO_WORKSPACE');
	assert.equal((await loadProjectState(['/a', '/b'], files({}))).kind, 'UNSUPPORTED_MULTI_ROOT_WORKSPACE');
});

test('ids are sequential, stable and independent of text; removal never renumbers', () => {
	const p1 = addRequirement(EMPTY_PROJECT).project;
	const p2 = addRequirement(p1).project;
	assert.deepEqual(p2.requirements.map(r => r.id), ['REQ-001', 'REQ-002']);
	assert.equal(addRequirement(removeRequirement(p2, 'REQ-001')).id, 'REQ-003');
});

test('persist and reload: project.json + requirement file give the same id, title and honest DRAFT status', async () => {
	const project = addRequirement(EMPTY_PROJECT).project;
	const state = await loadProjectState(['/a'], files({ [A]: serializeProject(project), '/a/.sys/requirements/REQ-001.md': '# A booking needs a seat\nmore' }));
	assert.deepEqual(state, { kind: 'READY', project, rows: [{ id: 'REQ-001', title: 'A booking needs a seat', status: 'DRAFT_UNFORMALIZED', missing: false }] });
});

test('workspace A state never appears in workspace B', async () => {
	const read = files({ [A]: serializeProject(addRequirement(EMPTY_PROJECT).project) });
	assert.equal((await loadProjectState(['/a'], read)).kind, 'READY');
	assert.deepEqual(await loadProjectState(['/b'], read), { kind: 'NO_SYS_PROJECT_YET' });
});

test('approval is explicit, applies to the exact text, and is void once the text changes', () => {
	const p = approveRequirement(addRequirement(EMPTY_PROJECT).project, 'REQ-001', 'seat required');
	const ref = p.requirements[0];
	assert.equal(statusOf(ref, 'seat required'), 'APPROVED_UNFORMALIZED');
	assert.equal(statusOf(ref, 'seat required!'), 'DRAFT_UNFORMALIZED');
	assert.equal(statusOf(ref, undefined), 'DRAFT_UNFORMALIZED');
	assert.throws(() => approveRequirement(p, 'REQ-999', 'x'));
	assert.throws(() => approveRequirement(p, 'REQ-001', '  '));
});

test('a requirement file deleted by hand is shown as missing, not hidden or approved', async () => {
	const p = approveRequirement(addRequirement(EMPTY_PROJECT).project, 'REQ-001', 'x');
	const state = await loadProjectState(['/a'], files({ [A]: serializeProject(p) }));
	assert.deepEqual((state as { rows: unknown }).rows, [{ id: 'REQ-001', title: '(file missing)', status: 'DRAFT_UNFORMALIZED', missing: true }]);
});

test('titleOf uses the first non-empty line without markdown heading marks', () => {
	assert.equal(titleOf('\n\n## Seats\nbody'), 'Seats');
	assert.equal(titleOf('   '), '(empty)');
});

test('malformed state is MALFORMED_SYS_PROJECT, not empty, fixture or verified', async () => {
	for (const bad of ['{nope', '{"version":2,"requirements":[]}', '{"version":1,"requirements":[{"id":"x"}]}',
		'{"version":1,"requirements":[{"id":"REQ-001"},{"id":"REQ-001"}]}']) {
		assert.equal((await loadProjectState(['/a'], files({ [A]: bad }))).kind, 'MALFORMED_SYS_PROJECT', bad);
	}
	assert.ok('malformed' in (parseProject('{nope') as object));
});

test('I/O failure is IO_ERROR', async () => {
	assert.equal((await loadProjectState(['/a'], async () => { throw new Error('EACCES'); })).kind, 'IO_ERROR');
});
