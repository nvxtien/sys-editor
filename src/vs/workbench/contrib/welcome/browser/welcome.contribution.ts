import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { localize } from '../../../../nls.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspacesService } from '../../../../platform/workspaces/common/workspaces.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { EditorExtensions } from '../../../common/editor.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { WelcomeInput } from './welcomeInput.js';
import { WelcomePage } from './welcomePage.js';

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(WelcomePage, WelcomePage.ID, localize('sidexWelcomePage', 'Welcome')),
	[new SyncDescriptor(WelcomeInput)]
);

class WelcomeStartup implements IWorkbenchContribution {
	static readonly ID = 'sidex.welcome.startup';

	constructor(
		@IWorkspaceContextService workspace: IWorkspaceContextService,
		@IEditorService editors: IEditorService,
		// Injected on purpose: instantiating the (delayed) service is what records the open folder in Recent.
		@IWorkspacesService _workspaces: IWorkspacesService
	) {
		if (workspace.getWorkbenchState() === WorkbenchState.EMPTY && editors.editors.length === 0) {
			void editors.openEditor(new WelcomeInput(), { pinned: true });
		}
	}
}

registerWorkbenchContribution2(WelcomeStartup.ID, WelcomeStartup, WorkbenchPhase.AfterRestored);
