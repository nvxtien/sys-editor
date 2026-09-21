/** Workspace-owned Sys project state: `<workspace>/.sys/project.json`. Human-authored text only; nothing here is formalized or verified. */
export const SYS_PROJECT_FILE = '.sys/project.json';

export type SysRequirementStatus = 'DRAFT_UNFORMALIZED' | 'APPROVED_UNFORMALIZED';
export interface SysRequirement { readonly id: string; readonly text: string; readonly status: SysRequirementStatus }
export interface SysProject { readonly version: 1; readonly requirements: readonly SysRequirement[] }

export type SysProjectState =
	| { readonly kind: 'NO_WORKSPACE' }
	| { readonly kind: 'UNSUPPORTED_MULTI_ROOT_WORKSPACE' }
	| { readonly kind: 'NO_SYS_PROJECT_YET' }
	| { readonly kind: 'READY'; readonly project: SysProject }
	| { readonly kind: 'MALFORMED_SYS_PROJECT'; readonly reason: string }
	| { readonly kind: 'IO_ERROR'; readonly reason: string };

const STATUSES: readonly string[] = ['DRAFT_UNFORMALIZED', 'APPROVED_UNFORMALIZED'];

export function parseProject(text: string): SysProjectState {
	const bad = (reason: string): SysProjectState => ({ kind: 'MALFORMED_SYS_PROJECT', reason });
	let raw: unknown;
	try { raw = JSON.parse(text); } catch (e) { return bad(`not valid JSON: ${(e as Error).message}`); }
	const p = raw as { version?: unknown; requirements?: unknown } | null;
	if (!p || p.version !== 1 || !Array.isArray(p.requirements)) { return bad('expected {"version":1,"requirements":[...]}'); }
	const ids = new Set<string>();
	for (const r of p.requirements as Record<string, unknown>[]) {
		if (!r || typeof r.id !== 'string' || typeof r.text !== 'string' || !STATUSES.includes(r.status as string)) { return bad('requirement needs string id, string text and a known status'); }
		if (ids.has(r.id)) { return bad(`duplicate requirement id ${r.id}`); }
		ids.add(r.id);
	}
	return { kind: 'READY', project: p as SysProject };
}

export function serializeProject(project: SysProject): string {
	return JSON.stringify(project, null, 2) + '\n';
}

export const EMPTY_PROJECT: SysProject = { version: 1, requirements: [] };

/** Ids are sequential (REQ-001, ...): stable, deterministic, independent of the text. */
export function addRequirement(project: SysProject, text: string): SysProject {
	const trimmed = text.trim();
	if (!trimmed) { throw new Error('requirement text is empty'); }
	const next = project.requirements.reduce((max, r) => Math.max(max, Number(/^REQ-(\d+)$/.exec(r.id)?.[1] ?? 0)), 0) + 1;
	const id = `REQ-${String(next).padStart(3, '0')}`;
	return { ...project, requirements: [...project.requirements, { id, text: trimmed, status: 'DRAFT_UNFORMALIZED' }] };
}

/** Human approval of intent. Still unformalized: this never implies EXACT/SPECIFIED/SYNCED. */
export function approveRequirement(project: SysProject, id: string): SysProject {
	if (!project.requirements.some(r => r.id === id)) { throw new Error(`unknown requirement ${id}`); }
	return { ...project, requirements: project.requirements.map(r => r.id === id ? { ...r, status: 'APPROVED_UNFORMALIZED' } : r) };
}

/** `read` returns undefined when the file does not exist and throws on any other I/O failure. */
export async function loadProjectState(folders: readonly string[], read: (path: string) => Promise<string | undefined>): Promise<SysProjectState> {
	if (folders.length === 0) { return { kind: 'NO_WORKSPACE' }; }
	if (folders.length > 1) { return { kind: 'UNSUPPORTED_MULTI_ROOT_WORKSPACE' }; }
	let text: string | undefined;
	try { text = await read(`${folders[0].replace(/\/$/, '')}/${SYS_PROJECT_FILE}`); } catch (e) { return { kind: 'IO_ERROR', reason: String(e) }; }
	return text === undefined ? { kind: 'NO_SYS_PROJECT_YET' } : parseProject(text);
}
