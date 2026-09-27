/**
 * PROTOTYPE harness — proves the workflow surfaces actually appear in the real editor, so the
 * design can be judged by using it rather than by reading it. Delete with the prototype.
 */
import { expect, test } from 'playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const port = process.env.SYS_LIVE_SERVER_PORT;
test.skip(!port, 'set SYS_LIVE_SERVER_PORT to the running sidex-server port');
test.setTimeout(120_000);

const BOOK = `package com.example;

public class Book {
    private int id;
    private String title;
    private Category category;

    public Book() {
    }

    public Book(int id, String title, Category category) {
        this.id = id;
        this.title = title;
        this.category = category;
    }
}
`;

function javaWorkspace() {
	const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sys-proto-')), 'app');
	const pkg = root;
	fs.mkdirSync(pkg, { recursive: true });
	fs.mkdirSync(path.join(root, '.sys/requirements'), { recursive: true });
	fs.writeFileSync(path.join(root, '.sys/project.json'), JSON.stringify({ version: 1, requirements: [] }));
	fs.writeFileSync(path.join(root, 'pom.xml'), '<project/>');
	fs.writeFileSync(path.join(pkg, 'Book.java'), BOOK);
	return { root, book: path.join(pkg, 'Book.java') };
}

async function open(page, root, file) {
	await page.exposeFunction('__sysFs', async (command, args) => {
		const p = args.path ?? args.filePath;
		switch (command) {
			case 'read_file': return fs.readFileSync(p, 'utf8');
			case 'read_file_bytes': return Array.from(fs.readFileSync(p));
			case 'write_file': fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, args.contents ?? args.content ?? ''); return null;
			case 'mkdir': fs.mkdirSync(p, { recursive: true }); return null;
			case 'exists': return fs.existsSync(p);
			case 'stat': { const s = fs.statSync(p); return { is_dir: s.isDirectory(), is_file: s.isFile(), is_symlink: false, size: s.size, modified: 0, created: 0, readonly: false }; }
			case 'read_dir': return fs.readdirSync(p).map(name => ({ name, is_dir: fs.statSync(path.join(p, name)).isDirectory() }));
			default: return null;
		}
	});
	await page.exposeFunction('__sysFind', async (dir, pattern) => {
		const found = [];
		const walk = (d) => {
			for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
				if (entry.name.startsWith('.')) { continue; }
				const full = path.join(d, entry.name);
				if (entry.isDirectory()) { walk(full); }
				else if (!pattern || entry.name.toLowerCase().includes(String(pattern).toLowerCase())) { found.push(full); }
			}
		};
		walk(dir);
		return found;
	});
	await page.addInitScript(({ serverPort }) => {
		window.__SIDEX_TAURI__ = true;
		window.__TAURI_INTERNALS__ = {
			invoke: async (command, args = {}) => {
				const name = String(command).split('|').pop();
				if (name === 'server_endpoint') { return { wsUrl: `ws://127.0.0.1:${serverPort}`, httpUrl: `http://127.0.0.1:${serverPort}`, port: serverPort, running: true }; }
				if (name === 'settings_get') { return {}; }
				if (name.startsWith('theme_')) { return name === 'theme_list' ? [] : {}; }
				// Quick Open is file search. Stubbing it empty leaves "No matching results" and
				// looks exactly like the editor failing to open the file.
				if (name === 'search_files') { return window.__sysFind(args.dir, args.pattern); }
				if (name === 'search_text') { return []; }
				return window.__sysFs(name, args);
			},
			transformCallback: () => 1,
			metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } }
		};
	}, { serverPort: Number(port) });
	await page.goto(`http://localhost:1420/?folder=${encodeURIComponent('file://' + root)}`);
	// The workbench has to exist before any keybinding reaches it; pressing earlier goes nowhere
	// and looks exactly like the editor failing to open.
	await expect(page.locator('.monaco-workbench')).toBeVisible({ timeout: 60_000 });
	await page.getByRole('tab', { name: /^Explorer/ }).click();
	await page.getByRole('treeitem', { name: new RegExp(file) }).first().click();
	await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 30_000 });
	return page.locator('.monaco-editor').first();
}

/**
 * A broken obligation is marked where the developer already looks, and the marker carries the
 * counterexample rather than a code. A reviewer passes `public Book() {}` nine times out of ten;
 * the words "leaves category unset" are what make them stop.
 */
