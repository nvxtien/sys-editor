import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IFileService, FileOperation, FileOperationError, FileOperationResult } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { URI } from '../../../../base/common/uri.js';
import { EMPTY_PROJECT, SYS_PROJECT_FILE, SysProject, SysProjectState, addRequirement, approveRequirement, loadProjectState, removeRequirement, requirementFile, serializeProject, setOperation } from '../common/sysProject.js';

export const ISysProjectService = createDecorator<ISysProjectService>('sysProjectService');

export interface ISysProjectService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;
	/** State of the CURRENT workspace, read fresh each call. */
	getState(): Promise<SysProjectState>;
	/** Creates an empty requirement file and returns it, ready to be opened in the editor. */
	createRequirement(): Promise<URI>;
	resourceOf(id: string): URI;
	approveRequirement(id: string): Promise<void>;
	deleteRequirement(id: string): Promise<void>;
	/** `operation` is already validated by parseOperation; undefined unbinds. */
	setOperation(id: string, operation: string | undefined): Promise<void>;
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
			if (e.changes.some(c => c.resource.path.includes('/.sys/'))) { this._onDidChange.fire(); }
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

	async setOperation(id: string, operation: string | undefined): Promise<void> {
		await this.save(setOperation(await this.writable(), id, operation));
	}

	async deleteRequirement(id: string): Promise<void> {
		const project = await this.writable();
		await this.files.del(this.resourceOf(id)).catch(e => {
			if (!(e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_NOT_FOUND)) { throw e; }
		});
		await this.save(removeRequirement(project, id));
	}
}

registerSingleton(ISysProjectService, SysProjectService, InstantiationType.Delayed);
