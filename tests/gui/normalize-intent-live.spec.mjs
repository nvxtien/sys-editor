import { expect, test } from 'playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Live test: real workbench bundle, real sidex-server (dynamic port), real provider, real files on disk.
// Only the Tauri IPC file commands are bridged to node:fs. Run with:
//   SYS_LIVE_SERVER_PORT=<port of the running sidex-server> npx playwright test normalize-intent-live
const port = process.env.SYS_LIVE_SERVER_PORT;
const platformRoot = process.env.SYS_PLATFORM_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../sys-platform');
const REQUIREMENT = 'A booking request must contain at least one seat.\n';

test.skip(!port, 'set SYS_LIVE_SERVER_PORT to the running sidex-server port');
test.setTimeout(120_000);

function makeWorkspace(requirement = REQUIREMENT) {
	const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sys-live-'));
	const root = path.join(base, 'dev', 'app');
	fs.mkdirSync(path.join(root, '.sys', 'requirements'), { recursive: true });
	fs.writeFileSync(path.join(root, '.sys', 'project.json'), JSON.stringify({ version: 1, requirements: [{ id: 'REQ-001' }] }));
	fs.writeFileSync(path.join(root, '.sys', 'requirements', 'REQ-001.md'), requirement);
	fs.symlinkSync(platformRoot, path.join(base, 'dev', 'sys-platform'));
	return root;
}

async function freePort() {
	const server = net.createServer();
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address();
	await new Promise(resolve => server.close(resolve));
	return port;
}

async function openWorkbench(page, root, model, serverPort = port, staleFirstPort = undefined) {
	const unknown = [];
	await page.exposeFunction('__sysFs', async (command, args) => {
		const p = args.path ?? args.filePath;
		const stat = () => {
			const s = fs.statSync(p);
			return { size: s.size, is_dir: s.isDirectory(), is_file: s.isFile(), is_symlink: false, modified: Math.floor(s.mtimeMs), created: Math.floor(s.birthtimeMs), readonly: false };
		};
		switch (command) {
			case 'read_file': return fs.readFileSync(p, 'utf8');
			case 'read_file_bytes': return Array.from(fs.readFileSync(p));
			case 'write_file': fs.writeFileSync(p, args.content ?? args.contents ?? ''); return null;
			case 'write_file_bytes': fs.writeFileSync(p, Buffer.from(args.contents ?? args.content)); return null;
			case 'stat': return stat();
			case 'exists': return fs.existsSync(p);
			case 'mkdir': fs.mkdirSync(p, { recursive: true }); return null;
			case 'remove': fs.rmSync(p, { recursive: true, force: true }); return null;
			case 'rename': fs.renameSync(args.oldPath ?? args.old_path, args.newPath ?? args.new_path); return null;
			case 'read_dir': return fs.readdirSync(p, { withFileTypes: true }).map(e => ({ name: e.name, path: path.join(p, e.name), is_dir: e.isDirectory(), is_file: e.isFile(), is_symlink: false, size: 0, modified: 0 }));
			default: unknown.push(command); return undefined;
		}
	});
	await page.addInitScript(({ model, port, staleFirstPort }) => {
		window.__endpointCalls = 0;
		try { localStorage.setItem('sidex.selectedModel', model); } catch { /* storage unavailable */ }
		const FS = new Set(['read_file', 'read_file_bytes', 'write_file', 'write_file_bytes', 'stat', 'exists', 'mkdir', 'remove', 'rename', 'read_dir']);
		window.__SIDEX_TAURI__ = true;
		window.__TAURI_INTERNALS__ = {
			invoke: async (command, args = {}) => {
				const name = String(command).split('|').pop();
				if (FS.has(name)) { return window.__sysFs(name, args); }
				if (name === 'server_endpoint') {
					const answer = window.__endpointCalls++ === 0 && staleFirstPort ? staleFirstPort : port;
					return { wsUrl: `ws://127.0.0.1:${answer}`, httpUrl: `http://127.0.0.1:${answer}`, port: Number(answer), running: true };
				}
				if (name === 'settings_get') { return {}; }
				if (name.startsWith('theme_')) { return name === 'theme_list' ? [] : {}; }
				if (name === 'search_files' || name === 'search_text') { return []; }
				return null;
			},
			transformCallback: () => 1,
			metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } }
		};
	}, { model, port: serverPort, staleFirstPort });
	await page.goto(`http://localhost:1420/?folder=${encodeURIComponent('file://' + root)}`);
	await page.locator('[aria-label="Sys"]').first().click();
	const workbench = page.locator('.sys-semantic-workbench').first();
	await expect(workbench).toContainText('REQ-001', { timeout: 30_000 });
	return { workbench, unknown };
}

