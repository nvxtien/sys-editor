/**
 * Code generated from a confirmed Structured Intent, in the language the open project is written
 * in. It is a reading aid, not a governed artifact: sys-core does not know it exists, and nothing
 * ties it to a Formal Spec generated later.
 */
export interface SysProjectLanguage { readonly name: string; readonly extension: string }

/**
 * The project names its own language through the build file at its root. The model never chooses:
 * the editor writes the answer to a file whose extension it picked here, so a model that answered
 * in another language would produce a file that does not compile.
 *
 * Order is significance, not preference: a TypeScript project has a package.json too, so the
 * narrower marker is matched first.
 */
const LANGUAGE_MARKERS: readonly (readonly [string, SysProjectLanguage])[] = [
	['pom.xml', { name: 'Java', extension: 'java' }],
	['build.gradle', { name: 'Java', extension: 'java' }],
	['build.gradle.kts', { name: 'Java', extension: 'java' }],
	['go.mod', { name: 'Go', extension: 'go' }],
	['Cargo.toml', { name: 'Rust', extension: 'rs' }],
	['pyproject.toml', { name: 'Python', extension: 'py' }],
	['requirements.txt', { name: 'Python', extension: 'py' }],
	['tsconfig.json', { name: 'TypeScript', extension: 'ts' }],
	['package.json', { name: 'JavaScript', extension: 'js' }]
];

/** `rootEntries` are the names directly under the workspace folder. Undefined when none is a marker. */
export function projectLanguage(rootEntries: readonly string[]): SysProjectLanguage | undefined {
	const present = new Set(rootEntries);
	return LANGUAGE_MARKERS.find(([marker]) => present.has(marker))?.[1];
}

export const SYS_UNKNOWN_LANGUAGE_MESSAGE = `Could not tell what language this project is written in, so no code was generated. Looked for ${LANGUAGE_MARKERS.map(([marker]) => marker).join(', ')} at the workspace root.`;

/**
 * Unlike the review page's scenarios, this is the whole point of the click: every failure is
 * raised so the row can say what went wrong, never swallowed into a button that did nothing.
 */
export async function requestGeneratedCode(httpUrl: string, model: string, intent: string, language: string): Promise<string> {
	let response: Response;
	try {
		response = await fetch(`${httpUrl.replace(/\/+$/, '')}/v1/sys/generate-code`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model, intent, language }),
			signal: AbortSignal.timeout(90_000)
		});
	} catch (error) {
		throw new Error(`SideX code request failed: ${error instanceof Error ? error.message : String(error)}. Check SideX Settings → Models and that the SideX server is running.`);
	}

	let body: { code?: unknown; error?: unknown };
	try {
		body = await response.json();
	} catch {
		throw new Error('SideX returned an invalid code response.');
	}
	if (!response.ok) {
		const detail = typeof body.error === 'string' ? body.error : `HTTP ${response.status}`;
		throw new Error(`SideX could not generate code: ${detail}. Check SideX Settings → Models.`);
	}
	if (typeof body.code !== 'string' || !body.code.trim()) {
		throw new Error('SideX returned no code for this Structured Intent.');
	}
	return body.code;
}
