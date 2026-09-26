/**
 * Code generated from a confirmed Structured Intent.
 *
 * The editor decides nothing here. sys-core prepares the context — the approved intent, the
 * project's language and layout, and how to realise one as the other — and reads the provider's
 * answer back. This file carries the context there and the answer home.
 */
export interface SysGeneratedFile { readonly path: string; readonly code: string }

/**
 * The whole point of the click, so every failure is raised for the row to show — never swallowed
 * into a button that did nothing.
 */
export async function requestGeneratedCode(httpUrl: string, model: string, context: string): Promise<string> {
	let response: Response;
	try {
		response = await fetch(`${httpUrl.replace(/\/+$/, '')}/v1/sys/generate-code`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model, intent: context }),
			signal: AbortSignal.timeout(180_000)
		});
	} catch (error) {
		throw new Error(`SideX code request failed: ${error instanceof Error ? error.message : String(error)}. Check SideX Settings → Models and that the SideX server is running.`);
	}

	let body: { candidate?: unknown; error?: unknown };
	try {
		body = await response.json();
	} catch {
		throw new Error('SideX returned an invalid code response.');
	}
	if (!response.ok) {
		const detail = typeof body.error === 'string' ? body.error : `HTTP ${response.status}`;
		throw new Error(`SideX could not generate code: ${detail}. Check SideX Settings → Models.`);
	}
	if (typeof body.candidate !== 'string' || !body.candidate.trim()) {
		throw new Error('SideX returned no code for this Structured Intent.');
	}
	return body.candidate;
}

/**
 * Refusing the whole write, not the clashing part of it: a half-applied generation leaves the
 * project in a state neither the user nor the next generation can reason about, and overwriting
 * a file the user wrote is not something a generation step gets to do at all.
 */
export function refuseToOverwrite(taken: readonly string[]): void {
	if (!taken.length) { return; }
	const [verb, pronoun] = taken.length === 1 ? ['exists', 'it'] : ['exist', 'them'];
	throw new Error(`Nothing was written: ${taken.join(', ')} already ${verb} in this project. Delete ${pronoun} first to generate again.`);
}
