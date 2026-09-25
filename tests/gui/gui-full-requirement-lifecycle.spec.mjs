import { expect, test } from 'playwright/test';

const workspace = 'file:///tmp/sidex-gui-lifecycle';
const root = '/tmp/sidex-gui-lifecycle';

function installTauriFileBridge(page) {
	return page.addInitScript(({ root }) => {
		const files = new Map([
			[`${root}/.sys/project.json`, JSON.stringify({ version: 1, requirements: [{ id: 'REQ-001' }] })],
			[`${root}/.sys/requirements/REQ-001.md`, 'A booking request must contain at least one seat.\n']
		]);
		const directories = new Set([root]);
		window.__SIDEX_TEST_FILES__ = files;
		const pathOf = value => String(value).replace(/^file:\/\//, '');
		const isFile = value => files.has(pathOf(value));
		const isDir = value => {
			const path = pathOf(value).replace(/\/$/, '');
			return directories.has(path) || [...files.keys()].some(file => file.startsWith(`${path}/`));
		};
		const bytes = value => Array.from(new TextEncoder().encode(value));
		const text = value => new TextDecoder().decode(new Uint8Array(value));
		window.__SIDEX_TAURI__ = true;
		window.__TAURI_INTERNALS__ = {
			invoke: async (command, args = {}) => {
				const name = String(command).split('|').pop();
				const path = args.path ?? args.filePath;
				if (name === 'read_file' || name === 'read_file_bytes') {
					if (!isFile(path)) throw new Error(`not found: ${path}`);
					return name === 'read_file' ? files.get(pathOf(path)) : bytes(files.get(pathOf(path)));
				}
				if (name === 'stat') {
					const file = isFile(path);
					if (!file && !isDir(path)) throw new Error(`not found: ${path}`);
					return { is_dir: !file && isDir(path), is_file: file, is_symlink: false, size: file ? files.get(pathOf(path)).length : 0, modified: 0, created: 0, readonly: false };
				}
				if (name === 'write_file') { files.set(pathOf(path), args.contents ?? args.content ?? ''); return null; }
				if (name === 'write_file_bytes') { files.set(pathOf(path), text(args.contents ?? args.content)); return null; }
				if (name === 'mkdir') { directories.add(pathOf(path)); return null; }
				if (name === 'exists') return isFile(path) || isDir(path);
				if (name === 'read_dir') return [];
				if (name === 'settings_get') return {};
				if (name === 'server_endpoint') return { wsUrl: 'ws://127.0.0.1:7433', httpUrl: 'http://127.0.0.1:7433', port: 7433, running: true };
				if (name.startsWith('theme_')) return name === 'theme_list' ? [] : {};
				if (name === 'search_files' || name === 'search_text') return [];
				return null;
			},
			transformCallback: () => 1,
			metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } }
		};
	}, { root });
}

// This bridge mocks the Tauri file APIs only. Structured Intent state, capability and every
// lifecycle action now come from sys-core over /v1/sys/core, which no mock answers here — so this
// file covers what it honestly can without a live server: the requirement renders, and the editor
// fails closed rather than inventing a lifecycle. The live flow is covered by normalize-intent-live.
test('renders the governed requirement from disk', async ({ page }) => {
	await installTauriFileBridge(page);
	await page.goto(`/?folder=${encodeURIComponent(workspace)}`);
	await page.locator('[aria-label="Sys"]').first().click();

	const workbench = page.locator('.sys-semantic-workbench').first();
	await expect(workbench).toContainText('REQ-001', { timeout: 15_000 });
	await expect(workbench).toContainText('A booking request must contain at least one seat.');
	await expect(workbench).toContainText('No .spec file yet');
});

test('without sys-core the editor shows no lifecycle state and offers no lifecycle action', async ({ page }) => {
	await installTauriFileBridge(page);
	await page.goto(`/?folder=${encodeURIComponent(workspace)}`);
	await page.locator('[aria-label="Sys"]').first().click();

	const workbench = page.locator('.sys-semantic-workbench').first();
	await expect(workbench).toContainText('REQ-001', { timeout: 15_000 });
	await expect(workbench).toContainText('Lifecycle unavailable: sys-core did not answer', { timeout: 15_000 });
	for (const name of ['Normalize intent', 'Review intent', 'Confirm intent', 'Generate Formal Spec', 'Approve Formal Spec', 'Approve intent', 'Verify']) {
		await expect(workbench.getByRole('button', { name })).toHaveCount(0);
	}
	// The lifecycle is gone, not replaced by a source-binding shortcut.
	await expect(workbench.getByRole('button', { name: 'Bind operation' })).toHaveCount(0);
	await expect(workbench).not.toContainText('Class.method');
	// The editor writes no Structured Intent of its own when core is silent.
	expect(await page.evaluate(() => window.__SIDEX_TEST_FILES__.has('/tmp/sidex-gui-lifecycle/.sys/intents/REQ-001.intent.json'))).toBe(false);
});