test('a broken obligation is squiggled, and says what broke it', async ({ page }) => {
	const { root } = javaWorkspace();
	const editor = await open(page, root, 'Book.java');

	await expect(editor.locator('.squiggly-error').first()).toBeVisible({ timeout: 30_000 });

	// The hover is the whole "what am I touching" affordance: no navigation, no panel.
	await editor.getByText('public Book()').first().hover();
	const hover = page.locator('.monaco-hover').first();
	await expect(hover).toContainText('A Book cannot exist without its Category', { timeout: 15_000 });
	await expect(hover).toContainText('leaves category unset');
});

/**
 * The reason travels with the obligation, because it is what a person needs at the moment they
 * are deciding whether to change the code or change the requirement. Without it that decision is
 * a coin flip, which is the whole argument for keeping a human at this gate.
 */
test('the hover carries why the obligation exists', async ({ page }) => {
	const { root } = javaWorkspace();
	const editor = await open(page, root, 'Book.java');
	await expect(editor.locator('.squiggly-error').first()).toBeVisible({ timeout: 30_000 });

	await editor.getByText('public Book()').first().hover();
	const hover = page.locator('.monaco-hover').first();
	await expect(hover).toContainText('orphaned books corrupted the catalogue', { timeout: 15_000 });
	await expect(hover).toContainText('Considered:');
});

/**
 * Silence applies to decoration, not to answers. A held obligation must not squiggle — decoration
 * is imposed, and imposing on code that is fine is how the signal drowns. But its hover does
 * answer, because a hover is only seen by someone who pointed at the line and waited: they asked.
 *
 * The design first said "SATISFIED shows nothing at all". Using it showed that conflated the two,
 * and that the answer on request is the whole "what am I touching" affordance.
 */
test('a held obligation does not decorate, but does answer when asked', async ({ page }) => {
	const { root } = javaWorkspace();
	const editor = await open(page, root, 'Book.java');
	await expect(editor.locator('.squiggly-error').first()).toBeVisible({ timeout: 30_000 });

	await editor.getByText('String title').first().hover();
	const hover = page.locator('.monaco-hover').filter({ hasText: 'Sys ·' }).first();
	await expect(hover).toContainText('Book has a title', { timeout: 15_000 });
	await expect(hover).toContainText('held');
	// And it is an answer, not an alarm: nothing on this line is marked.
	await expect(editor.locator('.squiggly-error').filter({ hasText: 'title' })).toHaveCount(0);
});

/**
 * Retracting an obligation makes you read why it exists first. This is the one moment a person
 * decides whether to change the code or change the requirement, and the reason is the only thing
 * that makes the decision better than a coin flip.
 */
test('you cannot retract an obligation without reading why it exists', async ({ page }) => {
	const { root } = javaWorkspace();
	const editor = await open(page, root, 'Book.java');
	await expect(editor.locator('.squiggly-error').first()).toBeVisible({ timeout: 30_000 });

	await editor.getByText('public Book()').first().click();
	await page.keyboard.press('Meta+Period');
	const menu = page.locator('.action-widget, .context-view').filter({ hasText: 'Sys:' }).first();
	await expect(menu).toContainText('this obligation is wrong', { timeout: 15_000 });
	// There is no button that just silences it. A free suppression is how every obligation in a
	// system eventually becomes decoration.
	await expect(menu).not.toContainText('Ignore');
	await expect(menu).not.toContainText('Suppress');

	// The action list is keyboard-driven; a click lands on a row Playwright never sees settle.
	await page.keyboard.press('Enter');
	const dialog = page.locator('.monaco-dialog-box');
	await expect(dialog).toContainText('orphaned books corrupted the catalogue', { timeout: 15_000 });
	await expect(dialog).toContainText('Considered:');
	await expect(dialog.getByRole('button', { name: 'Narrow it instead' })).toBeVisible();
});

/**
 * NOT_OBSERVED has no line in the code to mark, so a list is the only place it can live. What is
 * held is never listed: a list of things that are fine is the noise this design avoids.
 */
test('the Needs you list carries what has no line to stand on', async ({ page }) => {
	const { root } = javaWorkspace();
	await open(page, root, 'Book.java');

	await page.getByRole('tab', { name: /^Sys/ }).click();
	const needs = page.locator('.sys-semantic-workbench').first();
	await expect(needs).toContainText('Needs you', { timeout: 30_000 });
	await expect(needs).toContainText('A Category name is never empty');
	await expect(needs).toContainText('nothing in the code says this yet');
	await expect(needs).toContainText('A Book cannot exist without its Category');
	// Held obligations are never listed.
	await expect(needs).not.toContainText('Book has a title');
});
