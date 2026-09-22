import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = path.join(root, 'sidexai', 'sidex-server');
const cacheDir = path.join(root, 'target', 'go');
const binaryName = process.platform === 'win32' ? 'sidex-server.exe' : 'sidex-server';

mkdirSync(cacheDir, { recursive: true });
const result = spawnSync('go', ['build', '-tags', 'fts5', '-o', binaryName, './cmd/server'], {
	cwd: serverDir,
	stdio: 'inherit',
	env: {
		...process.env,
		GOPATH: path.join(cacheDir, 'gopath'),
		GOMODCACHE: path.join(cacheDir, 'mod'),
		GOCACHE: path.join(cacheDir, 'build')
	}
});

if (result.error) {
	console.error(`Failed to build sidex-server: ${result.error.message}`);
	process.exit(1);
}
process.exit(result.status ?? 1);
