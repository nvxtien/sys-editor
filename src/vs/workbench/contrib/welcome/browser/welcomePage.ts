import './media/welcome.css';
import { $, append } from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IWorkspacesService, isRecentFolder } from '../../../../platform/workspaces/common/workspaces.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { pickRecents } from '../common/welcomeRecent.js';

const MAX_RECENT = 5;

export class WelcomePage extends EditorPane {
	static readonly ID = 'sidex.welcome.page';
	private root!: HTMLElement;
	private recentList!: HTMLElement;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ICommandService private readonly commands: ICommandService,
		@IWorkspacesService private readonly workspaces: IWorkspacesService,
		@IHostService private readonly host: IHostService
	) {
		super(WelcomePage.ID, group, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this.root = append(parent, $('.sidex-welcome'));
		const content = append(this.root, $('.sidex-welcome-content'));
		append(content, $('h1')).textContent = localize('sidexWelcomeTitle', 'SideX');
		append(content, $('p.sidex-welcome-subtitle')).textContent = localize('sidexWelcomeSubtitle', 'Editing evolved');

		const start = append(content, $('.sidex-welcome-section'));
		append(start, $('h2')).textContent = localize('sidexWelcomeStart', 'Start');
		this.link(start, Codicon.newFile, localize('sidexNewFile', 'New File...'), () => this.commands.executeCommand('workbench.action.files.newUntitledFile'));
		this.link(start, Codicon.folderOpened, localize('sidexOpenFolder', 'Open Folder...'), () => this.commands.executeCommand('workbench.action.files.openFolder'));
		this.link(start, Codicon.repoClone, localize('sidexClone', 'Clone Git Repository...'), () => this.commands.executeCommand('git.clone'));

		const recent = append(content, $('.sidex-welcome-section'));
		append(recent, $('h2')).textContent = localize('sidexWelcomeRecent', 'Recent');
		this.recentList = append(recent, $('.sidex-welcome-recent'));
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		await this.renderRecent();
	}

	private async renderRecent(): Promise<void> {
		const recents = await this.workspaces.getRecentlyOpened();
		const folders = recents.workspaces.filter(isRecentFolder).filter(r => r.folderUri.scheme === 'file');
		const rows = pickRecents(folders.map(f => f.folderUri.path), MAX_RECENT);
		this.recentList.textContent = '';
		if (rows.length === 0) {
			append(this.recentList, $('p.sidex-welcome-muted')).textContent = localize('sidexNoRecent', 'You have no recent folders.');
			return;
		}
		for (const row of rows) {
			const line = append(this.recentList, $('.sidex-welcome-recent-row'));
			const a = this.link(line, undefined, row.name, () => this.host.openWindow([{ folderUri: URI.file(row.path) }]));
			a.title = row.path;
			append(line, $('span.sidex-welcome-muted')).textContent = row.parent;
		}
		const more = append(this.recentList, $('.sidex-welcome-recent-row'));
		this.link(more, undefined, localize('sidexMore', 'More...'), () => this.commands.executeCommand('workbench.action.openRecent'));
	}

	private link(host: HTMLElement, icon: ThemeIcon | undefined, label: string, run: () => unknown): HTMLElement {
		const a = append(host, $('a.sidex-welcome-link', { tabindex: '0', role: 'button' }));
		if (icon) { append(a, $(`span${ThemeIcon.asCSSSelector(icon)}`)); }
		append(a, $('span')).textContent = label;
		a.addEventListener('click', () => void run());
		a.addEventListener('keydown', e => { if (e.key === 'Enter') { void run(); } });
		return a;
	}

	layout(): void { /* CSS-driven */ }
	override focus(): void { this.root?.focus(); }
}
