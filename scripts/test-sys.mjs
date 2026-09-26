/**
 * Runs the Sys unit tests.
 *
 * They are plain `node --test` files, so they need compiling first. Two rules make the compiled
 * copy behave the same as the source tree, and both were learned the hard way:
 *
 *   - compile with `--rootDir src`, or dependencies outside the rootDir are emitted next to their
 *     sources, shadow the .ts files, and break the app's boot
 *   - run from the repo root, because the tests that read source files resolve from `process.cwd()`
 *
 * Without this script the only way to run them was an ad-hoc tsc into a temp directory, which
 * silently dropped fixtures and reported failures the repo does not have.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'out-test';
const TESTS = 'src/vs/workbench/contrib/sys/common/test';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const sources = readdirSync(TESTS).filter(name => name.endsWith('.test.ts')).map(name => join(TESTS, name));
// tsc exits non-zero on the repo's pre-existing type errors in files these tests import. The
// emitted JavaScript is still correct, so the run continues and the tests are the verdict.
try {
	execFileSync('npx', ['tsc', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext',
		'--moduleResolution', 'NodeNext', '--rootDir', 'src', '--outDir', OUT, ...sources],
		{ stdio: 'pipe' });
} catch { /* type errors are reported by `npx tsc -p tsconfig.json --noEmit`, not here */ }

const compiled = join(OUT, TESTS.replace(/^src\//, ''));
let failed = 0;
for (const name of readdirSync(compiled).filter(n => n.endsWith('.test.js')).sort()) {
	const output = execFileSync('node', ['--test', join(compiled, name)], { encoding: 'utf8', stdio: 'pipe' })
		.toString()
		.match(/^# (?:pass|fail) \d+$/gm)?.join(' ') ?? '';
	const bad = !/# fail 0\b/.test(output);
	if (bad) { failed++; }
	console.log(`${bad ? 'FAIL' : 'ok  '}  ${name}  ${output}`);
}
console.log(failed ? `\n${failed} test file(s) failed` : '\nall sys tests passed');
process.exit(failed ? 1 : 0);
