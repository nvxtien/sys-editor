/**
 * The lifecycle of one requirement exactly as sys-core reports it (`sys-core lifecycle <ID>`).
 * Approval and staleness are decided there, from the content on disk and the identities recorded at
 * approval time. The editor validates the reply's shape and renders it; it never derives these states.
 */
export type SysArtifactState = 'NOT_CREATED' | 'DRAFT' | 'APPROVED' | 'STALE';

export interface SysLifecycle {
	readonly requirementId: string;
	readonly requirement: { readonly present: boolean; readonly approved: boolean; readonly identity: string | null };
	readonly structuredIntent: { readonly state: SysArtifactState; readonly identity: string | null };
	readonly formalSpec: { readonly state: SysArtifactState; readonly identity: string | null };
	readonly status: string;
}

const STATES: readonly SysArtifactState[] = ['NOT_CREATED', 'DRAFT', 'APPROVED', 'STALE'];

export const isSysArtifactState = (value: unknown): value is SysArtifactState => STATES.includes(value as SysArtifactState);

function artifact(value: unknown): { state: SysArtifactState; identity: string | null } | undefined {
	const raw = value as { state?: unknown; identity?: unknown } | null;
	if (!raw || typeof raw !== 'object' || !STATES.includes(raw.state as SysArtifactState) || (raw.identity !== null && typeof raw.identity !== 'string')) { return undefined; }
	return { state: raw.state as SysArtifactState, identity: raw.identity as string | null };
}

export function parseLifecycle(value: unknown): SysLifecycle {
	const raw = value as { requirementId?: unknown; requirement?: unknown; structuredIntent?: unknown; formalSpec?: unknown; status?: unknown } | null;
	const requirement = raw?.requirement as { present?: unknown; approved?: unknown; identity?: unknown } | null | undefined;
	const structuredIntent = artifact(raw?.structuredIntent);
	const formalSpec = artifact(raw?.formalSpec);
	if (!raw || typeof raw !== 'object' || typeof raw.requirementId !== 'string' || typeof raw.status !== 'string'
		|| !requirement || typeof requirement !== 'object' || typeof requirement.present !== 'boolean' || typeof requirement.approved !== 'boolean' || (requirement.identity !== null && typeof requirement.identity !== 'string')
		|| !structuredIntent || !formalSpec) {
		throw new Error('sys-core returned an invalid lifecycle');
	}
	return { requirementId: raw.requirementId, requirement: { present: requirement.present, approved: requirement.approved, identity: requirement.identity as string | null }, structuredIntent, formalSpec, status: raw.status };
}
