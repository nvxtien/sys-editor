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
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { ViewPane, IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { ISysProjectService } from './sysProjectService.js';
import { SysRequirementRow } from '../common/sysProject.js';
import { ISysVerificationDataProvider } from './sysVerificationProviderService.js';
import { SYS_VERIFICATION_VIEW_ID } from '../common/sysViewIds.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { TaskProcessTransport } from './sysVerificationProviderService.js';
import { ISideXTaskService } from '../../../../platform/sidex/common/sidexTaskService.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { requestGeneratedCode } from '../common/sysGeneratedCode.js';
// PROTOTYPE — remove with sysPrototype.ts and sysPrototypeFixture.ts.
import { readGoverned } from '../common/sysOntology.js';

import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { isSysWorkspaceMissing, validateDraftCandidate } from '../common/sysPlatformFlow.js';
import { ISidexChatService } from '../../sidexChat/browser/sidexChatService.js';
import { resolveServerEndpoint, serverHttpUrl, waitForServerEndpoint } from '../../sidexChat/browser/localServer.js';
import { assertSysDraftServerAvailable } from '../common/sysServerAvailability.js';
import { newSysRequestId, requestFormalSpec, sysTrace } from '../common/sysFormalSpecDraft.js';
import { formalizationNote, serializeFormalSpec } from '../common/sysFormalSpec.js';
import { requestFormalSpecScenarios } from '../common/sysFormalSpecScenarios.js';
import { generateUuid } from '../../../../base/common/uuid.js';
const $ = DOM.$;
const intentStateOf = (row: SysRequirementRow) => row.formalSpecState ?? 'NOT_CREATED';

export class SysSemanticWorkbenchView extends ViewPane {
	private bodyContainer: HTMLElement | undefined;

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
		@ISysProjectService private readonly projectService: ISysProjectService,
		@IEditorService private readonly editorService: IEditorService,
		@IDialogService private readonly dialogService: IDialogService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@IFileService private readonly fileService: IFileService,
		@ISideXTaskService private readonly taskService: ISideXTaskService,
		@ISysVerificationDataProvider private readonly verificationDataProvider: ISysVerificationDataProvider,
		@ISidexChatService private readonly sidexChatService: ISidexChatService,
		@IViewsService private readonly viewsService: IViewsService,
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
	}

	private readonly actionErrors = new Map<string, string>();
	/**
	 * The failure of an action that belongs to no requirement row ("New requirement"). Rendering
	 * clears the whole panel, so a message written straight into the DOM is wiped by the very
	 * render the action triggers; remembering it here is what lets the reader see it.
	 */
	private sectionError: string | undefined;

	protected override renderBody(parent: HTMLElement): void {
		console.info('[SYS_LOAD_01] renderBody entered');
		this.bodyContainer = parent;
		super.renderBody(parent);
		parent.classList.add('sys-semantic-workbench');
		void this._renderProject();
	}

	private async _renderProject(): Promise<void> {
		if (!this.bodyContainer) {
			return;
		}
		const parent = this.bodyContainer;
		const state = await this.projectService.getState();
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
				if (this.sectionError) { DOM.append(section, $('p.sys-error-message')).textContent = this.sectionError; }
				return;
			}
			case 'READY': {
				// PROTOTYPE — fake verdicts, first because it is the thing that needs an answer.
				// Remove this line with the prototype files.
				void this._renderGoverned(parent, state.project.platformRoot);
				const section = DOM.append(parent, this._section('Requirements'));
				DOM.append(section, $('p')).textContent = 'Write a requirement, normalize its intent, then confirm it — confirming records the intent and generates code from it.';
				for (const row of state.rows) {
					this._renderRequirementRow(section, row);
				}
				this._action(section, 'New requirement', 'sys-error-retry-btn', () => this._createRequirement());
				if (this.sectionError) { DOM.append(section, $('p.sys-error-message')).textContent = this.sectionError; }
				this._renderPlatformRow(parent, state.project.platformRoot);
			}
		}
	}

	/**
	 * How much this workspace governs, and anything about it that needs a person.
	 *
	 * Not an inventory. A panel this narrow cannot hold three hundred statements, and a list of
	 * things that are fine is the noise this view exists to avoid — the inventory's home is the
	 * hover on a concept, where a reader asks about the one they care about.
	 *
	 * What does belong here is what needs attention: a concept carrying more statements than a
	 * person can hold in one sitting, and a spec the grammar rejected. Both are for a human to
	 * act on; neither is something to browse.
	 */
	private async _renderGoverned(parent: HTMLElement, platformRoot: string | undefined): Promise<void> {
		const section = DOM.append(parent, this._section('Governed'));
		const workspace = this.workspaceContextService.getWorkspace().folders[0]?.uri.fsPath;
		if (!platformRoot || !workspace) {
			DOM.append(section, $('p')).textContent = 'Set the Sys Platform root to see what this workspace governs.';
			return;
		}
		const note = DOM.append(section, $('p'));
		note.textContent = 'Reading from sys-platform…';

		const result = await readGoverned(new TaskProcessTransport(this.taskService, this.fileService), platformRoot, workspace);
		if (result.kind === 'UNAVAILABLE') {
			// A view that cannot reach the platform says so. An empty list and a broken pipe look
			// identical to a reader, and only one of them means "nothing is governed".
			note.textContent = `Could not read what this workspace governs: ${result.reason}`;
			return;
		}

		const { statements, concepts, unreadable, note: platformNote, crowded } = result.governed;
		if (platformNote) { note.textContent = platformNote; return; }

		const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
		// No verdict is claimed, because none has been earned: these statements have never met
		// any code. "Not checked" is a different thing from a green tick.
		note.textContent = `${plural(statements.length, 'statement')} across ${plural(concepts.length, 'concept')}, none checked against code yet.`;

		// Over budget, and how much, is the platform's answer — computed there so every client
		// renders the same one instead of each deciding for itself what "too crowded" means.
		for (const { concept, count } of crowded ?? []) {
			const row = DOM.append(section, $('div.sys-req-row'));
			DOM.append(DOM.append(row, $('div.sys-req-main')), $('span.sys-req-title')).textContent = concept;
			DOM.append(row, $('div.sys-req-status')).textContent =
				`${plural(count, 'statement')} — more than one sitting holds. Consider splitting the concept.`;
		}

		for (const bad of unreadable) {
			// Named, not dropped: a statement missing because a file failed to parse looks exactly
			// like one nobody ever wrote.
			DOM.append(section, $('p.sys-error-message')).textContent = `${bad.requirement} could not be read: ${bad.reason}`;
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
			// Normalize and Review call a provider and take seconds. Without this the button looks
			// inert and the click reads as having done nothing, so it gets pressed again.
			if (b.disabled) { return; }
			b.disabled = true;
			b.setAttribute('aria-busy', 'true');
			b.textContent = `${label}…`;
			const requirementId = host.dataset.sysRequirementId;
			if (requirementId) { this.actionErrors.delete(requirementId); } else { this.sectionError = undefined; }
			void run().catch(err => {
				const message = `${label} failed: ${err instanceof Error ? err.message : String(err)}`;
				if (requirementId) { this.actionErrors.set(requirementId, message); } else { this.sectionError = message; }
				// An action rendered on a section ("New requirement") has no row to report into.
				// Falling back to the host keeps the message next to the button that failed instead
				// of dropping it, which made a failed click read as having done nothing at all.
				const target = host.parentElement ?? host;
				const slot = target.querySelector('.sys-req-error') ?? DOM.append(target, $('p.sys-error-message.sys-req-error'));
				slot.textContent = message;
				// Nothing about a swallowed failure is recoverable from the UI alone.
				console.error(`[SYS_ACTION] ${label}: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
			}).finally(() => {
				// The row is usually re-rendered by now and this button discarded; restoring it is
				// what makes the case where it is not — an error, or a no-op action — recoverable.
				b.disabled = false;
				b.removeAttribute('aria-busy');
				b.textContent = label;
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


	private async _normalizeIntent(id: string): Promise<void> {
		const requestId = newSysRequestId();
		sysTrace(requestId, 'click', `requirement=${id}`);
		try {
			const requirement = this.projectService.resourceOf(id);
			const intent = (await this.fileService.readFile(requirement)).value.toString();
			if (!intent.trim()) { throw new Error('Save the raw requirement before normalizing intent.'); }
			const model = this.sidexChatService.serverModel;
			if (!model) { throw new Error('Select a model in SideX Settings → Models before normalizing intent.'); }
			await this.projectService.saveRequirement(id, intent);
			const configuredServerUrl = this.configurationService.getValue<string>('sidex.chat.serverUrl');
			const endpoint = configuredServerUrl?.trim() ? await resolveServerEndpoint() : await waitForServerEndpoint();
			assertSysDraftServerAvailable(endpoint.running, configuredServerUrl, endpoint.error);
			const proposalContext = await this.projectService.prepareFormalSpecContext(id);
			sysTrace(requestId, 'prepared', `context_bytes=${proposalContext.length}`);
			// Read the port after prepare: a stale cached port is re-resolved by the core call above.
			const httpUrl = serverHttpUrl(configuredServerUrl);
			const formalSpec = await requestFormalSpec(httpUrl, model, id, proposalContext, requestId);
			await this.projectService.writeFormalSpec(id, formalSpec);
			sysTrace(requestId, 'saved', `requirement=${id}`);
			const scenarios = await this._scenariosFor(id, httpUrl);
			await this.editorService.openEditor({ resource: await this.projectService.writeFormalSpecReview(id, scenarios) });
			sysTrace(requestId, 'ui_refresh', 'row re-renders from .sys/intents');
		} catch (error) {
			sysTrace(requestId, 'failed', `error=${error instanceof Error ? error.message : String(error)}`);
			throw error;
		}
	}

	/**
	 * Opens the review page, with Gherkin scenarios generated for this viewing. The scenarios are a
	 * reading aid only: they are rendered into the page, never written into the intent, so opening a
	 * review never changes the identity of what was confirmed. If the provider cannot be reached the
	 * page still opens without them — a reviewer must always be able to see what they are confirming.
	 */
	/**
	 * Gherkin scenarios for the review page, generated for this viewing. They are a reading aid:
	 * rendered into the page, never written into the intent, so opening a review never changes the
	 * identity of what was confirmed. Any failure yields undefined — a reviewer must always be able
	 * to see what they are confirming, whatever the provider is doing.
	 */
	private async _scenariosFor(id: string, httpUrl?: string): Promise<string | undefined> {
		const model = this.sidexChatService.serverModel;
		if (!model) { return undefined; }
		try {
			const record = await this.projectService.readFormalSpec(id);
			if (!record) { return undefined; }
			if (httpUrl === undefined) {
				const configuredServerUrl = this.configurationService.getValue<string>('sidex.chat.serverUrl');
				const endpoint = configuredServerUrl?.trim() ? await resolveServerEndpoint() : await waitForServerEndpoint();
				if (!endpoint.running && !configuredServerUrl?.trim()) { return undefined; }
				httpUrl = serverHttpUrl(configuredServerUrl);
			}
			return await requestFormalSpecScenarios(httpUrl, model, serializeFormalSpec(record.draft));
		} catch {
			return undefined;
		}
	}


	private async _confirmIntent(id: string): Promise<void> {
		const record = await this.projectService.readFormalSpec(id);
		if (!record) { throw new Error('Normalize this requirement before confirming its Formal Spec.'); }
		const { confirmed } = await this.dialogService.confirm({ message: 'Confirm this Formal Spec?', detail: 'Confirming records this exact Formal Spec as approved, then generates code from it into this project’s source tree. No file that already exists is overwritten.', primaryButton: 'Confirm intent' });
		if (!confirmed) { return; }
		// Approval is the governed record and is recorded first, on its own. Code generation runs
		// after and can fail without unmaking it: the provider does not get a vote on what the user
		// confirmed, and a failed generation is retried by confirming again.
		await this.projectService.approveFormalSpec(id);
		await this._generateCode(id);
	}

	/**
	 * Code for a confirmed Formal Spec, written into the project's own source tree in the
	 * language it is already written in, and opened beside the intent it came from. It is ordinary
	 * source: sys-core does not know it exists, and nothing ties it to a Formal Spec generated later.
	 */
	private async _generateCode(id: string): Promise<void> {
		const model = this.sidexChatService.serverModel;
		if (!model) { throw new Error('No model is selected. Open SideX Settings → Models and choose one.'); }
		const configuredServerUrl = this.configurationService.getValue<string>('sidex.chat.serverUrl');
		const endpoint = configuredServerUrl?.trim() ? await resolveServerEndpoint() : await waitForServerEndpoint();
		assertSysDraftServerAvailable(endpoint.running, configuredServerUrl, endpoint.error);
		// The platform prepares the context and reads the answer. Everything between is transport.
		const context = await this.projectService.prepareCodeContext(id);
		const candidate = await requestGeneratedCode(serverHttpUrl(configuredServerUrl), model, context);
		const files = await this.projectService.acceptCodeCandidate(id, candidate);
		const written = await this.projectService.writeGeneratedCode(files);
		for (const resource of written) { await this.editorService.openEditor({ resource }, SIDE_GROUP); }
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
		actions.dataset.sysRequirementId = row.id;
		if (!row.missing && !row.empty && !row.lifecycleUnavailable) {
			const intentState = row.formalSpecState ?? 'NOT_CREATED';
			if (intentState === 'NOT_CREATED' || intentState === 'STALE') {
				this._action(actions, 'Normalize intent', 'sys-req-action', () => this._normalizeIntent(row.id));
			} else {
				if (intentState === 'DRAFT') {
					this._action(actions, 'Confirm intent', 'sys-req-action', () => this._confirmIntent(row.id));
				}
			}
			// No Formal Spec buttons. Confirming an intent already generates code from it, so
			// drafting a second artifact from the same facts asked a reader to review them twice
			// in two vocabularies. What a requirement governs comes from its intent; the Formal
			// Spec is the compilable projection, not a step a person takes.
		}
		const kindNote = intentStateOf(row) === 'APPROVED' ? (row.formalization ? formalizationNote(row.formalization) : 'Formal Spec options unavailable: sys-core did not answer.') : undefined;
		if (kindNote) { DOM.append(el, $('div.sys-req-binding.sys-req-kind-note')).textContent = kindNote; }
		if (row.lifecycleUnavailable) { DOM.append(el, $('div.sys-req-binding.sys-req-kind-note')).textContent = 'Lifecycle unavailable: sys-core did not answer, so no state is shown.'; }
		// A blank requirement has nothing to normalize or approve, so it offers neither. Say what to
		// do instead of leaving the row with only Delete and no explanation.
		if (row.empty) { DOM.append(el, $('div.sys-req-binding.sys-req-kind-note')).textContent = 'Write the requirement in the editor and save it, then normalize its intent.'; }
		this._action(actions, 'Delete', 'sys-req-action', async () => {
			const { confirmed } = await this.dialogService.confirm({ message: `Delete ${row.id}?`, detail: 'The requirement file is removed from .sys/requirements/.', primaryButton: 'Delete' });
			if (confirmed) { await this.projectService.deleteRequirement(row.id); }
		});
		const actionError = this.actionErrors.get(row.id);
		if (actionError) { DOM.append(el, $('p.sys-error-message.sys-req-error')).textContent = actionError; }
	}

