import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_PROJECT, SysProject, addRequirement, approveRequirement, loadProjectState, parseProject, serializeProject } from '../sysProject.js';

const files = (m: Record<string, string>) => async (p: string) => m[p];

test('no .sys state -> NO_SYS_PROJECT_YET, never a fixture', async () => {
	assert.deepEqual(await loadProjectState(['/a'], files({})), { kind: 'NO_SYS_PROJECT_YET' });
});

test('no workspace and multi-root are bounded states, not a guess', async () => {
	assert.equal((await loadProjectState([], files({}))).kind, 'NO_WORKSPACE');
	assert.equal((await loadProjectState(['/a', '/b'], files({}))).kind, 'UNSUPPORTED_MULTI_ROOT_WORKSPACE');
});

test('creating requirements: sequential stable ids, honest status, faithful text', () => {
	const p1 = addRequirement(EMPTY_PROJECT, '  A booking request must contain at least one seat.  ');
	assert.deepEqual(p1.requirements, [{ id: 'REQ-001', text: 'A booking request must contain at least one seat.', status: 'DRAFT_UNFORMALIZED' }]);
	assert.equal(addRequirement(p1, 'second').requirements[1].id, 'REQ-002');
	assert.throws(() => addRequirement(EMPTY_PROJECT, '   '));
});

test('persist and reload keeps text and stable id', async () => {
	const saved = serializeProject(addRequirement(EMPTY_PROJECT, 'x'));
	const state = await loadProjectState(['/a'], files({ '/a/.sys/project.json': saved }));
	assert.deepEqual(state, { kind: 'READY', project: { version: 1, requirements: [{ id: 'REQ-001', text: 'x', status: 'DRAFT_UNFORMALIZED' }] } });
	const again = addRequirement((state as { project: SysProject }).project, 'y');
	assert.deepEqual(again.requirements.map(r => r.id), ['REQ-001', 'REQ-002']);
});

test('workspace A state never appears in workspace B', async () => {
	const read = files({ '/a/.sys/project.json': serializeProject(addRequirement(EMPTY_PROJECT, 'only in A')) });
	assert.equal((await loadProjectState(['/a'], read)).kind, 'READY');
	assert.deepEqual(await loadProjectState(['/b'], read), { kind: 'NO_SYS_PROJECT_YET' });
});

test('approval is explicit and stays unformalized', () => {
	const p = approveRequirement(addRequirement(EMPTY_PROJECT, 'x'), 'REQ-001');
	assert.equal(p.requirements[0].status, 'APPROVED_UNFORMALIZED');
	assert.throws(() => approveRequirement(p, 'REQ-999'));
});

test('malformed state is MALFORMED_SYS_PROJECT, not empty, fixture or verified', async () => {
	for (const bad of ['{nope', '{"version":2,"requirements":[]}', '{"version":1,"requirements":[{"id":"REQ-001"}]}',
		'{"version":1,"requirements":[{"id":"R","text":"a","status":"SYNCED"}]}',
		'{"version":1,"requirements":[{"id":"R","text":"a","status":"DRAFT_UNFORMALIZED"},{"id":"R","text":"b","status":"DRAFT_UNFORMALIZED"}]}']) {
		assert.equal(parseProject(bad).kind, 'MALFORMED_SYS_PROJECT', bad);
	}
});

test('I/O failure is IO_ERROR', async () => {
	const state = await loadProjectState(['/a'], async () => { throw new Error('EACCES'); });
	assert.equal(state.kind, 'IO_ERROR');
});
