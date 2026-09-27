/// Whether the SideX server is reachable at all. This is editor plumbing, not governed meaning:
/// it says a request cannot be sent, never what the answer would have been.
///
/// It lived in the Formal Spec drafting module until that module was frozen with the controlled
/// grammar. Nothing about it was ever about specs.
export function assertSysDraftServerAvailable(running: boolean, configuredUrl: string | undefined, serverError?: string | null): void {
	if (!configuredUrl?.trim() && !running) {
		const detail = serverError?.trim();
		throw new Error(detail
			? `SideX server is not running: ${detail}`
			: 'SideX server is not running. Open SideX Settings → Models and save provider settings to restart it, then try again.');
	}
}
