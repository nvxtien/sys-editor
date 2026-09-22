/**
 * Workspace-owned Sys project state.
 *   .sys/requirements/<id>.md  human-authored text (edited in the normal editor)
 *   .sys/project.json          tool-owned: which requirements exist and the exact text a human approved
 * Nothing here is formalized or verified.
 */
export const SYS_PROJECT_FILE = '.sys/project.json';
export const SYS_REQUIREMENTS_DIR = '.sys/requirements';
export const requirementFile = (id: string) => `${SYS_REQUIREMENTS_DIR}/${id}.md`;

export type SysRequirementStatus = 'DRAFT_UNFORMALIZED' | 'APPROVED_UNFORMALIZED';
export interface SysRequirementRef { readonly id: string; readonly approvedText?: string; readonly operation?: string }
export interface SysProject { readonly version: 1; readonly requirements: readonly SysRequirementRef[]; readonly platformRoot?: string }
export interface SysRequirementRow { readonly id: string; readonly title: string; readonly status: SysRequirementStatus; readonly missing: boolean; readonly operation?: string }

export type SysProjectState =
	| { readonly kind: 'NO_WORKSPACE' }
	| { readonly kind: 'UNSUPPORTED_MULTI_ROOT_WORKSPACE' }
	| { readonly kind: 'NO_SYS_PROJECT_YET' }
	| { readonly kind: 'READY'; readonly project: SysProject; readonly rows: readonly SysRequirementRow[] }
	| { readonly kind: 'MALFORMED_SYS_PROJECT'; readonly reason: string }
	| { readonly kind: 'IO_ERROR'; readonly reason: string };

const OPERATION = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/;

/** Empty text means "unbind". The name is human intent and is never looked up in source. */
export function parseOperation(text: string): { operation: string | undefined } | { error: string } {
	const t = text.trim();
	if (!t) { return { operation: undefined }; }
	return OPERATION.test(t) ? { operation: t } : { error: 'Use a qualified name like BookingService.createBooking' };
}

export const EMPTY_PROJECT: SysProject = { version: 1, requirements: [] };

export function parseProject(text: string): SysProject | { readonly malformed: string } {
	const bad = (malformed: string) => ({ malformed });
	let raw: unknown;
	try { raw = JSON.parse(text); } catch (e) { return bad(`not valid JSON: ${(e as Error).message}`); }
	const p = raw as { version?: unknown; requirements?: unknown; platformRoot?: unknown } | null;
	if (!p || p.version !== 1 || !Array.isArray(p.requirements) || (p.platformRoot !== undefined && typeof p.platformRoot !== 'string')) { return bad('expected {"version":1,"requirements":[...],"platformRoot"?:string}'); }
	const ids = new Set<string>();
	for (const r of p.requirements as Record<string, unknown>[]) {
		if (!r || typeof r.id !== 'string' || !/^REQ-\d+$/.test(r.id) || (r.approvedText !== undefined && typeof r.approvedText !== 'string')
			|| (r.operation !== undefined && (typeof r.operation !== 'string' || !OPERATION.test(r.operation)))) { return bad('requirement needs an id like REQ-001, an optional string approvedText and an optional Class.method operation'); }
		if (ids.has(r.id)) { return bad(`duplicate requirement id ${r.id}`); }
		ids.add(r.id);
	}
	return p as SysProject;
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

/** A human approves the exact current text. */
export function approveRequirement(project: SysProject, id: string, currentText: string): SysProject {
	if (!project.requirements.some(r => r.id === id)) { throw new Error(`unknown requirement ${id}`); }
	if (!currentText.trim()) { throw new Error('cannot approve an empty requirement'); }
	return { ...project, requirements: project.requirements.map(r => r.id === id ? { ...r, approvedText: currentText } : r) };
}

export function setPlatformRoot(project: SysProject, platformRoot: string | undefined): SysProject {
	const { platformRoot: _old, ...rest } = project;
	return platformRoot ? { ...rest, platformRoot } : rest;
}

export function setOperation(project: SysProject, id: string, operation: string | undefined): SysProject {
	if (!project.requirements.some(r => r.id === id)) { throw new Error(`unknown requirement ${id}`); }
	return { ...project, requirements: project.requirements.map(r => {
		if (r.id !== id) { return r; }
		const { operation: _old, ...rest } = r;
		return operation === undefined ? rest : { ...rest, operation };
	}) };
}

export function removeRequirement(project: SysProject, id: string): SysProject {
	return { ...project, requirements: project.requirements.filter(r => r.id !== id) };
}

/** Derived, never stored: an approval only counts while the text is exactly what was approved. */
export function statusOf(ref: SysRequirementRef, currentText: string | undefined): SysRequirementStatus {
	return currentText !== undefined && currentText.trim() !== '' && ref.approvedText === currentText ? 'APPROVED_UNFORMALIZED' : 'DRAFT_UNFORMALIZED';
}

export function titleOf(text: string): string {
	return text.split(/\r?\n/).map(l => l.replace(/^#+\s*/, '').trim()).find(l => l) ?? '(empty)';
}

/**
 * `read` returns undefined when the file does not exist and throws on any other I/O failure.
 * `folders` are workspace folder paths/URIs; the file is resolved under the single folder.
 */
export async function loadProjectState(folders: readonly string[], read: (path: string) => Promise<string | undefined>): Promise<SysProjectState> {
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
			rows.push({ id: ref.id, title: body === undefined ? '(file missing)' : titleOf(body), status: statusOf(ref, body), missing: body === undefined, ...(ref.operation ? { operation: ref.operation } : {}) });
		}
		return { kind: 'READY', project, rows };
	} catch (e) {
		return { kind: 'IO_ERROR', reason: String(e) };
	}
}
