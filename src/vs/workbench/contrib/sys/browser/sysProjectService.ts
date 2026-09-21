import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IFileService, FileOperationError, FileOperationResult } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { URI } from '../../../../base/common/uri.js';
import { EMPTY_PROJECT, SYS_PROJECT_FILE, SysProjectState, addRequirement, approveRequirement, loadProjectState, serializeProject } from '../common/sysProject.js';

export const ISysProjectService = createDecorator<ISysProjectService>('sysProjectService');

export interface ISysProjectService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;
	/** State of the CURRENT workspace, read fresh each call. */
	getState(): Promise<SysProjectState>;
	createRequirement(text: string): Promise<void>;
	approveRequirement(id: string): Promise<void>;
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
	}

	private folders(): URI[] {
		return this.workspace.getWorkspace().folders.map(f => f.uri);
	}

	getState(): Promise<SysProjectState> {
		const folders = this.folders();
		return loadProjectState(folders.map(f => f.toString()), async uriString => {
			try {
				return (await this.files.readFile(URI.parse(uriString))).value.toString();
			} catch (e) {
				if (e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) { return undefined; }
				throw e;
			}
		});
	}

	private async update(change: (project: typeof EMPTY_PROJECT) => typeof EMPTY_PROJECT): Promise<void> {
		const state = await this.getState();
		// Never write over a malformed/unsupported state: only "no project yet" or a valid one is writable.
		const base = state.kind === 'READY' ? state.project : state.kind === 'NO_SYS_PROJECT_YET' ? EMPTY_PROJECT : undefined;
		if (!base) { throw new Error(`cannot save Sys project: ${state.kind}`); }
		const target = URI.joinPath(this.folders()[0], SYS_PROJECT_FILE);
		await this.files.writeFile(target, VSBuffer.fromString(serializeProject(change(base))));
		this._onDidChange.fire();
	}

	createRequirement(text: string): Promise<void> { return this.update(p => addRequirement(p, text)); }
	approveRequirement(id: string): Promise<void> { return this.update(p => approveRequirement(p, id)); }
}

registerSingleton(ISysProjectService, SysProjectService, InstantiationType.Delayed);