test('Normalize intent reaches the real server on its dynamic port, saves and refreshes the row', async ({ page }) => {
	const root = makeWorkspace();
	const traces = [];
	page.on('console', message => { if (message.text().includes('[SYS_NORMALIZE_INTENT]')) { traces.push(message.text()); } });
	const { workbench } = await openWorkbench(page, root, 'anthropic/claude-haiku-4-5-20251001');
	const normalizeRequest = page.waitForRequest(r => r.url().endsWith('/v1/sys/normalize-intent'), { timeout: 60_000 });
	const normalizeResponse = page.waitForResponse(r => r.url().endsWith('/v1/sys/normalize-intent'), { timeout: 100_000 });

	await workbench.getByRole('button', { name: 'Normalize intent' }).click();

	const request = await normalizeRequest;
	expect(new URL(request.url()).port).toBe(port);
	expect(new URL(request.url()).port).not.toBe('7433');
	expect(JSON.parse(request.postData()).intent).toContain('A booking request must contain at least one seat.');
	const response = await normalizeResponse;
	expect(response.status()).toBe(200);
	const requestId = JSON.parse(request.postData()).requestId;
	expect(requestId).toMatch(/^sys-/);
	expect(Object.keys(request.headers()).filter(name => name.startsWith('x-sys'))).toEqual([]);
	expect(response.headers()['x-sys-request-id']).toBe(requestId);

	await expect.poll(async () => (await coreJson(root, ['lifecycle', 'REQ-001'])).structuredIntent.state, { timeout: 15_000 }).toBe('DRAFT');
	const saved = await coreJson(root, ['intent', 'show', 'REQ-001']);
	expect(saved.draft.requirementId).toBe('REQ-001');
	expect(fs.readFileSync(path.join(root, '.sys', 'requirements', 'REQ-001.md'), 'utf8')).toBe(REQUIREMENT);
	expect(fs.existsSync(path.join(root, '.sys', 'intents', 'REQ-001.intent.json')), 'the editor keeps no intent file of its own').toBe(false);
	await expect(workbench).toContainText('Review intent', { timeout: 15_000 });
	await expect(workbench).toContainText('Confirm intent');
	await expect(workbench.getByRole('button', { name: 'Normalize intent' })).toHaveCount(0);
	// The reviewer sees plain language, not JSON: Normalize opens the generated review page.
	const reviewFile = path.join(root, '.sys', 'intents', 'REQ-001.intent.review.md');
	await expect.poll(() => fs.existsSync(reviewFile)).toBe(true);
	const review = fs.readFileSync(reviewFile, 'utf8');
	expect(review).toContain('## Inputs');
	expect(review).toContain('Generated view — do not edit');
	expect(review).toContain('> A booking request must contain at least one seat.');
	expect(review).not.toMatch(/^\s*[{}]/m);
	await expect(page.getByRole('tab', { name: /REQ-001\.intent\.review\.md/ })).toBeVisible({ timeout: 15_000 });
	const stages = traces.filter(line => line.includes(`id=${requestId}`)).map(line => line.match(/stage=(\w+)/)[1]);
	expect(stages).toEqual(['click', 'prepared', 'request_sent', 'response', 'parsed', 'saved', 'ui_refresh']);
});

// Needs a server with no provider credentials (an isolated sidex-server run with a scratch HOME), so the failure is real.
test('Normalize intent shows a clear error and saves nothing when the provider is not connected', async ({ page }) => {
	test.skip(!process.env.SYS_LIVE_ISOLATED_SERVER, 'set SYS_LIVE_ISOLATED_SERVER=1 when the server has no provider credentials');
	const root = makeWorkspace();
	const { workbench } = await openWorkbench(page, root, 'openai/gpt-4o-mini');

	await workbench.getByRole('button', { name: 'Normalize intent' }).click();

	await expect(workbench).toContainText('Normalize intent failed', { timeout: 30_000 });
	await expect(workbench).toContainText('not connected');
	expect((await coreJson(root, ['lifecycle', 'REQ-001'])).structuredIntent.state, 'nothing may be saved when the provider fails').toBe('NOT_CREATED');
	await expect(workbench.getByRole('button', { name: 'Normalize intent' })).toHaveCount(1);
});

