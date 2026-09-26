import { SysDraftRepair } from './sysFormalSpecRepair.js';
import { SYS_INTENT_KIND_LABEL, SysFormalizationCapability } from './sysStructuredIntent.js';

export function assertSysDraftServerAvailable(running: boolean, configuredUrl: string | undefined, serverError?: string | null): void {
	if (!configuredUrl?.trim() && !running) {
		const detail = serverError?.trim();
		throw new Error(detail
			? `SideX server is not running: ${detail}`
			: 'SideX server is not running. Open SideX Settings → Models and save provider settings to restart it, then try again.');
	}
}

export function assertSysDraftFormalizable(capability: SysFormalizationCapability): void {
	switch (capability.outcome) {
		case 'FORMAL_SPEC_SUPPORTED': return;
		case 'OPERATION_UNSPECIFIED':
			throw new Error('This Structured Intent states no operation, and a Formal Spec must declare one. Clarify which operation the requirement governs and normalize again.');
		case 'PLATFORM_FORMAL_SPEC_GAP':
			throw new Error(`PLATFORM_FORMAL_SPEC_GAP: the current Sys Platform grammar does not represent this ${SYS_INTENT_KIND_LABEL[capability.kind].toLowerCase()} intent yet. Its confirmed Structured Intent remains the governed record.`);
		case 'NOT_FORMALIZABLE':
			throw new Error('The current Sys Platform grammar cannot represent anything this Structured Intent states.');
	}
}

export async function requestSysFormalSpecDraft(httpUrl: string, model: string, intent: string, repair?: SysDraftRepair): Promise<string> {
	let response: Response;
	try {
		response = await fetch(`${httpUrl.replace(/\/+$/, '')}/v1/sys/draft-spec`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model, intent, ...(repair ? { repair: { previousDraft: repair.previousDraft, error: repair.error } } : {}) }),
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
