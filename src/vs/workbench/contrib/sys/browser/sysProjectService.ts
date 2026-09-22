import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IFileService, FileOperation, FileOperationError, FileOperationResult } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { URI } from '../../../../base/common/uri.js';
import { EMPTY_PROJECT, SYS_PROJECT_FILE, SysProject, SysProjectState, addRequirement, approveRequirement, loadProjectState, removeRequirement, requirementFile, serializeProject, setPlatformRoot, specFile, structuredIntentFile } from '../common/sysProject.js';
import { approveStructuredIntent, canGenerateFormalSpec, parseStructuredIntent, serializeStructuredIntent, SysStructuredIntent, SysStructuredIntentRecord } from '../common/sysStructuredIntent.js';
import { Verification01Manifest } from '../common/sysManifest.js';

export const ISysProjectService = createDecorator<ISysProjectService>('sysProjectService');

export interface ISysProjectService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;
	/** State of the CURRENT workspace, read fresh each call. */
	getState(): Promise<SysProjectState>;
	/** Creates an empty requirement file and returns it, ready to be opened in the editor. */
	createRequirement(): Promise<URI>;
	resourceOf(id: string): URI;
	resourceOfSpec(id: string): URI;
	resourceOfStructuredIntent(id: string): URI;
	/** Creates an empty .spec file (if absent) and returns it, ready to be opened in the editor. */
	createSpec(id: string): Promise<URI>;
	approveRequirement(id: string): Promise<void>;
	readStructuredIntent(id: string): Promise<SysStructuredIntentRecord | undefined>;
	writeStructuredIntent(id: string, sourceRequirement: string, draft: SysStructuredIntent): Promise<void>;
	approveStructuredIntent(id: string): Promise<void>;
	approveSpec(id: string): Promise<void>;
	deleteRequirement(id: string): Promise<void>;
	setPlatformRoot(path: string | undefined): Promise<void>;
	/** '' from getState() when not configured; the READY/NO_SYS_PROJECT_YET project's platformRoot. */
	getPlatformRoot(): Promise<string | undefined>;
	/** Writes a one-rule manifest for a single requirement's Verify run to .sys/verification/<id>.manifest.json. */
	writeManifest(id: string, manifest: Verification01Manifest): Promise<URI>;
}

class SysProjectService extends Disposable implements ISysProjectService {
	readonly _serviceBrand: undefined;
	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	constructor(
		@IWorkspaceContextService private readonly workspace: IWorkspaceContextService,
		@IFileService private readonly files: IFileService
	) {
		super();
		this._register(workspace.onDidChangeWorkspaceFolders(() => this._onDidChange.fire()));
		// Editing a requirement in the editor changes its derived status, so watch .sys/ too.
		// The OS watcher may not report saves made from this window, so also listen to the operations it runs itself.
		this._register(files.onDidFilesChange(e => {
			if (this.folders().some(f => e.affects(URI.joinPath(f, '.sys')))) { this._onDidChange.fire(); }
		}));
		this._register(files.onDidRunOperation(e => {
			if ((e.isOperation(FileOperation.WRITE) || e.isOperation(FileOperation.CREATE) || e.isOperation(FileOperation.DELETE)) && e.resource.path.includes('/.sys/')) { this._onDidChange.fire(); }
		}));
	}

	private folders(): URI[] {
		return this.workspace.getWorkspace().folders.map(f => f.uri);
	}

	private async read(uriString: string): Promise<string | undefined> {
		try {
			return (await this.files.readFile(URI.parse(uriString))).value.toString();
		} catch (e) {
			if (e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) { return undefined; }
			throw e;
		}
	}

	getState(): Promise<SysProjectState> {
		return loadProjectState(this.folders().map(f => f.toString()), p => this.read(p));
	}

	resourceOf(id: string): URI {
		return URI.joinPath(this.folders()[0], requirementFile(id));
	}

	resourceOfSpec(id: string): URI {
		return URI.joinPath(this.folders()[0], specFile(id));
	}

	resourceOfStructuredIntent(id: string): URI {
		return URI.joinPath(this.folders()[0], structuredIntentFile(id));
	}

	async createSpec(id: string): Promise<URI> {
		const resource = this.resourceOfSpec(id);
		if (!await this.files.exists(resource)) {
			await this.files.writeFile(resource, VSBuffer.fromString(''));
			this._onDidChange.fire();
		}
		return resource;
	}

	/** Only "no project yet" or a valid project is writable; malformed/multi-root/no-workspace state is never overwritten. */
	private async writable(): Promise<SysProject> {
		const state = await this.getState();
		if (state.kind === 'READY') { return state.project; }
		if (state.kind === 'NO_SYS_PROJECT_YET') { return EMPTY_PROJECT; }
		throw new Error(`cannot change Sys project: ${state.kind}`);
	}

