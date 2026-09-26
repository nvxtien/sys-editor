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
	const calls = [];
	page.__calls = calls;
	await page.exposeFunction('__sysFs', async (command, args) => {
		const p0 = args.path ?? args.filePath ?? '';
		calls.push(`${Date.now() % 100000} ${command} ${String(p0).split('/').slice(-2).join('/')}`);
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

});

test('a requirement that already has text is offered normalization, and no guidance', async ({ page }) => {
	const root = emptyWorkspace();
	fs.writeFileSync(path.join(root, '.sys', 'project.json'), JSON.stringify({ version: 1, requirements: [{ id: 'REQ-001' }] }));
	fs.writeFileSync(path.join(root, '.sys', 'requirements', 'REQ-001.md'), REQUIREMENT);
	const workbench = await openWorkbench(page, root);

	await expect(workbench.getByRole('button', { name: 'Normalize intent' })).toHaveCount(1, { timeout: 20_000 });
	await expect(workbench).not.toContainText('Write the requirement in the editor');
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
	// Delete asks first. Without answering, the action waits forever and the button stays disabled —
	// which reads exactly like a hang, and cost a long detour to tell apart from one.
	const dialog = page.locator('.monaco-dialog-box');
	await expect(dialog).toBeVisible({ timeout: 10_000 });
	await expect(dialog).toContainText('Delete REQ-001?');
	await dialog.getByRole('button', { name: 'Delete' }).click();
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

const DATA_MODEL = `This requirement designs the data model.
It has two classes Category and Book.
Each book belongs to exactly one category.
One category can contain multiple books.

Category class has attributes:
  - id: INT
  - category_name: string
  - description: string

Book classes has attributes;
  - id: INT
  - title: string
  - author: string
  - publication_year: INT
  - category_id: INT
`;

// The whole normalize path, end to end, against a real provider: click the button, wait for the
// review page, and read what a reviewer would read. Source-text tests cannot see any of this.
test('Normalize intent classifies a data model and writes a review a person can read', async ({ page }) => {
	test.setTimeout(180_000);
	const root = emptyWorkspace();
	fs.writeFileSync(path.join(root, '.sys', 'project.json'), JSON.stringify({ version: 1, requirements: [{ id: 'REQ-001' }] }));
	fs.writeFileSync(path.join(root, '.sys', 'requirements', 'REQ-001.md'), DATA_MODEL);
	const workbench = await openWorkbench(page, root);

	await workbench.getByRole('button', { name: 'Normalize intent' }).click();
	// The button must say it is working; without that the click reads as a no-op.
	await expect(workbench.getByRole('button', { name: 'Normalize intent…' })).toHaveCount(1, { timeout: 5_000 });

	const review = path.join(root, '.sys', 'intents', 'REQ-001.intent.review.md');
	await expect.poll(() => fs.existsSync(review), { timeout: 150_000 }).toBe(true);
	const page_ = fs.readFileSync(review, 'utf8');

	// Classified from the facts, not from the word "data model" in the text.
	expect(page_).toContain('## Kind');
	expect(page_).toMatch(/Data model|Relationship/);

	// A data model states entities and relationships, not inputs and constraints.
	expect(page_).toContain('## Entities');
	expect(page_).toContain('Category');
	expect(page_).toContain('Book');
	expect(page_).not.toContain('## Inputs');
	expect(page_).not.toContain('## Operation');

	// Platform vocabulary does not belong in a page a person reads their requirement back from.
	expect(page_).not.toContain('PLATFORM_FORMAL_SPEC_GAP');
	expect(page_).not.toContain('nothing to formalize yet');
	expect(page_).not.toMatch(/not bound/i);

	// sys-core holds the intent, and the editor keeps no copy of its own.
	const shown = JSON.parse(core(root, ['intent', 'show', 'REQ-001']));
	expect(shown.draft.requirementId).toBe('REQ-001');
	expect(fs.existsSync(path.join(root, '.sys', 'intents', 'REQ-001.intent.json'))).toBe(false);

	// A data model cannot be formalized yet, so it is not offered generation.
	await expect(workbench.getByRole('button', { name: 'Confirm intent' })).toHaveCount(1, { timeout: 20_000 });
	await expect(workbench.getByRole('button', { name: 'Generate Formal Spec' })).toHaveCount(0);
});

const POM = `<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>app</artifactId>
  <version>1.0</version>
</project>
`;

const APP_JAVA = 'package com.example;\n\npublic class App {\n\tpublic static void main(String[] args) {}\n}\n';

function javaWorkspace() {
	const root = emptyWorkspace();
	fs.writeFileSync(path.join(root, 'pom.xml'), POM);
	fs.mkdirSync(path.join(root, 'src', 'main', 'java', 'com', 'example'), { recursive: true });
	fs.writeFileSync(path.join(root, 'src', 'main', 'java', 'com', 'example', 'App.java'), APP_JAVA);
	fs.writeFileSync(path.join(root, '.sys', 'project.json'), JSON.stringify({ version: 1, requirements: [{ id: 'REQ-001' }] }));
	fs.writeFileSync(path.join(root, '.sys', 'requirements', 'REQ-001.md'), DATA_MODEL);
	return root;
}

const javaFiles = root => {
	const dir = path.join(root, 'src', 'main', 'java', 'com', 'example');
	return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
};

async function confirmIntent(page, workbench) {
	const confirm = workbench.getByRole('button', { name: 'Confirm intent' });
	await expect(confirm).toHaveCount(1, { timeout: 180_000 });
	await confirm.click();
	const dialog = page.locator('.monaco-dialog-box');
	await expect(dialog).toBeVisible({ timeout: 10_000 });
	await dialog.getByRole('button', { name: 'Confirm intent' }).click();
}

/**
 * Confirming an intent records it as approved and then writes code for it into the project's own
 * source tree. The assertions are what a Java developer would check: the files landed beside the
 * code they already had, in their package, and their compiler accepts them.
 */
test('Confirm intent writes code into the project’s source tree and opens it', async ({ page }) => {
	test.setTimeout(300_000);
	const root = javaWorkspace();
	const workbench = await openWorkbench(page, root);

	await workbench.getByRole('button', { name: 'Normalize intent' }).click();
	await confirmIntent(page, workbench);

	// Beside App.java, in src/main/java/com/example — not in .sys, and not at the project root.
	await expect.poll(() => javaFiles(root).length, { timeout: 180_000 }).toBeGreaterThan(1);
	const written = javaFiles(root).filter(name => name !== 'App.java');
	expect(written).toContain('Category.java');
	expect(written).toContain('Book.java');

	const src = path.join(root, 'src', 'main', 'java', 'com', 'example');
	for (const name of written) {
		const code = fs.readFileSync(path.join(src, name), 'utf8');
		// A fence saved into a .java file is a syntax error, and the package has to be the one the
		// directory already implies or the file does not belong to the project it was added to.
		expect(code).not.toContain('```');
		expect(code).toContain('package com.example;');
	}

	// javac is the only witness that settles whether this is source or a plausible-looking answer.
	try {
		execFileSync('javac', ['-d', fs.mkdtempSync(path.join(os.tmpdir(), 'sys-javac-')), ...fs.readdirSync(src).map(name => path.join(src, name))], { encoding: 'utf8', stdio: 'pipe' });
	} catch (error) {
		if (error.code !== 'ENOENT') { throw new Error(`the generated Java does not compile:\n${error.stderr}`); }
	}

	// The file the user already had is untouched.
	expect(fs.readFileSync(path.join(src, 'App.java'), 'utf8')).toBe(APP_JAVA);

	// Approval is the governed record and is made before any code is asked for.
	expect(JSON.parse(core(root, ['intent', 'show', 'REQ-001'])).state).toBe('APPROVED');
	await expect(page.locator('.tabs-container').getByText(written[0])).toBeVisible({ timeout: 20_000 });
});

// Generating over files the user already has would destroy work no undo can bring back, so the
// whole write is refused rather than partly applied.
test('a generation never replaces a source file the user already wrote', async ({ page }) => {
	test.setTimeout(300_000);
	const root = javaWorkspace();
	const src = path.join(root, 'src', 'main', 'java', 'com', 'example');
	// Whatever else the model names, it cannot avoid the entities the requirement is about.
	const mine = 'package com.example;\n\n// mine, not the model’s\npublic class Category {}\n';
	fs.writeFileSync(path.join(src, 'Category.java'), mine);
	const workbench = await openWorkbench(page, root);

	await workbench.getByRole('button', { name: 'Normalize intent' }).click();
	await confirmIntent(page, workbench);

	// Shown the project's files, the model usually leaves Category.java out rather than clashing,
	// so the refusal itself is pinned by a unit test. What is asserted here is the invariant no
	// model behaviour may break: the file the user wrote is still theirs, byte for byte.
	await expect.poll(() => javaFiles(root).length > 2 || fs.existsSync(path.join(root, '.sys', 'intents', 'REQ-001.intent.review.md')), { timeout: 180_000 }).toBe(true);
	expect(fs.readFileSync(path.join(src, 'Category.java'), 'utf8')).toBe(mine);
	expect(JSON.parse(core(root, ['intent', 'show', 'REQ-001'])).state).toBe('APPROVED');
});

// A project whose language the editor cannot name gets no guessed code, and the approval still
// stands: the provider does not get a vote on what the user confirmed.
test('a project with no build file it recognizes is told so, and stays confirmed', async ({ page }) => {
	test.setTimeout(240_000);
	const root = emptyWorkspace();
	fs.writeFileSync(path.join(root, '.sys', 'project.json'), JSON.stringify({ version: 1, requirements: [{ id: 'REQ-001' }] }));
	fs.writeFileSync(path.join(root, '.sys', 'requirements', 'REQ-001.md'), DATA_MODEL);
	const workbench = await openWorkbench(page, root);

	await workbench.getByRole('button', { name: 'Normalize intent' }).click();
	await confirmIntent(page, workbench);

	await expect(workbench.getByText(/Could not tell what language this project is written in/)).toBeVisible({ timeout: 60_000 });
	expect(JSON.parse(core(root, ['intent', 'show', 'REQ-001'])).state).toBe('APPROVED');
});