// The supervisor restarts sidex-server on a NEW port after a crash or rebuild. The window
// memoized the first answer, so every request went to a dead port ("Load failed").
test('Normalize intent recovers when the server restarted on a new port after the window cached the old one', async ({ page }) => {
	const root = makeWorkspace();
	const stalePort = await freePort();
	const { workbench } = await openWorkbench(page, root, 'anthropic/claude-haiku-4-5-20251001', port, stalePort);

	await workbench.getByRole('button', { name: 'Normalize intent' }).click();

	await expect(workbench).toContainText('Review intent', { timeout: 60_000 });
	expect(fs.existsSync(path.join(root, '.sys', 'intents', 'REQ-001.intent.json'))).toBe(true);
	expect(await page.evaluate(() => window.__endpointCalls)).toBeGreaterThanOrEqual(2);
});

const fact = (value, provenance = 'SPECIFIED') => ({ value, provenance });
const UNBOUND = fact('UNKNOWN', 'UNKNOWN');
const BOUND = fact('BookService.createBook', 'OBSERVED');

function draftOf(kind, operation) {
	// Key order matches parseStructuredIntent, so approvedContent equals serializeStructuredIntent(draft).
	return { version: 1, requirementId: 'REQ-001', ...(kind ? { kind } : {}), intentStatement: fact('s'), scope: fact('s'), operation, inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: [] };
}

async function core(root, args, input) {
	const response = await fetch(`http://127.0.0.1:${port}/v1/sys/core`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: root, args, ...(input === undefined ? {} : { input }) }) });
	if (!response.ok) { throw new Error(`sys-core ${args.join(' ')} failed: ${await response.text()}`); }
	return response.text();
}

const coreJson = async (root, args) => JSON.parse(await core(root, args));

// The lifecycle lives only in sys-core; the editor keeps no approval state of its own to seed.
async function seedIntent(root, draft) {
	await core(root, ['requirement', 'save', 'REQ-001'], REQUIREMENT);
	await core(root, ['intent', 'accept', 'REQ-001'], JSON.stringify(draft));
}

async function seedApprovedIntent(root, kind, operation) {
	await seedIntent(root, draftOf(kind, operation));
	await core(root, ['intent', 'approve-current', 'REQ-001']);
}

const CASES = [
	{ name: 'DATA_MODEL is a platform gap, stated as one', kind: 'DATA_MODEL', operation: UNBOUND, generate: false, note: /PLATFORM_FORMAL_SPEC_GAP/ },
	{ name: 'RELATIONSHIP is a platform gap, stated as one', kind: 'RELATIONSHIP', operation: UNBOUND, generate: false, note: /PLATFORM_FORMAL_SPEC_GAP/ },
	{ name: 'OPERATION_RULE reaches Generate with no operation of its own', kind: 'OPERATION_RULE', operation: UNBOUND, generate: true, note: null },
	{ name: 'OPERATION_RULE reaches Generate with a semantic operation', kind: 'OPERATION_RULE', operation: BOUND, generate: true, note: null },
	{ name: 'a source-looking operation does not make a DATA_MODEL formalizable', kind: 'DATA_MODEL', operation: BOUND, generate: false, note: /PLATFORM_FORMAL_SPEC_GAP/ },
	{ name: 'UNKNOWN kind has nothing to formalize', kind: 'UNKNOWN', operation: UNBOUND, generate: false, note: /nothing to formalize yet/ },
	{ name: 'a record written before kinds existed keeps the operation-rule behavior', kind: undefined, operation: BOUND, generate: true, note: null }
];

for (const c of CASES) {
	test(`kind gating: ${c.name}`, async ({ page }) => {
		const root = makeWorkspace();
		await seedApprovedIntent(root, c.kind, c.operation);
		const { workbench } = await openWorkbench(page, root, 'anthropic/claude-haiku-4-5-20251001');
		await expect(workbench.getByRole('button', { name: 'Review intent' })).toHaveCount(1);
		await expect(workbench.getByRole('button', { name: 'Bind operation' })).toHaveCount(0);
		await expect(workbench.getByRole('button', { name: 'Generate Formal Spec' })).toHaveCount(c.generate ? 1 : 0);
		await expect(workbench).not.toContainText('bind its operation');
		if (c.note) { await expect(workbench).toContainText(c.note); } else { await expect(workbench).not.toContainText('PLATFORM_FORMAL_SPEC_GAP'); }
	});
}

