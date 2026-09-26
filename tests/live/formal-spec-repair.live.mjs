// Live check of the Formal Spec repair loop: the editor's real orchestrator (bundled from
// sysFormalSpecRepair.ts) against a real sidex-server + provider and the real `sys` CLI as the judge.
//
//   SYS_LIVE_SERVER_PORT=<port of the running sidex-server> node tests/live/formal-spec-repair.live.mjs
//   optional: MODELS=a,b  RUNS=2  SYS_PLATFORM_ROOT=../sys-platform  REQUIREMENT="..."
//
// Needs a sidex-server built from this checkout (it must know `repair`) with a connected provider,
// and `cargo build --manifest-path <platform>/product-cli/Cargo.toml` + sys-core built.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const port = process.env.SYS_LIVE_SERVER_PORT;
if (!port) { console.error('set SYS_LIVE_SERVER_PORT to the running sidex-server port'); process.exit(2); }
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const platformRoot = path.resolve(process.env.SYS_PLATFORM_ROOT ?? path.join(repo, '../sys-platform'));
const sys = path.join(platformRoot, 'product-cli/target/debug/sys');
const models = (process.env.MODELS ?? 'anthropic/claude-sonnet-4.6,anthropic/claude-haiku-4-5-20251001').split(',');
const runs = Number(process.env.RUNS ?? 2);
const REQUIREMENT = process.env.REQUIREMENT ?? 'Creating a Book must be rejected when its category does not exist. A Book must belong to exactly one Category. On success the Book is stored with its category_id.\n';
for (const needed of [sys, path.join(platformRoot, 'sys-core/target/debug/sys-core')]) {
	if (!fs.existsSync(needed)) { console.error(`missing ${needed}; build it first`); process.exit(2); }
}

const bundle = path.join(os.tmpdir(), `sys-repair-${process.pid}.mjs`);
execFileSync('npx', ['esbuild', path.join(repo, 'src/vs/workbench/contrib/sys/common/sysFormalSpecRepair.ts'), '--bundle', '--format=esm', `--outfile=${bundle}`, '--log-level=error'], { cwd: repo });
const { draftFormalSpecWithRepair } = await import(pathToFileURL(bundle).href);

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sys-repair-live-'));
const proj = path.join(base, 'dev', 'proj');
fs.mkdirSync(proj, { recursive: true });
fs.symlinkSync(platformRoot, path.join(base, 'dev', 'sys-platform'));
const run = (command, args) => { const r = spawnSync(command, args, { cwd: proj, encoding: 'utf8' }); if (r.status !== 0) { throw new Error(`${command} ${args.join(' ')}: ${r.stderr || r.stdout}`); } return r.stdout; };
run(sys, ['init', '.']);
fs.mkdirSync(path.join(proj, '.sys', 'requirements'), { recursive: true });
const requirementFile = path.join(proj, '.sys', 'requirements', 'REQ-001.md');
fs.writeFileSync(requirementFile, REQUIREMENT);

const post = async (route, body) => {
	const response = await fetch(`http://127.0.0.1:${port}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
	const text = await response.text();
	if (!response.ok) { throw new Error(`${route} ${response.status}: ${text}`); }
	return text;
};
const core = (args, input) => post('/v1/sys/core', { workspace: proj, args, ...(input === undefined ? {} : { input }) });

const fact = (value, provenance = 'SPECIFIED') => ({ value, provenance });
await core(['requirement', 'save', 'REQ-001'], REQUIREMENT);
await core(['intent', 'accept', 'REQ-001'], JSON.stringify({
	version: 1, requirementId: 'REQ-001', kind: 'OPERATION_RULE',
	intentStatement: fact('Creating a Book is rejected when its category does not exist.'), scope: fact('Book creation', 'DERIVED'),
	operation: fact('BookService.createBook', 'OBSERVED'),
	inputs: [fact('category_id')], constraints: [fact('A Book must belong to exactly one existing Category.')], effects: [fact('The Book is stored with its category_id.', 'DERIVED')],
	failureBehavior: [fact('Reject the creation when the category does not exist.')], unknowns: ['exception type']
}));
await core(['intent', 'approve-current', 'REQ-001']);
const context = await core(['spec', 'prepare', 'REQ-001']);

let accepted = 0;
let total = 0;
for (const model of models) {
	for (let n = 1; n <= runs; n++) {
		total++;
		const attempts = [];
		try {
			const { result, attempts: used } = await draftFormalSpecWithRepair({
				request: async repair => JSON.parse(await post('/v1/sys/draft-spec', { model, intent: context, ...(repair ? { repair } : {}) })).draftSpec,
				validate: async draft => {
					const candidate = path.join(proj, `candidate-${Date.now()}.spec`);
					fs.writeFileSync(candidate, draft);
					const r = spawnSync(sys, ['requirement', '--file', requirementFile, '--draft-file', candidate, '--draft-only', '--json'], { cwd: proj, encoding: 'utf8' });
					fs.rmSync(candidate, { force: true });
					if (r.status !== 0) { throw new Error((r.stderr || r.stdout).trim()); }
					return JSON.parse(r.stdout);
				},
				onAttempt: a => attempts.push(`${a.attempt}:${a.outcome}${a.reason ? ' (' + a.reason.split('\n').filter(Boolean).pop() + ')' : ''}`)
			});
			accepted++;
			console.log(`ACCEPTED  ${model} run ${n}: ${used} attempt(s)  [${attempts.join(' -> ')}]\n${result.draftSpec.trim().split('\n').map(l => '    ' + l).join('\n')}`);
		} catch (error) {
			console.log(`REJECTED  ${model} run ${n}: [${attempts.join(' -> ')}]\n    ${String(error.message).split('\n').filter(Boolean).slice(-2).join(' | ')}`);
		}
	}
}
fs.rmSync(base, { recursive: true, force: true });
fs.rmSync(bundle, { force: true });
console.log(`\n${accepted}/${total} runs ended with a platform-validated draft`);
process.exit(accepted === total ? 0 : 1);
