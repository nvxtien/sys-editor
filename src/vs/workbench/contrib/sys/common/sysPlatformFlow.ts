export interface SysDraftPreview {
	readonly draftSpec: string;
	readonly operation: string;
	readonly validationState: 'VALIDATED';
}

export interface SysPendingProposal {
	readonly kind: string;
	readonly requirementId: string;
	readonly version: number;
	readonly targetFile: string;
	readonly diff: string;
	readonly verificationState: string;
}

function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Sys Platform returned malformed JSON');
	}
	return value as Record<string, unknown>;
}

export function decodeDraftPreview(text: string): SysDraftPreview {
	let value: unknown;
	try { value = JSON.parse(text); } catch { throw new Error('Sys Platform returned invalid preview JSON'); }
	const result = record(value);
	if (result.command !== 'requirement' || typeof result.draftSpec !== 'string' || !result.draftSpec.trim() || typeof result.operation !== 'string' || result.validationState !== 'VALIDATED') {
		throw new Error('Sys Platform returned an incomplete or unvalidated draft preview');
	}
	return { draftSpec: result.draftSpec, operation: result.operation, validationState: 'VALIDATED' };
}

export async function validateDraftCandidate(
	candidatePath: string,
	candidateText: string,
	writeCandidate: (path: string, text: string) => Promise<void>,
	runPreview: (path: string) => Promise<string>,
	removeCandidate: (path: string) => Promise<void>
): Promise<SysDraftPreview> {
	try {
		await writeCandidate(candidatePath, candidateText);
		return decodeDraftPreview(await runPreview(candidatePath));
	} finally {
		await removeCandidate(candidatePath);
	}
}

export function decodePendingProposal(text: string): SysPendingProposal {
	let value: unknown;
	try { value = JSON.parse(text); } catch { throw new Error('Sys Platform returned invalid proposal JSON'); }
	const result = record(value);
	if (typeof result.kind !== 'string' || typeof result.requirementId !== 'string' || typeof result.version !== 'number' || typeof result.targetFile !== 'string' || typeof result.diff !== 'string' || typeof result.verificationState !== 'string') {
		throw new Error('Sys Platform returned an incomplete proposal');
	}
	return result as unknown as SysPendingProposal;
}

export function canApplySysProposal(proposal: Pick<SysPendingProposal, 'verificationState'>): boolean {
	return proposal.verificationState === 'VERIFIED_SYNCED';
}

export function isSysWorkspaceMissing(error: unknown): boolean {
	return error instanceof Error && error.message === 'Initialize Sys Platform in this project first with `sys init .`.';
}
