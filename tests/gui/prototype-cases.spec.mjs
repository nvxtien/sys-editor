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
 * CASE 01 — A broken obligation reads as a counterexample, not a code.
 *
 * Do:   open Book.java
 * See:  `public Book() {}` and the non-final Category field are marked, and the message names
 *       what broke rather than naming a rule
 * Why:  a reviewer passes `public Book() {}` nine times out of ten. "leaves category unset" is
 *       what makes them stop. One obligation, two witnesses — the map to code is not one to one.
 */
test('Case 01 — a broken obligation is marked with what broke it', async ({ page }) => {
	const { root } = javaWorkspace();
	const editor = await open(page, root, 'Book.java');

	await expect(editor.locator('.squiggly-error').first()).toBeVisible({ timeout: 30_000 });

	await editor.getByText('public Book()').first().hover();
	const hover = page.locator('.monaco-hover').filter({ hasText: 'Sys ·' }).first();
	await expect(hover).toContainText('A Book cannot exist without its Category', { timeout: 15_000 });
	await expect(hover).toContainText('leaves category unset');
	// The obligation is not a rule name and not a code; it is the sentence a person would say.
	await expect(hover).not.toContainText('CANNOT_EXIST_WITHOUT');
	await expect(hover).not.toContainText('st:');
});

/**
 * CASE 02 — The reason travels with the obligation.
 *
 * Do:   hover the marked constructor
 * See:  why the obligation exists, what was chosen, and what was considered instead
 * Why:  this is the one moment a person decides whether to change the code or change the
 *       requirement. Without the reason that decision is a coin flip, which is the whole
 *       argument for keeping a human at this gate at all.
 */
test('Case 02 — the hover carries why the obligation exists', async ({ page }) => {
	const { root } = javaWorkspace();
	const editor = await open(page, root, 'Book.java');
	await expect(editor.locator('.squiggly-error').first()).toBeVisible({ timeout: 30_000 });

	await editor.getByText('public Book()').first().hover();
	const hover = page.locator('.monaco-hover').filter({ hasText: 'Sys ·' }).first();
	await expect(hover).toContainText('orphaned books corrupted the catalogue', { timeout: 15_000 });
	await expect(hover).toContainText('Considered:');
});

/**
 * CASE 03 — Silence applies to decoration, not to answers.
 *
 * Do:   hover `private String title;`, which nothing is wrong with
 * See:  no mark on the line, but a hover saying the obligation is held
 * Why:  decoration is imposed — marking code that is fine is how the signal drowns. A hover is
 *       only seen by someone who pointed and waited: they asked. The design first said a held
 *       obligation "shows nothing at all"; using the prototype showed that conflated the two.
 */
test('Case 03 — a held obligation does not decorate, but answers when asked', async ({ page }) => {
	const { root } = javaWorkspace();
	const editor = await open(page, root, 'Book.java');
	await expect(editor.locator('.squiggly-error').first()).toBeVisible({ timeout: 30_000 });

	await editor.getByText('String title').first().hover();
	const hover = page.locator('.monaco-hover').filter({ hasText: 'Sys ·' }).first();
	await expect(hover).toContainText('Book has a title', { timeout: 15_000 });
	await expect(hover).toContainText('held');
	await expect(editor.locator('.squiggly-error').filter({ hasText: 'title' })).toHaveCount(0);
});

/**
 * CASE 04 — There is no free suppression.
 *
 * Do:   Quick Fix on the marked constructor, then choose "this obligation is wrong…"
 * See:  two actions and no Ignore; the reason before any button that would remove the
 *       obligation; and "Narrow it instead" as the alternative to waiving it
 * Why:  a free `// noqa` is how every obligation in a system eventually becomes decoration.
 *       Narrowing keeps the obligation checkable instead of hiding a carve-out beside it.
 */
