import './media/sysSemanticWorkbench.css';
import * as DOM from '../../../../base/browser/dom.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IFileService, FileOperationError, FileOperationResult } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { isAbsolute, relative, sep } from '../../../../base/common/path.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { ViewPane, IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { ISysProjectService } from './sysProjectService.js';
import { SysRequirementRow } from '../common/sysProject.js';
import { SpecCheckResult, runSpecCheck } from '../common/sysSpecCheck.js';
import { buildManifest, validateTargetOperation } from '../common/sysManifest.js';
import { ISysVerificationDataProvider } from './sysVerificationProviderService.js';
import { SYS_VERIFICATION_VIEW_ID } from '../common/sysViewIds.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { TaskProcessTransport } from './sysVerificationProviderService.js';
import { ISideXTaskService } from '../../../../platform/sidex/common/sidexTaskService.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { decodePendingProposal, canApplySysProposal, isSysWorkspaceMissing, validateDraftCandidate } from '../common/sysPlatformFlow.js';
import { ISidexChatService } from '../../sidexChat/browser/sidexChatService.js';
import { resolveServerEndpoint, serverHttpUrl, waitForServerEndpoint } from '../../sidexChat/browser/localServer.js';
import { assertSysDraftOperationBinding, assertSysDraftServerAvailable, requestSysFormalSpecDraft } from '../common/sysFormalSpecDraft.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { ISysSemanticSnapshotService, SysProjectSnapshot } from '../common/sysSemanticSnapshot.js';
import {
	ISysIntentActionService,
	SysIntentItem,
	SysIntentItemDetails,
	SysIntentStatus
} from '../common/sysIntentAction.js';

const $ = DOM.$;

export class SysSemanticWorkbenchView extends ViewPane {
	private readonly specChecks = new Map<string, SpecCheckResult>();
	private intentItems: readonly SysIntentItem[] = [];
	private snapshot: SysProjectSnapshot | undefined;
	private bodyContainer: HTMLElement | undefined;
	private currentDetailId: string | undefined;
	private currentDetails: SysIntentItemDetails | undefined;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@ISysSemanticSnapshotService private readonly snapshotService: ISysSemanticSnapshotService,
		@ISysIntentActionService private readonly intentActionService: ISysIntentActionService,
		@ISysProjectService private readonly projectService: ISysProjectService,
		@IEditorService private readonly editorService: IEditorService,
		@IDialogService private readonly dialogService: IDialogService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@IFileService private readonly fileService: IFileService,
		@ISideXTaskService private readonly taskService: ISideXTaskService,
		@ISysVerificationDataProvider private readonly verificationDataProvider: ISysVerificationDataProvider,
		@ISidexChatService private readonly sidexChatService: ISidexChatService,
		@IViewsService private readonly viewsService: IViewsService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService
	) {
		super(
			options,
			keybindingService,
			contextMenuService,
			configurationService,
			contextKeyService,
			viewDescriptorService,
			instantiationService,
			openerService,
			themeService,
			hoverService
		);

		this._register(this.projectService.onDidChange(() => void this._renderProject()));
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('sys.demoMode') && this.bodyContainer) {
				this.loadState = 'IDLE';
				this.renderBody(this.bodyContainer);
			}
		}));

		// Subscribe to intent item changes
		this._register(
			this.intentActionService.onDidChangeIntentItems(() => {
				void this.load();
			})
		);
	}

	private async refresh(): Promise<void> {
		// Use load() to properly handle errors and loading state
		await this.load();
	}

	private loadState: 'IDLE' | 'LOADING' | 'READY' | 'ERROR' = 'IDLE';
	private loadPromise: Promise<void> | undefined;
	private loadError: string | undefined;

	protected override renderBody(parent: HTMLElement): void {
		console.info('[SYS_LOAD_01] renderBody entered');
		this.bodyContainer = parent;
		super.renderBody(parent);
		parent.classList.add('sys-semantic-workbench');

		// The Cinema fixture is demo data: opt-in only, never the fallback for a workspace without Sys state.
		if (!this._demoMode()) {
			void this._renderProject();
			return;
		}

		// If showing detail, render detail; otherwise render list or error
		if (this.currentDetailId && this.currentDetails) {
			this._renderDetail(parent, this.currentDetails);
		} else if (this.loadState === 'READY' && this.snapshot) {
			this._renderSnapshot(parent, this.snapshot);
		} else if (this.loadState === 'ERROR') {
			this._renderError(parent);
		} else if (this.loadState === 'LOADING') {
			this._renderLoading(parent);
		} else {
			this._renderLoading(parent);
			void this.load();
		}
	}

	private _demoMode(): boolean {
		return this.configurationService.getValue<boolean>('sys.demoMode') === true;
	}

	private async _renderProject(): Promise<void> {
		if (this._demoMode() || !this.bodyContainer) {
			return;
		}
		const parent = this.bodyContainer;
		const state = await this.projectService.getState();
		if (this._demoMode()) {
			return;
		}
		parent.textContent = '';
		parent.classList.remove('sys-loading');
		const note = (text: string) => { DOM.append(parent, $('p')).textContent = text; };
		switch (state.kind) {
			case 'NO_WORKSPACE': note('Open a folder to start a Sys project.'); return;
			case 'UNSUPPORTED_MULTI_ROOT_WORKSPACE': note('Sys projects are not supported in multi-root workspaces yet.'); return;
			case 'MALFORMED_SYS_PROJECT': note(`.sys/project.json is malformed: ${state.reason}`); return;
			case 'IO_ERROR': note(`Cannot read Sys project state: ${state.reason}`); return;
			case 'NO_SYS_PROJECT_YET': {
				const section = DOM.append(parent, this._section('Get started'));
				DOM.append(section, $('p')).textContent = 'No governed requirements yet. Create the first requirement for this workspace.';
				this._action(section, 'Create first requirement', 'sys-error-retry-btn', () => this._createRequirement());
				return;
			}
			case 'READY': {
				const section = DOM.append(parent, this._section('Requirements'));
				DOM.append(section, $('p')).textContent = 'Save a plain-language requirement, generate a draft Formal Spec, review and approve it, then inspect the independently verified code proposal before applying.';
				for (const row of state.rows) {
					this._renderRequirementRow(section, row);
				}
				this._action(section, 'New requirement', 'sys-error-retry-btn', () => this._createRequirement());
				this._renderPlatformRow(parent, state.project.platformRoot);
			}
		}
	}

	private _renderPlatformRow(parent: HTMLElement, platformRoot: string | undefined): void {
		const section = DOM.append(parent, this._section('Code check'));
		DOM.append(section, $('p.sys-error-message')).textContent = platformRoot
			? `sys-platform checkout: ${platformRoot}`
			: 'No sys-platform checkout configured yet. Set it here, or the first "Check" will ask for it.';
		this._action(section, platformRoot ? 'Change' : 'Set sys-platform path', 'sys-req-action', async () => {
			const next = await this._promptPlatformRoot(platformRoot);
			if (next !== undefined) { await this.projectService.setPlatformRoot(next); }
		});
	}

	/**
	 * Asks for the checkout of the sys-platform TOOL that runs the code check — a separate repo on disk,
	 * never this workspace (the project being checked is taken from the open folder automatically).
	 */
	private async _promptPlatformRoot(current: string | undefined): Promise<string | undefined> {
		const input = await this.quickInputService.input({
			title: 'sys-platform checkout (developer tool, not this project)',
			prompt: 'Absolute path to your sys-platform repo checkout — the tool that reads your code, built with ./scripts/build.sh. Not the folder you have open here.',
			value: current ?? '',
			placeHolder: '/path/to/sys-platform'
		});
		if (!input) { return undefined; }
		if (!await this.fileService.exists(URI.file(`${input}/build/classes`))) {
			throw new Error(`${input}/build/classes not found; run sys-platform's ./scripts/build.sh first`);
		}
		return input;
	}

	private _action(host: HTMLElement, label: string, cls: string, run: () => Promise<void>): HTMLButtonElement {
		const b = DOM.append(host, $(`button.${cls}`)) as HTMLButtonElement;
		b.textContent = label;
		b.addEventListener('click', e => {
			e.stopPropagation();
			void run().catch(err => {
				const slot = host.querySelector('.sys-form-error') ?? DOM.append(host, $('p.sys-error-message.sys-form-error'));
				slot.textContent = `${label} failed: ${err instanceof Error ? err.message : String(err)}`;
			});
		});
		return b;
	}

	private async _createRequirement(): Promise<void> {
		await this.editorService.openEditor({ resource: await this.projectService.createRequirement() });
	}

	private _projectRoot(): string {
		const root = this.workspaceContextService.getWorkspace().folders[0]?.uri.fsPath;
		if (!root) { throw new Error('Open a single project folder before using the Sys workflow.'); }
		return root;
	}

	private async _runSys(platformRoot: string, projectRoot: string, args: string[]): Promise<string> {
		const debug = URI.joinPath(URI.file(platformRoot), 'product-cli', 'target', 'debug', 'sys').fsPath;
		const release = URI.joinPath(URI.file(platformRoot), 'product-cli', 'target', 'release', 'sys').fsPath;
		const binary = await this.fileService.exists(URI.file(debug)) ? debug : release;
		if (!await this.fileService.exists(URI.file(binary))) {
			throw new Error(`Sys Platform CLI not found. Build it with: cargo build --manifest-path ${platformRoot}/product-cli/Cargo.toml`);
		}
		const transport = new TaskProcessTransport(this.taskService, this.fileService);
		const timeoutMs = this.configurationService.getValue<number>('sys.verification.timeoutMs') ?? 60000;
		const result = await transport.run(binary, args, timeoutMs, projectRoot);
		if (result.exitCode !== 0) {
			const detail = result.stderr.trim() || result.stdout.trim() || `sys exited with code ${result.exitCode}`;
			if (detail.includes('no Sys Platform workspace found')) {
				throw new Error('Initialize Sys Platform in this project first with `sys init .`.');
			}
			throw new Error(detail);
		}
		return result.stdout;
	}

	private async _platformRoot(): Promise<string | undefined> {
		const configured = await this.projectService.getPlatformRoot();
		if (configured) { return configured; }
		const selected = await this._promptPlatformRoot(undefined);
		if (selected) { await this.projectService.setPlatformRoot(selected); }
		return selected;
	}

	private async _ensurePlatformWorkspace(platformRoot: string, projectRoot: string): Promise<boolean> {
		try {
			await this._runSys(platformRoot, projectRoot, ['status', '--json']);
			return true;
		} catch (error) {
			if (!isSysWorkspaceMissing(error)) { throw error; }
			const { confirmed } = await this.dialogService.confirm({
				message: 'Initialize Sys Platform in this project?',
				detail: 'Sys Platform will create its workspace files under .sys. Existing requirements and other project files will be preserved.',
				primaryButton: 'Initialize project'
			});
			if (!confirmed) { return false; }
			await this._runSys(platformRoot, projectRoot, ['init', '.']);
			await this._runSys(platformRoot, projectRoot, ['status', '--json']);
			return true;
		}
	}

	private async _draftSpecFromRequirement(id: string): Promise<void> {
		const requirement = this.projectService.resourceOf(id);
		const intent = (await this.fileService.readFile(requirement)).value.toString();
		if (!intent.trim()) { throw new Error(`Add and save the plain-language requirement in ${requirement.fsPath} first.`); }
		const spec = this.projectService.resourceOfSpec(id);
		if (await this.fileService.exists(spec) && (await this.fileService.readFile(spec)).value.toString().trim()) {
			const { confirmed } = await this.dialogService.confirm({ message: 'Replace the current draft Formal Spec?', detail: 'The existing spec file will be replaced by a new Platform preview.', primaryButton: 'Replace draft' });
			if (!confirmed) { return; }
		}
		const platformRoot = await this._platformRoot();
		if (!platformRoot) { return; }
		const projectRoot = this._projectRoot();
		if (!await this._ensurePlatformWorkspace(platformRoot, projectRoot)) { return; }
		assertSysDraftOperationBinding(undefined);
		const model = this.sidexChatService.serverModel;
		if (!model) { throw new Error('Select a model in SideX Settings → Models before drafting a Formal Spec.'); }
		const configuredServerUrl = this.configurationService.getValue<string>('sidex.chat.serverUrl');
		const endpoint = configuredServerUrl?.trim() ? await resolveServerEndpoint() : await waitForServerEndpoint();
		assertSysDraftServerAvailable(endpoint.running, configuredServerUrl, endpoint.error);
		const httpUrl = serverHttpUrl(configuredServerUrl);
		const draft = await requestSysFormalSpecDraft(httpUrl, model, intent);
		const proposals = URI.joinPath(URI.file(projectRoot), '.sys', 'proposals');
		await this.fileService.createFolder(proposals);
		const candidatePath = URI.joinPath(proposals, `draft-${generateUuid()}.spec`).fsPath;
		const preview = await validateDraftCandidate(
			candidatePath,
			draft,
			async (path, text) => { await this.fileService.writeFile(URI.file(path), VSBuffer.fromString(text)); },
			path => this._runSys(platformRoot, projectRoot, ['requirement', '--file', requirement.fsPath, '--draft-file', path, '--draft-only', '--json']),
			async path => {
				try { await this.fileService.del(URI.file(path), { useTrash: false }); }
				catch (error) { if (!(error instanceof FileOperationError && error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND)) { throw error; } }
			}
		);
		await this.projectService.createSpec(id);
		await this.fileService.writeFile(spec, VSBuffer.fromString(preview.draftSpec));
		await this.editorService.openEditor({ resource: spec });
	}

	private async _approveSpecAndReviewProposal(id: string, title: string): Promise<void> {
		const requirement = this.projectService.resourceOf(id);
		const spec = this.projectService.resourceOfSpec(id);
		const intentText = (await this.fileService.readFile(requirement)).value.toString();
		const specText = (await this.fileService.readFile(spec)).value.toString();
		if (!intentText.trim() || !specText.trim()) { throw new Error('Save both the plain-language requirement and the reviewed Formal Spec before continuing.'); }
		const targetOperation = await this.quickInputService.input({
			title: `Target operation for ${id}`,
			prompt: 'The Class.method governed by this spec. This is sent to Sys Platform for independent verification.',
			placeHolder: 'ClassName.methodName',
			validateInput: async text => validateTargetOperation(text)
		});
		if (!targetOperation) { return; }
		const target = await this.fileDialogService.showOpenDialog({ title: 'Code file to update', canSelectFiles: true, canSelectFolders: false, canSelectMany: false });
		if (!target?.[0]) { return; }
		const sourceRoot = await this.fileDialogService.showOpenDialog({ title: 'Source root for independent verification', canSelectFiles: false, canSelectFolders: true, canSelectMany: false });
		if (!sourceRoot?.[0]) { return; }
		const projectRoot = this._projectRoot();
		const sourceRootRelative = relative(projectRoot, sourceRoot[0].fsPath);
		if (isAbsolute(sourceRootRelative) || sourceRootRelative === '..' || sourceRootRelative.startsWith(`..${sep}`)) {
			throw new Error('Choose a source root inside the open project folder.');
		}
		const platformRoot = await this._platformRoot();
		if (!platformRoot) { return; }
		if (!await this._ensurePlatformWorkspace(platformRoot, projectRoot)) { return; }
		const { confirmed } = await this.dialogService.confirm({
			message: `Approve the Formal Spec for ${title} and ask Sys Platform to generate and verify a code proposal?`,
			detail: specText,
			primaryButton: 'Approve spec'
		});
		if (!confirmed) { return; }
		await this._runSys(platformRoot, projectRoot, [
			'requirement', '--file', requirement.fsPath, '--draft-file', spec.fsPath, '--target-file', target[0].fsPath,
			'--target-operation', targetOperation, '--source-root', sourceRootRelative || '.', '--approve-spec', '--json'
		]);
		const proposalText = await this._runSys(platformRoot, projectRoot, ['proposal', 'show', '--json']);
		const proposal = decodePendingProposal(proposalText);
		const verified = canApplySysProposal(proposal);
		const summary = `Verification: ${proposal.verificationState}\nTarget: ${proposal.targetFile}\n\n${proposal.diff}`;
		if (!verified) {
			await this.dialogService.confirm({ message: 'Code proposal is not verified. It remains pending and cannot be applied.', detail: summary, primaryButton: 'Close' });
			return;
		}
		const apply = await this.dialogService.confirm({ message: 'Sys Platform verified this proposal. Apply the code change?', detail: summary, primaryButton: 'Apply verified code' });
		if (!apply.confirmed) { return; }
		const appliedText = await this._runSys(platformRoot, projectRoot, ['proposal', 'apply', '--approve-code', '--json']);
		let applied: unknown;
		try { applied = JSON.parse(appliedText); } catch { throw new Error('Sys Platform applied the proposal but returned invalid post-apply verification JSON.'); }
		await this.dialogService.confirm({ message: 'Sys Platform post-apply result', detail: JSON.stringify(applied, null, 2), primaryButton: 'Close' });
	}

	private _specLabel(check: SpecCheckResult | undefined): string {
		if (!check) { return 'syntax not checked'; }
		switch (check.kind) {
			case 'PARSE_OK': return 'parses';
			case 'PARSE_ERROR': return `does not parse: ${check.reason}`;
			case 'CHECK_ERROR': return `check failed: ${check.reason}`;
		}
	}

	/** Syntax only, via the exact binary spec-code-sync's own pipeline uses to compile the expected side. Never a semantic verdict. */
	private async _checkSpec(id: string): Promise<void> {
		const platformRoot = await this.projectService.getPlatformRoot() ?? await (async () => {
			const input = await this._promptPlatformRoot(undefined);
			if (input !== undefined) { await this.projectService.setPlatformRoot(input); }
			return input;
		})();
		if (!platformRoot) { return; }
		const transport = new TaskProcessTransport(this.taskService, this.fileService);
		const result = await runSpecCheck(transport, platformRoot, this.projectService.resourceOfSpec(id).fsPath);
		this.specChecks.set(id, result);
		void this._renderProject();
	}

	/**
	 * Builds a one-rule manifest for this requirement (human-declared operation + file, asked here, never
	 * persisted) and runs it via spec-code-sync — the exact live-verification mechanism already used to
	 * decode a real result. The result is shown in the Verification view, not reasoned about here.
	 */
	private async _verify(id: string, title: string): Promise<void> {
		const operation = await this.quickInputService.input({
			title: `Target operation for ${id}`,
			prompt: 'The Class.method this requirement\'s spec governs. Asked fresh each time; not saved.',
			placeHolder: 'ClassName.methodName',
			validateInput: async text => validateTargetOperation(text)
		});
		if (!operation) { return; }
		const picked = await this.fileDialogService.showOpenDialog({ title: 'Source file containing the operation', canSelectFiles: true, canSelectFolders: false, canSelectMany: false });
		if (!picked?.[0]) { return; }
		let platformRoot = await this.projectService.getPlatformRoot();
		if (!platformRoot) {
			const input = await this._promptPlatformRoot(undefined);
			if (input === undefined) { return; }
			await this.projectService.setPlatformRoot(input);
			platformRoot = input;
		}
		const folder = this.projectService.resourceOf(id).path.split('/.sys/')[0];
		const projectId = folder.slice(folder.lastIndexOf('/') + 1);
		const manifest = buildManifest({
			projectId,
			projectRoot: folder,
			targetOperation: operation,
			sourceFile: picked[0].fsPath,
			ruleId: id,
			title,
			specFile: this.projectService.resourceOfSpec(id).fsPath
		});
		const manifestUri = await this.projectService.writeManifest(id, manifest);
		this.verificationDataProvider.setWorkspaceRun({ platformBinary: `${platformRoot}/spec-code-sync/target/debug/spec-code-sync`, manifestPath: manifestUri.fsPath });
		await this.viewsService.openView(SYS_VERIFICATION_VIEW_ID, true);
	}

	private _renderRequirementRow(host: HTMLElement, row: SysRequirementRow): void {
		const el = DOM.append(host, $('div.sys-req-row'));
		const main = DOM.append(el, $('div.sys-req-main'));
		main.tabIndex = 0;
		main.title = 'Open in editor';
		DOM.append(main, $('span.sys-req-id')).textContent = row.id;
		DOM.append(main, $('span.sys-req-title')).textContent = row.title;
		const open = () => void this.editorService.openEditor({ resource: this.projectService.resourceOf(row.id) });
		main.addEventListener('click', open);
		main.addEventListener('keydown', e => { if (e.key === 'Enter') { open(); } });
		DOM.append(el, $('div.sys-req-status')).textContent = row.status === 'APPROVED_UNFORMALIZED'
			? 'Intent approved · unformalized · not verified'
			: 'Draft · unformalized · needs review';
		const actions = DOM.append(el, $('div.sys-req-actions'));
		if (!row.missing) {
			this._action(actions, 'Draft spec from request', 'sys-req-action', () => this._draftSpecFromRequirement(row.id));
			if (row.hasSpec) {
				this._action(actions, 'Approve spec & review code', 'sys-req-action', () => this._approveSpecAndReviewProposal(row.id, row.title));
			}
		}
		if (row.status === 'DRAFT_UNFORMALIZED' && !row.missing) {
			this._action(actions, 'Approve intent', 'sys-req-action', () => this.projectService.approveRequirement(row.id));
		}
		const specCheck = row.hasSpec ? this.specChecks.get(row.id) : undefined;
		DOM.append(el, $('div.sys-req-binding')).textContent = row.hasSpec ? `spec: ${this._specLabel(specCheck)}` : 'No .spec file yet';
		this._action(actions, row.hasSpec ? 'Edit spec' : 'Add spec', 'sys-req-action', async () => {
			await this.editorService.openEditor({ resource: await this.projectService.createSpec(row.id) });
		});
		if (row.hasSpec) {
			this._action(actions, 'Check syntax', 'sys-req-action', () => this._checkSpec(row.id));
			this._action(actions, 'Verify', 'sys-req-action', () => this._verify(row.id, row.title));
		}
		this._action(actions, 'Delete', 'sys-req-action', async () => {
			const { confirmed } = await this.dialogService.confirm({ message: `Delete ${row.id}?`, detail: 'The requirement file is removed from .sys/requirements/.', primaryButton: 'Delete' });
			if (confirmed) { await this.projectService.deleteRequirement(row.id); }
		});
	}

	private async load(): Promise<void> {
		if (this.loadPromise) {
			return this.loadPromise;
		}
		this.loadState = 'LOADING';
		this.loadError = undefined;
		this.loadPromise = (async () => {
			console.info('[SYS_LOAD_02] load() entered');
			try {
				console.info('[SYS_LOAD_03] snapshotService.getSnapshot START');
				const snapshot = await this.snapshotService.getSnapshot();
				console.info('[SYS_LOAD_04] snapshotService.getSnapshot DONE');
				console.info('[SYS_LOAD_05] intentActionService.getIntentItems START');
				const items = await this.intentActionService.getIntentItems();
				console.info('[SYS_LOAD_06] intentActionService.getIntentItems DONE');
				this.intentItems = items;
				this.snapshot = snapshot;

				// If we're showing a detail, refresh it
				if (this.currentDetailId) {
					console.info('[SYS_LOAD_07] current-detail load START');
					this.currentDetails = await this.intentActionService.getIntentItemDetails(this.currentDetailId);
					console.info('[SYS_LOAD_08] current-detail load DONE');
				}

				this.loadState = 'READY';
				console.info('[SYS_LOAD_09] renderSnapshot entered');
				if (this.bodyContainer) {
					this._renderSnapshot(this.bodyContainer, snapshot);
				}
				console.info('[SYS_LOAD_10] READY rendered');
			} catch (error) {
				this.loadState = 'ERROR';
				this.loadError = 'Unable to load semantic snapshot';
				console.error('[SYS_LOAD_ERR] load', error instanceof Error ? error.message : 'unknown error');
				if (this.bodyContainer) {
					this.renderBody(this.bodyContainer);
				}
			} finally {
				this.loadPromise = undefined;
			}
		})();
		return this.loadPromise;
	}

	private _renderLoading(parent: HTMLElement): void {
		parent.textContent = 'Loading semantic snapshot...';
		parent.classList.add('sys-loading');
	}

	private _renderError(parent: HTMLElement): void {
		parent.textContent = '';
		parent.classList.remove('sys-loading');

		const errorContainer = DOM.append(parent, $('div.sys-error-container'));

		const errorTitle = DOM.append(errorContainer, $('h2.sys-error-title'));
		errorTitle.textContent = 'Unable to load semantic snapshot';

		const errorMessage = DOM.append(errorContainer, $('p.sys-error-message'));
		errorMessage.textContent = this.loadError ?? 'An error occurred while loading the semantic workbench.';

		const retryBtn = DOM.append(errorContainer, $('button.sys-error-retry-btn'));
		retryBtn.textContent = 'Retry';
		retryBtn.addEventListener('click', () => {
			this.loadState = 'IDLE';
			void this.load();
		});
	}

	private _renderSnapshot(parent: HTMLElement, snapshot: SysProjectSnapshot): void {
		parent.textContent = '';
		parent.classList.remove('sys-loading');

		const header = DOM.append(parent, $('div.sys-header'));
		DOM.append(header, $('div.sys-eyebrow')).textContent = 'SYS SEMANTIC WORKBENCH';
		DOM.append(header, $('h1.sys-title')).textContent = snapshot.project;
		DOM.append(header, $('p.sys-subtitle')).textContent = 'Semantic status, evidence, and intent actions';

		const summary = DOM.append(parent, this._section('Project'));
		const summaryGrid = DOM.append(summary, $('div.sys-summary-grid'));
		this._metric(summaryGrid, 'Governed exactly', String(snapshot.semanticItems.filter(i => i.disposition === 'SUPPORTED_EXACT').length));
		this._metric(summaryGrid, 'Unsupported', String(snapshot.semanticItems.filter(i => i.disposition === 'UNSUPPORTED').length));
		this._metric(summaryGrid, 'Unresolved', String(snapshot.semanticItems.filter(i => i.disposition === 'UNRESOLVED').length));
		this._metric(summaryGrid, 'Recovered source meaning', snapshot.recoveredMeaning.state);
		this._metric(summaryGrid, 'Sync', snapshot.sync);

		// Count unresolved and confirmed from intent items
		const unresolvedCount = this.intentItems.filter(i => i.status === 'UNRESOLVED').length;
		const confirmedCount = this.intentItems.filter(i => i.status === 'CONFIRMED').length;

		this._metric(summaryGrid, 'Unresolved intent', String(unresolvedCount));
		this._metric(summaryGrid, 'Confirmed human intent', String(confirmedCount));
		this._metric(summaryGrid, 'Reviews requiring attention', String(snapshot.reviewsRequiringAttention));

		if (snapshot.integration !== 'READY') {
			const gap = DOM.append(parent, this._section('Integration')); DOM.append(gap, $('p')).textContent = snapshot.integration;
		}
		const intent = DOM.append(parent, this._section('Governed Meaning'));
		this._renderSemanticItems(intent, 'SUPPORTED_EXACT', snapshot.semanticItems);
		this._renderSemanticItems(DOM.append(parent, this._section('Unsupported Meaning')), 'UNSUPPORTED', snapshot.semanticItems);
		this._renderSemanticItems(DOM.append(parent, this._section('Unresolved Meaning')), 'UNRESOLVED', snapshot.semanticItems);
		const recovered = DOM.append(parent, this._section('Recovered Source Meaning'));
		this._metric(recovered, 'State', snapshot.recoveredMeaning.state);
		this._metric(recovered, 'Operations', snapshot.recoveredMeaning.operations.join(', ') || 'None');

		// Unresolved intent - now clickable
		this._listSection(intent, 'Unresolved intent', this.intentItems, 'sys-unresolved', true);

		// Confirmed human intent section
		const confirmedItems = this.intentItems.filter(i => i.status === 'CONFIRMED');
		if (confirmedItems.length > 0) {
			const confirmedSection = DOM.append(intent, $('div.sys-list-section'));
			DOM.append(confirmedSection, $('h3.sys-subsection-title')).textContent =
				'Confirmed human intent (not yet governed)';

			for (const item of confirmedItems) {
				const itemEl = DOM.append(confirmedSection, $('div.sys-list-item.sys-confirmed'));

				// Show title with status
				const titleSpan = DOM.append(itemEl, $('span.sys-confirmed-title'));
				titleSpan.textContent = item.title;

				// Show governance badge
				const governanceBadge = DOM.append(itemEl, $('span.sys-governance-badge'));
				governanceBadge.textContent = 'NOT YET GOVERNED';
				governanceBadge.classList.add('sys-governance-not-governed');

				// Show meaning preview
				if (item.confirmedMeaning) {
					const meaningSpan = DOM.append(itemEl, $('span.sys-confirmed-meaning'));
					meaningSpan.textContent = ` - ${item.confirmedMeaning}`;
				}

				// Make clickable to view
				itemEl.classList.add('sys-list-item-clickable');
				itemEl.style.cursor = 'pointer';
				itemEl.title = 'Click to view details';
				itemEl.addEventListener('click', () => {
					void this.openIntentDetail(item.id);
				});
			}
		}

		const sync = DOM.append(parent, this._section('Semantic Sync'));
		const table = DOM.append(sync, $('div.sys-sync-table'));
		const headings = ['Rule', 'State', 'Eligibility'];
		for (const heading of headings) {
			DOM.append(table, $('div.sys-sync-heading')).textContent = heading;
		}
		for (const item of snapshot.syncItems) {
			DOM.append(table, $('div.sys-sync-cell')).textContent = item.label;
			DOM.append(table, $('div.sys-sync-cell')).textContent = item.state;
			DOM.append(table, $('div.sys-sync-cell')).textContent = item.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE';
		}

		const reviews = DOM.append(parent, this._section('Reviews'));
		for (const review of snapshot.reviews) {
			const reviewEl = DOM.append(reviews, $('div.sys-review'));
			DOM.append(reviewEl, $('h3.sys-review-title')).textContent = review.title;
			this._detail(reviewEl, 'Governed', review.governed);
			this._detail(reviewEl, 'Recovered', review.recovered);
			this._detail(reviewEl, 'State', review.state);
			this._detail(reviewEl, 'Evidence', review.evidence);
		}

		const evidence = DOM.append(parent, this._section('Evidence'));
		const evidenceGrid = DOM.append(evidence, $('div.sys-evidence-grid'));
		this._metric(evidenceGrid, 'Operation', snapshot.evidence.operation);
		this._metric(evidenceGrid, 'Source paths recovered', String(snapshot.evidence.recoveredSourcePaths));
		this._metric(evidenceGrid, 'Fully recovered guards', String(snapshot.evidence.fullyRecoveredGuards));
		this._metric(evidenceGrid, 'False greens', String(snapshot.evidence.falseGreens));
		if (snapshot.evidence.sourceLocation) {
			this._detail(evidence, 'Source location', snapshot.evidence.sourceLocation);
		}
	}

	private _renderSemanticItems(parent: HTMLElement, disposition: 'SUPPORTED_EXACT' | 'UNSUPPORTED' | 'UNRESOLVED', items: readonly SysProjectSnapshot['semanticItems'][number][]): void {
		const matches = items.filter(item => item.disposition === disposition);
		if (!matches.length) { DOM.append(parent, $('p')).textContent = 'None'; return; }
		for (const item of matches) {
			const row = DOM.append(parent, $('div.sys-rule'));
			DOM.append(row, $('span.sys-status')).textContent = disposition === 'SUPPORTED_EXACT' ? 'SUPPORTED EXACT' : disposition;
			DOM.append(row, $('span.sys-rule-description')).textContent = item.displayText;
			if (item.reason) {
				DOM.append(row, $('span.sys-detail-value')).textContent = `(${item.reason})`;
			}
		}
	}

	private _section(title: string): HTMLElement {
		const section = $('section.sys-section');
		DOM.append(section, $('h2.sys-section-title')).textContent = title;
		return section;
	}

	private _metric(parent: HTMLElement, label: string, value: string): void {
		const metric = DOM.append(parent, $('div.sys-metric'));
		DOM.append(metric, $('span.sys-metric-label')).textContent = label;
		DOM.append(metric, $('strong.sys-metric-value')).textContent = value;
	}

	private _listSection(
		parent: HTMLElement,
		title: string,
		items: readonly SysIntentItem[],
		className: string,
		clickable: boolean
	): void {
		const list = DOM.append(parent, $('div.sys-list-section'));
		DOM.append(list, $('h3.sys-subsection-title')).textContent = title;

		// Only show unresolved items
		const unresolvedItems = items.filter(i => i.status === 'UNRESOLVED');
		if (unresolvedItems.length === 0) {
			const emptyEl = DOM.append(list, $('div.sys-list-empty'));
			emptyEl.textContent = 'None';
			return;
		}

		for (const item of unresolvedItems) {
			const itemEl = DOM.append(list, $(`div.sys-list-item.${className}`));
			itemEl.textContent = item.title;

			// Add status indicator for leftOpenByHuman
			if (item.leftOpenByHuman) {
				const statusBadge = DOM.append(itemEl, $('span.sys-item-status'));
				statusBadge.textContent = 'LEFT OPEN';
				statusBadge.classList.add('sys-status-left-open');
			}

			if (clickable) {
				itemEl.classList.add('sys-list-item-clickable');
				itemEl.style.cursor = 'pointer';
				itemEl.title = 'Click to view and edit';
				itemEl.addEventListener('click', () => {
					void this.openIntentDetail(item.id);
				});
			}
		}
	}

	private async openIntentDetail(id: string): Promise<void> {
		// Show detail inline
		this.currentDetailId = id;
		this.currentDetails = await this.intentActionService.getIntentItemDetails(id);
		void this.load();
	}

	private showList(): void {
		this.currentDetailId = undefined;
		this.currentDetails = undefined;
		void this.load();
	}

	private _detail(parent: HTMLElement, label: string, value: string): void {
		const row = DOM.append(parent, $('div.sys-detail'));
		DOM.append(row, $('span.sys-detail-label')).textContent = `${label}:`;
		DOM.append(row, $('span.sys-detail-value')).textContent = value;
	}

	private _renderDetail(parent: HTMLElement, details: SysIntentItemDetails): void {
		parent.textContent = '';

		const item = details.item;
		const isReplacing = details.isReplacing;

		// Header with back button
		const header = DOM.append(parent, $('div.sys-intent-detail-header'));

		const backBtn = DOM.append(header, $('button.sys-intent-back-btn'));
		backBtn.textContent = '← Back';
		backBtn.title = 'Back to intent list';
		backBtn.addEventListener('click', () => this.showList());

		DOM.append(header, $('h2.sys-intent-detail-title')).textContent = `Unresolved Intent: ${item.title}`;

		// Status display
		const statusEl = DOM.append(parent, $('div.sys-intent-detail-status'));
		this._renderDetailStatus(statusEl, item.status, item.governanceState, item.leftOpenByHuman);

		// Why unresolved / question
		const questionSection = DOM.append(parent, $('div.sys-intent-detail-section'));
		DOM.append(questionSection, $('h3.sys-intent-section-title')).textContent = 'Why unresolved:';
		DOM.append(questionSection, $('p.sys-intent-question')).textContent = item.question;

		if (isReplacing) {
			this._renderReplacementDetail(parent, item, details);
		} else if (item.status === 'CONFIRMED' && item.confirmedMeaning) {
			this._renderConfirmedDetail(parent, item);
		} else {
			this._renderClarificationDetail(parent, item);
		}
	}

	private _renderDetailStatus(
		parent: HTMLElement,
		status: SysIntentStatus,
		governanceState: 'NOT_GOVERNED' | 'GOVERNED',
		leftOpenByHuman: boolean
	): void {
		const statusBadge = DOM.append(parent, $('span.sys-status-badge'));
		statusBadge.className = 'sys-status-badge';

		if (leftOpenByHuman) {
			statusBadge.textContent = 'LEFT OPEN BY HUMAN';
			statusBadge.classList.add('sys-status-left-open');
		} else {
			statusBadge.textContent = status;
			statusBadge.classList.add(`sys-status-${status.toLowerCase()}`);
		}

		// Governance state - always show distinction
		const governanceBadge = DOM.append(parent, $('span.sys-governance-badge'));
		governanceBadge.className = 'sys-governance-badge';
		governanceBadge.textContent = governanceState === 'GOVERNED' ? 'GOVERNED' : 'NOT YET GOVERNED';

		if (governanceState === 'GOVERNED') {
			governanceBadge.classList.add('sys-governance-governed');
		} else {
			governanceBadge.classList.add('sys-governance-not-governed');
		}
	}

	private _renderClarificationDetail(parent: HTMLElement, item: SysIntentItem): void {
		const formSection = DOM.append(parent, $('div.sys-intent-detail-section'));
		DOM.append(formSection, $('h3.sys-intent-section-title')).textContent = 'Your clarification:';

		const inputContainer = DOM.append(formSection, $('div.sys-intent-input-container'));
		const textarea = DOM.append(inputContainer, $('textarea.sys-intent-textarea'));
		textarea.placeholder = 'Enter your clarification here...';
		textarea.value = item.candidateMeaning ?? '';
		textarea.setAttribute('aria-label', 'Enter clarification for intent item');

		// Action buttons
		const actions = DOM.append(formSection, $('div.sys-intent-actions'));

		if (item.status === 'CANDIDATE') {
			// Review state - show back and confirm
			const backBtn = DOM.append(actions, $('button.sys-intent-btn.sys-intent-btn-secondary'));
			backBtn.textContent = 'Back';
			backBtn.addEventListener('click', () => {
				// Clear candidate and go back to list
				void this.intentActionService.proposeClarification(item.id, '');
				this.showList();
			});

			const confirmBtn = DOM.append(actions, $('button.sys-intent-btn.sys-intent-btn-primary'));
			confirmBtn.textContent = 'Confirm intent';
			confirmBtn.addEventListener('click', () => {
				void this.handleConfirmClarification(item.id);
			});

			// Show proposed meaning
			const reviewSection = DOM.append(formSection, $('div.sys-intent-review'));
			DOM.append(reviewSection, $('h4.sys-intent-review-title')).textContent = 'Proposed human meaning';
			const meaningEl = DOM.append(reviewSection, $('div.sys-intent-meaning'));
			meaningEl.textContent = item.candidateMeaning ?? '';
			DOM.append(reviewSection, $('p.sys-intent-review-note')).textContent =
				'This confirmation records your intended meaning. It does not yet make the rule governed.';
		} else {
			// UNRESOLVED state - show input and leave unresolved option
			const leaveBtn = DOM.append(actions, $('button.sys-intent-btn.sys-intent-btn-secondary'));
			leaveBtn.textContent = 'Leave unresolved';
			leaveBtn.addEventListener('click', () => {
				void this.handleLeaveUnresolved(item.id);
			});

			const reviewBtn = DOM.append(actions, $('button.sys-intent-btn.sys-intent-btn-primary'));
			reviewBtn.textContent = 'Review clarification';
			reviewBtn.addEventListener('click', () => {
				const input = inputContainer.querySelector('textarea') as HTMLTextAreaElement;
				if (input && input.value.trim()) {
					void this.intentActionService.proposeClarification(item.id, input.value);
					// Stay in detail view but refresh to show review state
					void this.openIntentDetail(item.id);
				}
			});
		}
	}

	private _renderConfirmedDetail(parent: HTMLElement, item: SysIntentItem): void {
		// Show confirmed meaning
		const confirmedSection = DOM.append(parent, $('div.sys-intent-detail-section'));
		DOM.append(confirmedSection, $('h3.sys-intent-section-title')).textContent = 'Status:';

		const statusValue = DOM.append(confirmedSection, $('div.sys-intent-status-value'));
		statusValue.textContent = 'CONFIRMED HUMAN INTENT';
		statusValue.classList.add('sys-status-confirmed');

		const meaningSection = DOM.append(parent, $('div.sys-intent-detail-section'));
		DOM.append(meaningSection, $('h3.sys-intent-section-title')).textContent = 'Meaning:';
		const meaningEl = DOM.append(meaningSection, $('div.sys-intent-meaning'));
		meaningEl.textContent = item.confirmedMeaning ?? '';

		const governanceSection = DOM.append(parent, $('div.sys-intent-detail-section'));
		DOM.append(governanceSection, $('h3.sys-intent-section-title')).textContent = 'Governance:';
		const governanceEl = DOM.append(governanceSection, $('div.sys-intent-governance-value'));
		governanceEl.textContent = 'NOT YET GOVERNED';
		governanceEl.classList.add('sys-governance-not-governed');

		// Replace button
		const actions = DOM.append(parent, $('div.sys-intent-actions'));
		const replaceBtn = DOM.append(actions, $('button.sys-intent-btn.sys-intent-btn-primary'));
		replaceBtn.textContent = 'Replace clarification';
		replaceBtn.addEventListener('click', () => {
			// Trigger replacement flow
			const newMeaning = prompt('Enter new clarification:', item.confirmedMeaning ?? '');
			if (newMeaning !== null) {
				void this.intentActionService.proposeReplacement(item.id, newMeaning);
				// Refresh to show replacement view
				void this.openIntentDetail(item.id);
			}
		});
	}

	private _renderReplacementDetail(parent: HTMLElement, item: SysIntentItem, details: SysIntentItemDetails): void {
		const replaceSection = DOM.append(parent, $('div.sys-intent-detail-section'));
		DOM.append(replaceSection, $('h3.sys-intent-section-title')).textContent = 'Replace clarification';

		// Show old meaning
		const oldMeaningSection = DOM.append(replaceSection, $('div.sys-intent-replacement-part'));
		DOM.append(oldMeaningSection, $('h4.sys-intent-replacement-label')).textContent = 'Existing confirmed meaning:';
		const oldMeaningEl = DOM.append(
			oldMeaningSection,
			$('div.sys-intent-replacement-value.sys-intent-replacement-old')
		);
		oldMeaningEl.textContent = details.replacementOldMeaning ?? '';

		// Show new meaning (editable)
		const newMeaningSection = DOM.append(replaceSection, $('div.sys-intent-replacement-part'));
		DOM.append(newMeaningSection, $('h4.sys-intent-replacement-label')).textContent = 'Proposed replacement:';
		const inputContainer = DOM.append(newMeaningSection, $('div.sys-intent-input-container'));
		const textarea = DOM.append(inputContainer, $('textarea.sys-intent-textarea'));
		textarea.value = details.replacementNewMeaning ?? '';
		textarea.placeholder = 'Enter replacement clarification...';
		textarea.setAttribute('aria-label', 'Enter replacement clarification');

		// Action buttons
		const actions = DOM.append(parent, $('div.sys-intent-actions'));

		const cancelBtn = DOM.append(actions, $('button.sys-intent-btn.sys-intent-btn-secondary'));
		cancelBtn.textContent = 'Cancel';
		cancelBtn.addEventListener('click', () => {
			void this.intentActionService.cancelReplacement(item.id);
			void this.openIntentDetail(item.id);
		});

		const confirmBtn = DOM.append(actions, $('button.sys-intent-btn.sys-intent-btn-primary'));
		confirmBtn.textContent = 'Confirm replacement';
		confirmBtn.addEventListener('click', () => {
			void this.handleConfirmReplacement(item.id, textarea.value);
		});
	}

	private async handleConfirmClarification(id: string): Promise<void> {
		await this.intentActionService.confirmClarification(id);
		// Go back to list
		this.showList();
	}

	private async handleLeaveUnresolved(id: string): Promise<void> {
		await this.intentActionService.leaveUnresolved(id);
		// Go back to list
		this.showList();
	}

	private async handleConfirmReplacement(id: string, newMeaning: string): Promise<void> {
		// Update the replacement with the current input value
		if (newMeaning.trim()) {
			await this.intentActionService.proposeReplacement(id, newMeaning);
			await this.intentActionService.confirmReplacement(id);
			// Refresh to show confirmed state
			void this.openIntentDetail(id);
		}
	}
}
