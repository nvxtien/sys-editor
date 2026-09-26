import { expect, test } from 'playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// A harness for the buttons themselves, not for the source text behind them. Every bug this
// session — a dead New requirement, a lifecycle action on an empty file, a deleted requirement
// whose intent came back — was invisible to tests that grep the view and visible in one click.
const port = process.env.SYS_LIVE_SERVER_PORT;
const platformRoot = process.env.SYS_PLATFORM_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../sys-platform');
const sysCore = path.join(platformRoot, 'sys-core', 'target', 'debug', 'sys-core');

test.skip(!port, 'set SYS_LIVE_SERVER_PORT to the running sidex-server port');
test.setTimeout(120_000);

const REQUIREMENT = 'A booking request must contain at least one seat.\n';

function emptyWorkspace() {
	const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sys-lifecycle-'));
	const root = path.join(base, 'dev', 'app');
	fs.mkdirSync(path.join(root, '.sys', 'requirements'), { recursive: true });
	fs.writeFileSync(path.join(root, '.sys', 'project.json'), JSON.stringify({ version: 1, requirements: [] }));
	fs.symlinkSync(platformRoot, path.join(base, 'dev', 'sys-platform'));
	return root;
}

const core = (root, args) => execFileSync(sysCore, args, { cwd: root, encoding: 'utf8' });
const ids = root => JSON.parse(fs.readFileSync(path.join(root, '.sys', 'project.json'), 'utf8')).requirements.map(r => r.id);

async function openWorkbench(page, root) {
	// Without these, a rejected promise inside the view is invisible and the action just looks hung.
	page.on('pageerror', error => console.log('[page error]', error.message));
	page.on('console', message => {
		const text = message.text();
		if (/\[DBG\]|SYS_ACTION|sys-core|cannot load|access control/i.test(text)) {
			console.log('[page]', text.slice(0, 200));
		}
	});
	const seen = new Set();
	await page.exposeFunction('__sysFs', async (command, args) => {
		if (!seen.has(command)) { seen.add(command); }
		const p = args.path ?? args.filePath;
		const stat = () => {
			const s = fs.statSync(p);
			return { is_dir: s.isDirectory(), is_file: s.isFile(), is_symlink: false, size: s.size, modified: 0, created: 0, readonly: false };
		};
		switch (command) {
			case 'read_file': return fs.readFileSync(p, 'utf8');
			case 'read_file_bytes': return Array.from(fs.readFileSync(p));
			case 'write_file': fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, args.contents ?? args.content ?? ''); return null;
			case 'write_file_bytes': fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.from(args.contents ?? args.content)); return null;
			case 'mkdir': fs.mkdirSync(p, { recursive: true }); return null;
			case 'exists': return fs.existsSync(p);
			case 'stat': return stat();
			// The real command is `remove`; a missing case here leaves the promise unresolved and the
			// action hangs, which is indistinguishable from a bug in the app.
			case 'remove': fs.rmSync(p, { force: true, recursive: args.recursive ?? false }); return null;
			case 'rename': fs.renameSync(p, args.newPath ?? args.to); return null;
			case 'copy_file': fs.copyFileSync(p, args.newPath ?? args.to); return null;
			case 'read_dir': return fs.readdirSync(p).map(name => ({ name, is_dir: fs.statSync(path.join(p, name)).isDirectory() }));
			default:
				// Editor plumbing (watchers, profiles, telemetry) is fine to no-op. A *file* command
				// we do not implement is not: returning null leaves the caller waiting forever, which
				// looks exactly like a bug in the app.
				// Only the workspace file commands matter here. Editor plumbing (profiles, user-data,
				// watchers, telemetry) is fine to no-op; failing it just fills the log with noise.
				if (['read_file', 'read_file_bytes', 'write_file', 'write_file_bytes', 'remove', 'rename', 'copy_file', 'mkdir', 'stat', 'exists', 'read_dir'].includes(command)) {
					throw new Error(`harness has no case for file command "${command}"`);
				}
				return null;
		}
	});
	await page.addInitScript(({ serverPort }) => {
		window.__SIDEX_TAURI__ = true;
		window.__TAURI_INTERNALS__ = {
			invoke: async (command, args = {}) => {
				const name = String(command).split('|').pop();
				if (name === 'server_endpoint') {
					return { wsUrl: `ws://127.0.0.1:${serverPort}`, httpUrl: `http://127.0.0.1:${serverPort}`, port: serverPort, running: true };
				}
				if (name === 'settings_get') { return {}; }
				if (name.startsWith('theme_')) { return name === 'theme_list' ? [] : {}; }
				if (name === 'search_files' || name === 'search_text') { return []; }
				return window.__sysFs(name, args);
			},
			transformCallback: () => 1,
			metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } }
		};
	}, { serverPort: Number(port) });
	// The server accepts http://localhost:1420, not http://127.0.0.1:1420 — different origins to a
	// browser. Going through localhost keeps the harness inside the origin list instead of widening
	// it, which would loosen a loopback-only server for the sake of a test.
	await page.goto(`http://localhost:1420/?folder=${encodeURIComponent('file://' + root)}`);
	await page.locator('[aria-label="Sys"]').first().click();
	const workbench = page.locator('.sys-semantic-workbench').first();
	await expect(workbench).toContainText('Requirements', { timeout: 30_000 });
	return workbench;
}

