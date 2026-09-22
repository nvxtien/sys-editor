export function assertSysDraftServerAvailable(running: boolean, configuredUrl: string | undefined, serverError?: string | null): void {
	if (!configuredUrl?.trim() && !running) {
		const detail = serverError?.trim();
		throw new Error(detail
			? `SideX server is not running: ${detail}`
			: 'SideX server is not running. Open SideX Settings → Models and save provider settings to restart it, then try again.');
	}
}

export async function requestSysFormalSpecDraft(httpUrl: string, model: string, intent: string): Promise<string> {
	let response: Response;
	try {
		response = await fetch(`${httpUrl.replace(/\/+$/, '')}/v1/sys/draft-spec`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model, intent }),
			signal: AbortSignal.timeout(90_000)
		});
	} catch (error) {
		throw new Error(`SideX draft request failed: ${error instanceof Error ? error.message : String(error)}. Check SideX Settings → Models and that the SideX server is running.`);
	}

	let body: { draftSpec?: unknown; error?: unknown };
	try {
		body = await response.json();
	} catch {
		throw new Error('SideX returned an invalid draft response.');
	}
	if (!response.ok) {
		const detail = typeof body.error === 'string' ? body.error : `HTTP ${response.status}`;
		throw new Error(`SideX could not draft a Formal Spec: ${detail}. Check SideX Settings → Models.`);
	}
	if (typeof body.draftSpec !== 'string' || !body.draftSpec.trim()) {
		throw new Error('SideX returned an empty Formal Spec draft.');
	}
	return body.draftSpec;
}