test('Case 04 — retracting an obligation makes you read why it exists', async ({ page }) => {
	const { root } = javaWorkspace();
	const editor = await open(page, root, 'Book.java');
	await expect(editor.locator('.squiggly-error').first()).toBeVisible({ timeout: 30_000 });

	await editor.getByText('public Book()').first().click();
	await page.keyboard.press('Meta+Period');
	const menu = page.locator('.action-widget, .context-view').filter({ hasText: 'Sys:' }).first();
	await expect(menu).toContainText('this obligation is wrong', { timeout: 15_000 });
	await expect(menu).toContainText('this location is an exception');
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
 * CASE 05 — What has no line to stand on.
 *
 * Do:   open the Sys view
 * See:  "Needs you" — what is broken first, then what nothing in the code says anything about;
 *       what is held is never listed
 * Why:  NOT_OBSERVED is the common case on real code and has no line to mark, so a list is the
 *       only place it can live — and a list nobody opens is the same as nowhere. Whether anyone
 *       opens it is the question this case exists to answer.
 */
test('Case 05 — the Needs you list carries what has no line to stand on', async ({ page }) => {
	const { root } = javaWorkspace();
	await open(page, root, 'Book.java');

	await page.getByRole('tab', { name: /^Sys/ }).click();
	const view = page.locator('.sys-semantic-workbench').first();
	await expect(view).toContainText('Needs you', { timeout: 30_000 });
	await expect(view).toContainText('A Book cannot exist without its Category');
	await expect(view).toContainText('A Category name is never empty');
	await expect(view).toContainText('nothing in the code says this yet');
	// A list of things that are fine is the noise this whole design avoids.
	await expect(view).not.toContainText('Book has a title');
});

/**
 * CASE 06 — Governing something at the moment it is written.
 *
 * Do:   put the cursor on a line nothing governs — `private String author;` — and Quick Fix
 * See:  "Sys: govern this — “Book has an author”…", the sentence already written for you; accept
 *       or correct it, then say why it matters
 * Why:  this is the load-bearing assumption of the whole design. Approving an intent and
 *       resolving a conflict are moments a person has already stopped to think; writing the line
 *       is the only moment they still remember why. If it does not work here, nothing ever
 *       becomes governed and there is no starting point at all.
 */
test('Case 06 — a line nothing governs offers a sentence already written', async ({ page }) => {
	const { root } = javaWorkspace();
	const editor = await open(page, root, 'Book.java');
	await expect(editor.locator('.squiggly-error').first()).toBeVisible({ timeout: 30_000 });

	await editor.getByText('private int id').first().click();
	await page.keyboard.press('Meta+Period');
	const menu = page.locator('.action-widget, .context-view').filter({ hasText: 'Sys:' }).first();
	// The proposal is derived from the line, so governing it is editing rather than composing.
	await expect(menu).toContainText('govern this', { timeout: 15_000 });
	await expect(menu).toContainText('Book has an id');

	await page.keyboard.press('Enter');
	const input = page.locator('.quick-input-widget');
	await expect(input).toContainText('What does this say?', { timeout: 15_000 });
	// Accepting the proposal is one keystroke. Composing a sentence would be the chore.
	await page.keyboard.press('Enter');
	await expect(input).toContainText('Why does it matter?', { timeout: 15_000 });
});

/**
 * CASE 06b — Accepting the proposal costs two keystrokes.
 *
 * Enter accepts the sentence the line already said; the only typing is the reason. If governing
 * something cost a composed sentence, nobody would do it and nothing would ever be governed.
 */
test('Case 06b — accepting the proposal and giving a reason governs it', async ({ page }) => {
	const { root } = javaWorkspace();
	const editor = await open(page, root, 'Book.java');
	await expect(editor.locator('.squiggly-error').first()).toBeVisible({ timeout: 30_000 });

	await editor.getByText('private int id').first().click();
	await page.keyboard.press('Meta+Period');
	await expect(page.locator('.action-widget, .context-view').filter({ hasText: 'Sys:' }).first())
		.toContainText('govern this', { timeout: 15_000 });
	await page.keyboard.press('Enter');
	await expect(page.locator('.quick-input-widget')).toContainText('What does this say?', { timeout: 15_000 });
	await page.keyboard.press('Enter');
	await expect(page.locator('.quick-input-widget')).toContainText('Why does it matter?', { timeout: 15_000 });
	await page.keyboard.type('orphaned books corrupted the catalogue');
	await page.keyboard.press('Enter');
	await expect(page.getByText(/governed obligation/)).toBeVisible({ timeout: 15_000 });
});

/**
 * CASE 06c — Without a reason it stays an observation.
 *
 * A statement nobody can say why about will never drift in a way anyone minds, so governing it
 * spends review attention and buys nothing. This is the admission test the design relies on to
 * keep the governed set small enough to hold in a head — and it is what keeps uplift tractable,
 * because recovery proposes thousands and only the ones with a reason survive.
 */
test('Case 06c — without a reason it stays an observation, not an obligation', async ({ page }) => {
	const { root } = javaWorkspace();
	const editor = await open(page, root, 'Book.java');
	await expect(editor.locator('.squiggly-error').first()).toBeVisible({ timeout: 30_000 });

	await editor.getByText('private int id').first().click();
	await page.keyboard.press('Meta+Period');
	await expect(page.locator('.action-widget, .context-view').filter({ hasText: 'Sys:' }).first())
		.toContainText('govern this', { timeout: 15_000 });
	await page.keyboard.press('Enter');
	await expect(page.locator('.quick-input-widget')).toContainText('What does this say?', { timeout: 15_000 });
	await page.keyboard.press('Enter');
	await expect(page.locator('.quick-input-widget')).toContainText('Why does it matter?', { timeout: 15_000 });
	// Left blank on purpose.
	await page.keyboard.press('Enter');

	await expect(page.getByText(/observation, not governed/)).toBeVisible({ timeout: 15_000 });
	await expect(page.getByText(/nothing would enforce it/)).toBeVisible();
});