test('a real provider classifies the Category/Book requirement as a non-operation kind and the UI never asks for an operation', async ({ page }) => {
	const dataModel = 'Data Model\n Relationship request\n  - each book belongs to exactly one category\n  - one category can contain multiple books\n\nClass\n Category\n  - id: INT\n  - category_name: string\n  - description: string\n\nClass\n Book\n  - id: INT\n  - title: string\n  - author: string\n  - publication_year: INT\n  - category_id: INT\n';
	const root = makeWorkspace(dataModel);
	const { workbench } = await openWorkbench(page, root, 'anthropic/claude-sonnet-4.6');
	await workbench.getByRole('button', { name: 'Normalize intent' }).click();
	await expect(workbench).toContainText('Confirm intent', { timeout: 100_000 });
	const saved = await coreJson(root, ['intent', 'show', 'REQ-001']);
	// Data model and relationship are both reasonable readings; an operation rule is not.
	expect(['DATA_MODEL', 'RELATIONSHIP']).toContain(saved.draft.kind);
	expect(fs.readFileSync(path.join(root, '.sys', 'intents', 'REQ-001.intent.review.md'), 'utf8')).toContain('— ⚠ model’s classification, please check');
	await expect(workbench.getByRole('button', { name: 'Bind operation' })).toHaveCount(0);
});

test('the GUI shows what sys-core says, not what stale editor-side files claim', async ({ page }) => {
	const root = makeWorkspace();
	await seedApprovedIntent(root, 'DATA_MODEL', BOUND);
	// Leftovers from an older editor: an intent file and project.json approvals that claim a formalizable operation rule.
	const claim = draftOf('OPERATION_RULE', BOUND);
	fs.mkdirSync(path.join(root, '.sys', 'intents'), { recursive: true });
	fs.writeFileSync(path.join(root, '.sys', 'intents', 'REQ-001.intent.json'), JSON.stringify({ sourceRequirement: REQUIREMENT, draft: claim, approvedContent: JSON.stringify(claim, null, 2) + '\n' }));
	fs.writeFileSync(path.join(root, '.sys', 'project.json'), JSON.stringify({ version: 1, requirements: [{ id: 'REQ-001', approvedText: REQUIREMENT, approvedSpecText: 'x', approvedSpecIntent: 'y' }] }));
	const { workbench } = await openWorkbench(page, root, 'anthropic/claude-haiku-4-5-20251001');
	await expect(workbench).toContainText('PLATFORM_FORMAL_SPEC_GAP', { timeout: 30_000 });
	await expect(workbench).toContainText('Draft · unformalized', { timeout: 30_000 });
	await expect(workbench.getByRole('button', { name: 'Generate Formal Spec' })).toHaveCount(0);
});

test('when sys-core cannot answer the GUI shows no lifecycle state and no lifecycle actions', async ({ page }) => {
	const root = makeWorkspace();
	const { workbench } = await openWorkbench(page, root, 'anthropic/claude-haiku-4-5-20251001', await freePort());
	await expect(workbench).toContainText('Lifecycle unavailable: sys-core did not answer', { timeout: 30_000 });
	for (const name of ['Normalize intent', 'Review intent', 'Confirm intent', 'Generate Formal Spec', 'Approve intent']) {
		await expect(workbench.getByRole('button', { name })).toHaveCount(0);
	}
});

test('an approval made through another client (the CLI adapter) is what the GUI shows', async ({ page, browser }) => {
	const root = makeWorkspace();
	await seedIntent(root, draftOf('OPERATION_RULE', BOUND));
	const first = await openWorkbench(page, root, 'anthropic/claude-haiku-4-5-20251001');
	await expect(first.workbench.getByRole('button', { name: 'Confirm intent' })).toHaveCount(1);
	await expect(first.workbench.getByRole('button', { name: 'Generate Formal Spec' })).toHaveCount(0);

	const identity = (await coreJson(root, ['intent', 'show', 'REQ-001'])).identity;
	await core(root, ['intent', 'approve-current', 'REQ-001']);
	expect((await coreJson(root, ['lifecycle', 'REQ-001'])).structuredIntent.identity).toBe(identity);

	const second = await openWorkbench(await (await browser.newContext()).newPage(), root, 'anthropic/claude-haiku-4-5-20251001');
	await expect(second.workbench.getByRole('button', { name: 'Generate Formal Spec' })).toHaveCount(1);
	await expect(second.workbench.getByRole('button', { name: 'Confirm intent' })).toHaveCount(0);
});

