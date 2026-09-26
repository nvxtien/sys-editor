/**
 * Code generated from a confirmed Structured Intent, added to the project's own source tree in the
 * language it is already written in. It is ordinary source: sys-core does not know it exists, and
 * nothing ties it to a Formal Spec generated later.
 */
export interface SysProjectLanguage {
	readonly name: string;
	/** Where the project keeps source, relative to the workspace root; '.' when it keeps it at the root. */
	readonly sourceDir: string;
}

export interface SysGeneratedFile { readonly path: string; readonly code: string }

/**
 * The project names its own language through the build file at its root. The model never chooses:
 * the code it writes joins a source tree already written in one language.
 *
 * Order is significance, not preference: a TypeScript project has a package.json too, so the
 * narrower marker is matched first.
 */
const LANGUAGE_MARKERS: readonly (readonly [string, SysProjectLanguage])[] = [
	['pom.xml', { name: 'Java', sourceDir: 'src' }],
	['build.gradle', { name: 'Java', sourceDir: 'src' }],
	['build.gradle.kts', { name: 'Java', sourceDir: 'src' }],
	['go.mod', { name: 'Go', sourceDir: '.' }],
	['Cargo.toml', { name: 'Rust', sourceDir: 'src' }],
	['pyproject.toml', { name: 'Python', sourceDir: '.' }],
	['requirements.txt', { name: 'Python', sourceDir: '.' }],
	['tsconfig.json', { name: 'TypeScript', sourceDir: 'src' }],
	['package.json', { name: 'JavaScript', sourceDir: 'src' }]
];

/** `rootEntries` are the names directly under the workspace folder. Undefined when none is a marker. */
export function projectLanguage(rootEntries: readonly string[]): SysProjectLanguage | undefined {
	const present = new Set(rootEntries);
	return LANGUAGE_MARKERS.find(([marker]) => present.has(marker))?.[1];
}

export const SYS_UNKNOWN_LANGUAGE_MESSAGE = `Could not tell what language this project is written in, so no code was generated. Looked for ${LANGUAGE_MARKERS.map(([marker]) => marker).join(', ')} at the workspace root.`;

/**
 * The server checks these paths too. This is the second check, because a path from a model becomes
 * a file written into the user's project, and one check between the two is not enough. A
 * backslash is rejected rather than normalized: a Windows-style path is not what the format asks
 * for, and treating it as one is how `src\..\..` slips past a check for `../`.
 */
function assertInsideProject(path: string): string {
	const segments = path.split('/');
	if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0') || segments.includes('..') || segments.includes('')) {
		throw new Error(`SideX returned a file outside the project and nothing was written: ${path || '(empty path)'}`);
	}
	return path;
}

/**
 * Refusing the whole write, not the clashing part of it: a half-applied generation leaves the
 * project in a state neither the user nor the next generation can reason about, and overwriting a
 * file the user wrote is not something a generation step gets to do at all.
 *
 * `taken` are the paths that already exist in the project, in the order the files were generated.
 */
export function refuseToOverwrite(taken: readonly string[]): void {
	if (!taken.length) { return; }
	const [one, many] = taken.length === 1 ? ['exists', 'it'] : ['exist', 'them'];
	throw new Error(`Nothing was written: ${taken.join(', ')} already ${one} in this project. Delete ${many} first to generate again.`);
}

/**
 * Unlike the review page's scenarios, this is the whole point of the click: every failure is
 * raised so the row can say what went wrong, never swallowed into a button that did nothing.
 */
export async function requestGeneratedCode(httpUrl: string, model: string, intent: string, language: string, sourceFiles: readonly string[]): Promise<readonly SysGeneratedFile[]> {
	let response: Response;
	try {
		response = await fetch(`${httpUrl.replace(/\/+$/, '')}/v1/sys/generate-code`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model, intent, language, sourceFiles }),
			signal: AbortSignal.timeout(180_000)
		});
	} catch (error) {
		throw new Error(`SideX code request failed: ${error instanceof Error ? error.message : String(error)}. Check SideX Settings → Models and that the SideX server is running.`);
	}

	let body: { files?: unknown; error?: unknown };
	try {
		body = await response.json();
	} catch {
		throw new Error('SideX returned an invalid code response.');
	}
	if (!response.ok) {
		const detail = typeof body.error === 'string' ? body.error : `HTTP ${response.status}`;
		throw new Error(`SideX could not generate code: ${detail}. Check SideX Settings → Models.`);
	}
	const files = Array.isArray(body.files) ? body.files as { path?: unknown; code?: unknown }[] : [];
	if (!files.length) { throw new Error('SideX returned no code for this Structured Intent.'); }
	return files.map(file => {
		if (typeof file?.path !== 'string' || typeof file?.code !== 'string') { throw new Error('SideX returned a file without a path or contents.'); }
		return { path: assertInsideProject(file.path), code: file.code };
	});
}
