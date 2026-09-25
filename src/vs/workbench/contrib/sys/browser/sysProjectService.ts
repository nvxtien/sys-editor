import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IFileService, FileOperation, FileOperationError, FileOperationResult, FileSystemProviderErrorCode, toFileSystemProviderErrorCode } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { renderStructuredIntentReview } from '../common/sysStructuredIntentReview.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { URI } from '../../../../base/common/uri.js';
import { EMPTY_PROJECT, SYS_PROJECT_FILE, SysProject, SysProjectState, addRequirement, loadProjectState, removeRequirement, requirementFile, serializeProject, setPlatformRoot, specFile } from '../common/sysProject.js';
import { isSysArtifactState, parseLifecycle, SysLifecycle } from '../common/sysLifecycle.js';
import { parseFormalizationCapability, parseStructuredIntent, serializeStructuredIntent, SysFormalizationCapability, SysStructuredIntent, SysStructuredIntentRecord } from '../common/sysStructuredIntent.js';
import { Verification01Manifest } from '../common/sysManifest.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { fetchServer, resolveServerEndpoint, waitForServerEndpoint } from '../../sidexChat/browser/localServer.js';

export const ISysProjectService = createDecorator<ISysProjectService>('sysProjectService');

export interface ISysProjectService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;
	/** State of the CURRENT workspace, read fresh each call. */
	getState(): Promise<SysProjectState>;
	/** Asks sys-core what can be formalized for this requirement's Structured Intent; undefined when core cannot answer (never assumed). */
	formalizationCapability(id: string): Promise<SysFormalizationCapability | undefined>;
	/** Creates an empty requirement file and returns it, ready to be opened in the editor. */
	createRequirement(): Promise<URI>;
	resourceOf(id: string): URI;
	resourceOfSpec(id: string): URI;
	/** Regenerates the plain-language review page from the Structured Intent JSON and returns its resource. */
	writeStructuredIntentReview(id: string): Promise<URI>;
	/** Creates an empty .spec file (if absent) and returns it, ready to be opened in the editor. */
	createSpec(id: string): Promise<URI>;
	/** Approves the exact current requirement text in sys-core. */
	approveRequirement(id: string): Promise<void>;
	readStructuredIntent(id: string): Promise<SysStructuredIntentRecord | undefined>;
	saveRequirement(id: string, raw: string): Promise<void>;
	prepareStructuredIntentContext(id: string): Promise<string>;
	prepareFormalSpecContext(id: string): Promise<string>;
	/** Saves the requirement text and the model's candidate in sys-core as a new draft (any earlier approval is revoked there). */
	writeStructuredIntent(id: string, draft: SysStructuredIntent): Promise<void>;
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
		@IFileService private readonly files: IFileService,
		@IConfigurationService private readonly configuration: IConfigurationService
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
			if (e instanceof Error && toFileSystemProviderErrorCode(e) === FileSystemProviderErrorCode.FileNotFound) { return undefined; }
			throw e;
		}
	}

	async getState(): Promise<SysProjectState> {
		const state = await loadProjectState(this.folders().map(f => f.toString()), p => this.read(p), id => this.lifecycleOf(id));
		if (state.kind !== 'READY') { return state; }
		const rows = await Promise.all(state.rows.map(async row => row.lifecycleUnavailable || row.structuredIntentState === 'NOT_CREATED' ? row : { ...row, formalization: await this.formalizationCapability(row.id) }));
		return { ...state, rows };
	}

	/** The project registry and configuration only: no question is put to sys-core. */
	private loadProject(): Promise<SysProjectState> {
		return loadProjectState(this.folders().map(f => f.toString()), p => this.read(p), async () => undefined);
	}

	private async lifecycleOf(id: string): Promise<SysLifecycle | undefined> {
		try {
			return parseLifecycle(JSON.parse(await this.coreAnswer(['lifecycle', id])));
		} catch (error) {
			console.warn(`[SYS_LIFECYCLE] ${id}: ${error instanceof Error ? error.message : String(error)}`);
			return undefined;
		}
	}

	private coreAnswer(args: readonly string[]): Promise<string> {
		return Promise.race([
			this.coreResponse(args),
			new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sys-core did not answer in time')), 8000))
		]);
	}

	async formalizationCapability(id: string): Promise<SysFormalizationCapability | undefined> {
		try {
			return parseFormalizationCapability(JSON.parse(await this.coreAnswer(['intent', 'capability', id])));
		} catch (error) {
			console.warn(`[SYS_CAPABILITY] ${id}: ${error instanceof Error ? error.message : String(error)}`);
			return undefined;
		}
	}

	resourceOf(id: string): URI {
		return URI.joinPath(this.folders()[0], requirementFile(id));
	}

	resourceOfSpec(id: string): URI {
		return URI.joinPath(this.folders()[0], specFile(id));
	}

	async writeStructuredIntentReview(id: string): Promise<URI> {
		const record = await this.readStructuredIntent(id);
		if (!record) { throw new Error('Structured Intent has not been normalized yet.'); }
		const folder = URI.joinPath(this.folders()[0], '.sys', 'intents');
		const resource = URI.joinPath(folder, `${id}.intent.review.md`);
		await this.files.createFolder(folder);
		await this.files.writeFile(resource, VSBuffer.fromString(renderStructuredIntentReview(record, await this.formalizationCapability(id))));
		return resource;
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
		const state = await this.loadProject();
		if (state.kind === 'READY') { return state.project; }
		if (state.kind === 'NO_SYS_PROJECT_YET') { return EMPTY_PROJECT; }
		throw new Error(`cannot change Sys project: ${state.kind}`);
	}

	private async save(project: SysProject): Promise<void> {
		await this.files.writeFile(URI.joinPath(this.folders()[0], SYS_PROJECT_FILE), VSBuffer.fromString(serializeProject(project)));
		this._onDidChange.fire();
	}

	private async coreResponse(args: readonly string[], input?: string): Promise<string> {
		const configured = this.configuration.getValue<string>('sidex.chat.serverUrl');
		if (configured?.trim()) { await resolveServerEndpoint(); } else { await waitForServerEndpoint(); }
		const response = await fetchServer(configured, '/v1/sys/core', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ workspace: this.folders()[0].fsPath, args, ...(input === undefined ? {} : { input }) })
		});
		if (!response.ok) { throw new Error(`sys-core failed (${response.status}): ${await response.text()}`); }
		return response.text();
	}

	private async core(args: readonly string[], input?: string): Promise<void> {
		await this.coreResponse(args, input);
	}

	async createRequirement(): Promise<URI> {
		const { project, id } = addRequirement(await this.writable());
		const resource = this.resourceOf(id);
		await this.files.writeFile(resource, VSBuffer.fromString(''));
		await this.save(project);
		return resource;
	}

	async approveRequirement(id: string): Promise<void> {
		await this.core(['requirement', 'approve-current', id]);
		this._onDidChange.fire();
	}

	async readStructuredIntent(id: string): Promise<SysStructuredIntentRecord | undefined> {
		let reply: string;
		try {
			reply = await this.coreResponse(['intent', 'show', id]);
		} catch (error) {
			if (error instanceof Error && error.message.includes('MissingIntent')) { return undefined; }
			throw error;
		}
		const shown = JSON.parse(reply) as { draft?: unknown; identity?: unknown; state?: unknown };
		if (!isSysArtifactState(shown.state) || typeof shown.identity !== 'string') { throw new Error('sys-core returned an invalid Structured Intent view'); }
		return { sourceRequirement: await this.read(this.resourceOf(id).toString()) ?? '', draft: parseStructuredIntent(shown.draft, id), state: shown.state, identity: shown.identity };
	}

	async saveRequirement(id: string, raw: string): Promise<void> {
		await this.core(['requirement', 'save', id], raw);
	}

	async writeStructuredIntent(id: string, draft: SysStructuredIntent): Promise<void> {
		const requirement = await this.read(this.resourceOf(id).toString());
		if (requirement === undefined) { throw new Error(`Requirement file for ${id} is missing.`); }
		await this.core(['requirement', 'save', id], requirement);
		await this.core(['intent', 'accept', id], serializeStructuredIntent(draft));
		this._onDidChange.fire();
	}

	async prepareStructuredIntentContext(id: string): Promise<string> {
		return this.coreResponse(['intent', 'prepare', id]);
	}

	async prepareFormalSpecContext(id: string): Promise<string> {
		return this.coreResponse(['spec', 'prepare', id]);
	}

	async approveStructuredIntent(id: string): Promise<void> {
		await this.core(['intent', 'approve-current', id]);
		this._onDidChange.fire();
	}

	async approveSpec(id: string): Promise<void> {
		const spec = await this.read(this.resourceOfSpec(id).toString());
		if (!spec?.trim()) { throw new Error('Formal Spec is empty.'); }
		const intent = await this.readStructuredIntent(id);
		const capability = await this.formalizationCapability(id);
		if (!intent || intent.state !== 'APPROVED' || capability?.outcome !== 'FORMAL_SPEC_SUPPORTED') { throw new Error('Approve a Structured Intent whose kind the platform can formalize before approving the Formal Spec.'); }
		await this.core(['spec', 'approve-current', id]);
		this._onDidChange.fire();
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
		const state = await this.loadProject();
		return state.kind === 'READY' ? state.project.platformRoot : undefined;
	}

	async deleteRequirement(id: string): Promise<void> {
		const project = await this.writable();
		const ignoreMissing = (e: unknown) => { if (!(e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_NOT_FOUND)) { throw e; } };
		await this.files.del(this.resourceOf(id)).catch(ignoreMissing);
		await this.files.del(this.resourceOfSpec(id)).catch(ignoreMissing);
		await this.files.del(URI.joinPath(this.folders()[0], '.sys', 'intents', `${id}.intent.review.md`)).catch(ignoreMissing);
		await this.save(removeRequirement(project, id));
	}
}

registerSingleton(ISysProjectService, SysProjectService, InstantiationType.Delayed);
