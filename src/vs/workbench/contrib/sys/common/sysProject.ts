/**
 * Workspace-owned Sys project state.
 *   .sys/requirements/<id>.md  human-authored text (edited in the normal editor)
 *   .sys/specs/<id>.spec       human-reviewed Formal Spec text
 *   .sys/project.json          tool-owned: which requirements exist, and editor configuration
 * Approval and staleness are not stored or derived here: sys-core owns them (see sysLifecycle.ts).
 */
import { SysLifecycle } from './sysLifecycle.js';
import { SysFormalizationCapability, SysFormalSpecState, SysStructuredIntentState } from './sysStructuredIntent.js';

export const SYS_PROJECT_FILE = '.sys/project.json';
export const SYS_REQUIREMENTS_DIR = '.sys/requirements';
export const requirementFile = (id: string) => `${SYS_REQUIREMENTS_DIR}/${id}.md`;
export const SYS_SPECS_DIR = '.sys/specs';
export const specFile = (id: string) => `${SYS_SPECS_DIR}/${id}.spec`;

export type SysRequirementStatus = 'DRAFT_UNFORMALIZED' | 'APPROVED_UNFORMALIZED';
export interface SysRequirementRef { readonly id: string }
export interface SysProject { readonly version: 1; readonly requirements: readonly SysRequirementRef[]; readonly platformRoot?: string }
export interface SysRequirementRow { readonly id: string; readonly title: string; readonly status: SysRequirementStatus; readonly missing: boolean; readonly hasSpec: boolean; readonly structuredIntentState?: SysStructuredIntentState; readonly formalization?: SysFormalizationCapability; readonly formalSpecState?: SysFormalSpecState; readonly lifecycleUnavailable?: true }

export type SysProjectState =
	| { readonly kind: 'NO_WORKSPACE' }
	| { readonly kind: 'UNSUPPORTED_MULTI_ROOT_WORKSPACE' }
	| { readonly kind: 'NO_SYS_PROJECT_YET' }
	| { readonly kind: 'READY'; readonly project: SysProject; readonly rows: readonly SysRequirementRow[] }
	| { readonly kind: 'MALFORMED_SYS_PROJECT'; readonly reason: string }
	| { readonly kind: 'IO_ERROR'; readonly reason: string };

export const EMPTY_PROJECT: SysProject = { version: 1, requirements: [] };

export function parseProject(text: string): SysProject | { readonly malformed: string } {
	const bad = (malformed: string) => ({ malformed });
	let raw: unknown;
	try { raw = JSON.parse(text); } catch (e) { return bad(`not valid JSON: ${(e as Error).message}`); }
	const p = raw as { version?: unknown; requirements?: unknown; platformRoot?: unknown } | null;
	if (!p || p.version !== 1 || !Array.isArray(p.requirements) || (p.platformRoot !== undefined && typeof p.platformRoot !== 'string')) { return bad('expected {"version":1,"requirements":[...],"platformRoot"?:string}'); }
	const ids = new Set<string>();
	const requirements: SysRequirementRef[] = [];
	for (const r of p.requirements as Record<string, unknown>[]) {
		if (!r || typeof r.id !== 'string' || !/^REQ-\d+$/.test(r.id)) { return bad('requirement needs an id like REQ-001'); }
		if (ids.has(r.id)) { return bad(`duplicate requirement id ${r.id}`); }
		ids.add(r.id);
		// Approval fields written by older editors are ignored here and dropped on the next save.
		requirements.push({ id: r.id });
	}
	return { version: 1, requirements, ...(p.platformRoot !== undefined ? { platformRoot: p.platformRoot as string } : {}) };
}

export function serializeProject(project: SysProject): string {
	return JSON.stringify(project, null, 2) + '\n';
}

/** Ids are sequential and never reused within a project's lifetime of ids present: REQ-001, ... independent of text. */
export function addRequirement(project: SysProject): { project: SysProject; id: string } {
	const next = project.requirements.reduce((max, r) => Math.max(max, Number(r.id.slice(4))), 0) + 1;
	const id = `REQ-${String(next).padStart(3, '0')}`;
	return { id, project: { ...project, requirements: [...project.requirements, { id }] } };
}

export function setPlatformRoot(project: SysProject, platformRoot: string | undefined): SysProject {
	const { platformRoot: _old, ...rest } = project;
	return platformRoot ? { ...rest, platformRoot } : rest;
}

export function removeRequirement(project: SysProject, id: string): SysProject {
	return { ...project, requirements: project.requirements.filter(r => r.id !== id) };
}

export function titleOf(text: string): string {
	return text.split(/\r?\n/).map(l => l.replace(/^#+\s*/, '').trim()).find(l => l) ?? '(empty)';
}

/**
 * `read` returns undefined when the file does not exist and throws on any other I/O failure.
 * `lifecycleOf` asks sys-core for a requirement's lifecycle and yields undefined when core cannot answer,
 * in which case the row says so instead of inventing a state.
 * `folders` are workspace folder paths/URIs; the file is resolved under the single folder.
 */
export async function loadProjectState(
	folders: readonly string[],
	read: (path: string) => Promise<string | undefined>,
	lifecycleOf: (id: string) => Promise<SysLifecycle | undefined>
): Promise<SysProjectState> {
	if (folders.length === 0) { return { kind: 'NO_WORKSPACE' }; }
	if (folders.length > 1) { return { kind: 'UNSUPPORTED_MULTI_ROOT_WORKSPACE' }; }
	const root = folders[0].replace(/\/$/, '');
	try {
		const text = await read(`${root}/${SYS_PROJECT_FILE}`);
		if (text === undefined) { return { kind: 'NO_SYS_PROJECT_YET' }; }
		const project = parseProject(text);
		if ('malformed' in project) { return { kind: 'MALFORMED_SYS_PROJECT', reason: project.malformed }; }
		const rows: SysRequirementRow[] = [];
		for (const ref of project.requirements) {
			const body = await read(`${root}/${requirementFile(ref.id)}`);
			const hasSpec = await read(`${root}/${specFile(ref.id)}`) !== undefined;
			const lifecycle = await lifecycleOf(ref.id);
			rows.push({
				id: ref.id,
				title: body === undefined ? '(file missing)' : titleOf(body),
				status: lifecycle?.requirement.approved ? 'APPROVED_UNFORMALIZED' : 'DRAFT_UNFORMALIZED',
				missing: body === undefined,
				hasSpec,
				...(lifecycle ? { structuredIntentState: lifecycle.structuredIntent.state, formalSpecState: lifecycle.formalSpec.state } : { lifecycleUnavailable: true as const })
			});
		}
		return { kind: 'READY', project, rows };
	} catch (e) {
		return { kind: 'IO_ERROR', reason: String(e) };
	}
}