test('editing the requirement file makes the GUI show the approved intent as stale with no editor bookkeeping', async ({ page, browser }) => {
	const root = makeWorkspace();
	await seedApprovedIntent(root, 'OPERATION_RULE', BOUND);
	const before = await openWorkbench(page, root, 'anthropic/claude-haiku-4-5-20251001');
	await expect(before.workbench.getByRole('button', { name: 'Generate Formal Spec' })).toHaveCount(1);

	fs.writeFileSync(path.join(root, '.sys', 'requirements', 'REQ-001.md'), 'A booking request must contain at least two seats.\n');
	expect((await coreJson(root, ['lifecycle', 'REQ-001'])).structuredIntent.state).toBe('STALE');

	const after = await openWorkbench(await (await browser.newContext()).newPage(), root, 'anthropic/claude-haiku-4-5-20251001');
	await expect(after.workbench.getByRole('button', { name: 'Normalize intent' })).toHaveCount(1);
	await expect(after.workbench.getByRole('button', { name: 'Generate Formal Spec' })).toHaveCount(0);
});

test('Review intent renders the intent that sys-core holds, not an editor-side copy', async ({ page }) => {
	const root = makeWorkspace();
	await seedApprovedIntent(root, 'DATA_MODEL', UNBOUND);
	const { workbench } = await openWorkbench(page, root, 'anthropic/claude-haiku-4-5-20251001');
	await workbench.getByRole('button', { name: 'Review intent' }).click();
	const review = path.join(root, '.sys', 'intents', 'REQ-001.intent.review.md');
	await expect.poll(() => fs.existsSync(review), { timeout: 15_000 }).toBe(true);
	const text = fs.readFileSync(review, 'utf8');
	expect(text).toContain('Status: CONFIRMED');
	expect(text).toContain('Data model — ⚠ model’s classification, please check');
	expect(text).toContain('PLATFORM_FORMAL_SPEC_GAP');
});

test('Approve intent approves the exact requirement text in sys-core', async ({ page }) => {
	const root = makeWorkspace();
	await seedIntent(root, draftOf('OPERATION_RULE', BOUND));
	const { workbench } = await openWorkbench(page, root, 'anthropic/claude-haiku-4-5-20251001');
	await expect(workbench).toContainText('Draft · unformalized');
	await workbench.getByRole('button', { name: 'Approve intent' }).click();
	await expect(workbench).toContainText('Intent approved · unformalized', { timeout: 15_000 });
	const lifecycle = await coreJson(root, ['lifecycle', 'REQ-001']);
	expect(lifecycle.requirement.approved).toBe(true);
	expect(fs.existsSync(path.join(root, '.sys', 'core', 'requirements', 'REQ-001.json'))).toBe(true);
	expect(JSON.parse(fs.readFileSync(path.join(root, '.sys', 'project.json'), 'utf8')).requirements[0]).toEqual({ id: 'REQ-001' });
});

test('Confirm intent approves the exact reviewed identity in sys-core after an explicit dialog', async ({ page }) => {
	const root = makeWorkspace();
	await seedIntent(root, draftOf('OPERATION_RULE', BOUND));
	const shown = await coreJson(root, ['intent', 'show', 'REQ-001']);
	const { workbench } = await openWorkbench(page, root, 'anthropic/claude-haiku-4-5-20251001');
	await workbench.getByRole('button', { name: 'Confirm intent' }).click();
	await expect(page.locator('.monaco-dialog-box')).toContainText('Confirm this Structured Intent?');
	expect((await coreJson(root, ['lifecycle', 'REQ-001'])).structuredIntent.state, 'nothing is approved before the dialog is answered').toBe('DRAFT');
	await page.locator('.monaco-dialog-box').getByRole('button', { name: 'Confirm intent' }).click();
	await expect.poll(async () => (await coreJson(root, ['lifecycle', 'REQ-001'])).structuredIntent.state, { timeout: 15_000 }).toBe('APPROVED');
	expect((await coreJson(root, ['lifecycle', 'REQ-001'])).structuredIntent.identity).toBe(shown.identity);
	await expect(workbench.getByRole('button', { name: 'Generate Formal Spec' })).toHaveCount(1, { timeout: 15_000 });
});

test('the lifecycle never asks for a source identity', async ({ page }) => {
	const root = makeWorkspace();
	await seedApprovedIntent(root, 'OPERATION_RULE', BOUND);
	const { workbench } = await openWorkbench(page, root, 'anthropic/claude-haiku-4-5-20251001');
	await expect(workbench.getByRole('button', { name: 'Generate Formal Spec' })).toHaveCount(1, { timeout: 30_000 });
	await expect(workbench.getByRole('button', { name: 'Bind operation' })).toHaveCount(0);
	await expect(workbench.getByRole('button', { name: 'Approve spec & review code' })).toHaveCount(0);
	// A quick input would be the only way a Class.method could still be demanded.
	await expect(page.locator('.quick-input-widget:visible')).toHaveCount(0);
	await expect(workbench).not.toContainText('Class.method');
	await expect(workbench).not.toContainText('ClassName.methodName');
});