test('New requirement creates one, and it is offered no lifecycle action until it has text', async ({ page }) => {
	const root = emptyWorkspace();
	const workbench = await openWorkbench(page, root);

	await workbench.getByRole('button', { name: 'New requirement' }).click();
	await expect.poll(() => ids(root), { timeout: 15_000 }).toEqual(['REQ-001']);
	await expect(workbench).toContainText('REQ-001');

	// Nothing to normalize or approve in a blank file: offering it leads straight to an error.
	await expect(workbench.getByRole('button', { name: 'Normalize intent' })).toHaveCount(0);
	await expect(workbench).toContainText('Write the requirement in the editor');

	fs.writeFileSync(path.join(root, '.sys', 'requirements', 'REQ-001.md'), REQUIREMENT);
	await expect(workbench.getByRole('button', { name: 'Normalize intent' })).toHaveCount(1, { timeout: 15_000 });
});

test('a deleted requirement leaves nothing behind for the next one to inherit', async ({ page }) => {
	const root = emptyWorkspace();
	const workbench = await openWorkbench(page, root);

	await workbench.getByRole('button', { name: 'New requirement' }).click();
	await expect.poll(() => ids(root), { timeout: 15_000 }).toEqual(['REQ-001']);
	fs.writeFileSync(path.join(root, '.sys', 'requirements', 'REQ-001.md'), REQUIREMENT);

	// Give it an intent through sys-core, the same state a real normalize would leave.
	core(root, ['requirement', 'save', 'REQ-001']);
	execFileSync(sysCore, ['intent', 'accept', 'REQ-001'], {
		cwd: root, encoding: 'utf8',
		input: JSON.stringify({ version: 1, requirementId: 'REQ-001', kind: 'OPERATION_RULE', intentStatement: { value: 'x', provenance: 'SPECIFIED' }, scope: { value: 'x', provenance: 'SPECIFIED' }, operation: { value: 'create booking', provenance: 'SPECIFIED' }, inputs: [], constraints: [], effects: [], failureBehavior: [], unknowns: [] })
	});
	expect(fs.existsSync(path.join(root, '.sys', 'core', 'intents', 'REQ-001.json'))).toBe(true);

	await workbench.getByRole('button', { name: 'Delete' }).first().click();
	await expect.poll(() => ids(root), { timeout: 15_000 }).toEqual([]);

	// The whole point: ids are reused, so anything left here comes back on the next requirement.
	for (const leftover of ['core/intents/REQ-001.json', 'core/requirements/REQ-001.json', 'requirements/REQ-001.md']) {
		expect(fs.existsSync(path.join(root, '.sys', leftover)), `${leftover} survived the delete`).toBe(false);
	}

	await workbench.getByRole('button', { name: 'New requirement' }).click();
	await expect.poll(() => ids(root), { timeout: 15_000 }).toEqual(['REQ-001']);
	// A fresh REQ-001 has no intent, so it is offered normalization, never confirmation.
	await expect(workbench.getByRole('button', { name: 'Confirm intent' })).toHaveCount(0);
});