	private async save(project: SysProject): Promise<void> {
		await this.files.writeFile(URI.joinPath(this.folders()[0], SYS_PROJECT_FILE), VSBuffer.fromString(serializeProject(project)));
		this._onDidChange.fire();
	}

	async createRequirement(): Promise<URI> {
		const { project, id } = addRequirement(await this.writable());
		const resource = this.resourceOf(id);
		await this.files.writeFile(resource, VSBuffer.fromString(''));
		await this.save(project);
		return resource;
	}

	async approveRequirement(id: string): Promise<void> {
		const project = await this.writable();
		const text = await this.read(this.resourceOf(id).toString());
		await this.save(approveRequirement(project, id, text ?? ''));
	}

	async readStructuredIntent(id: string): Promise<SysStructuredIntentRecord | undefined> {
		const text = await this.read(this.resourceOfStructuredIntent(id).toString());
		if (text === undefined) { return undefined; }
		const raw = JSON.parse(text) as { sourceRequirement?: unknown; draft?: unknown; approvedContent?: unknown };
		return {
			sourceRequirement: typeof raw.sourceRequirement === 'string' ? raw.sourceRequirement : '',
			draft: parseStructuredIntent(raw.draft, id),
			approvedContent: typeof raw.approvedContent === 'string' ? raw.approvedContent : undefined,
		};
	}

	async writeStructuredIntent(id: string, sourceRequirement: string, draft: SysStructuredIntent): Promise<void> {
		const resource = this.resourceOfStructuredIntent(id);
		await this.files.createFolder(URI.joinPath(this.folders()[0], '.sys', 'intents'));
		await this.files.writeFile(resource, VSBuffer.fromString(JSON.stringify({ sourceRequirement, draft: JSON.parse(serializeStructuredIntent(draft)) }, null, 2) + '\n'));
		this._onDidChange.fire();
	}

	async approveStructuredIntent(id: string): Promise<void> {
		const record = await this.readStructuredIntent(id);
		if (!record) { throw new Error('Structured Intent has not been normalized yet.'); }
		const requirement = await this.read(this.resourceOf(id).toString()) ?? '';
		const approved = approveStructuredIntent(record, requirement);
		await this.files.writeFile(this.resourceOfStructuredIntent(id), VSBuffer.fromString(JSON.stringify({ sourceRequirement: approved.sourceRequirement, draft: JSON.parse(serializeStructuredIntent(approved.draft)), approvedContent: approved.approvedContent }, null, 2) + '\n'));
		this._onDidChange.fire();
	}

	async approveSpec(id: string): Promise<void> {
		const project = await this.writable();
		const spec = await this.read(this.resourceOfSpec(id).toString()) ?? '';
		if (!spec.trim()) { throw new Error('Formal Spec is empty.'); }
		const intent = await this.readStructuredIntent(id);
		const requirement = await this.read(this.resourceOf(id).toString()) ?? '';
		if (!intent || !canGenerateFormalSpec(intent, requirement)) { throw new Error('Approve the Structured Intent and bind its operation before approving the Formal Spec.'); }
		await this.save({ ...project, requirements: project.requirements.map(ref => ref.id === id ? { ...ref, approvedSpecText: spec, approvedSpecIntent: serializeStructuredIntent(intent.draft) } : ref) });
	}

	async setPlatformRoot(path: string | undefined): Promise<void> {
		await this.save(setPlatformRoot(await this.writable(), path));
	}

	async writeManifest(id: string, manifest: Verification01Manifest): Promise<URI> {
		const resource = URI.joinPath(this.folders()[0], '.sys', 'verification', `${id}.manifest.json`);
		await this.files.writeFile(resource, VSBuffer.fromString(JSON.stringify(manifest, null, 2) + '\n'));
		return resource;
	}

	async getPlatformRoot(): Promise<string | undefined> {
		const state = await this.getState();
		return state.kind === 'READY' ? state.project.platformRoot : undefined;
	}

	async deleteRequirement(id: string): Promise<void> {
		const project = await this.writable();
		const ignoreMissing = (e: unknown) => { if (!(e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_NOT_FOUND)) { throw e; } };
		await this.files.del(this.resourceOf(id)).catch(ignoreMissing);
		await this.files.del(this.resourceOfSpec(id)).catch(ignoreMissing);
		await this.save(removeRequirement(project, id));
	}
}

registerSingleton(ISysProjectService, SysProjectService, InstantiationType.Delayed);
