import * as nls from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainerLocation } from '../../../common/views.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { SysSemanticWorkbenchView } from './sysSemanticWorkbenchView.js';
import { SysVerificationWorkbenchView } from './sysVerificationWorkbenchView.js';
import './sysVerificationProviderService.js';
import './sysProjectService.js';

import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import type { IWorkbenchContribution } from '../../../common/contributions.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { SysBehaviorCodeLensProvider } from './sysBehaviorCodeLensProvider.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ISysProjectService } from './sysProjectService.js';
import { TaskProcessTransport } from './sysVerificationProviderService.js';
import { ISideXTaskService } from '../../../../platform/sidex/common/sidexTaskService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { URI } from '../../../../base/common/uri.js';
import { readCandidates, SysCandidateFunction } from '../common/sysOntology.js';

import { SYS_VIEW_CONTAINER_ID, SYS_VIEW_ID, SYS_VERIFICATION_VIEW_ID } from '../common/sysViewIds.js';
export { SYS_VIEW_CONTAINER_ID, SYS_VIEW_ID, SYS_VERIFICATION_VIEW_ID };

const sysIcon = registerIcon('sys-icon', Codicon.symbolStructure, nls.localize('sysIcon', 'Sys semantic workbench icon'));

const viewContainer = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).registerViewContainer(
	{
		id: SYS_VIEW_CONTAINER_ID,
		title: nls.localize2('sys', 'Sys'),
		icon: sysIcon,
		ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [SYS_VIEW_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
		hideIfEmpty: false,
		order: 5,
	},
	ViewContainerLocation.Sidebar,
	{ isDefault: true }
);

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([
	{
		id: SYS_VIEW_ID,
		name: nls.localize2('sysSemanticWorkbench', 'Semantic Workbench'),
		containerIcon: sysIcon,
		ctorDescriptor: new SyncDescriptor(SysSemanticWorkbenchView),
		canToggleVisibility: false,
		canMoveView: false,
		hideByDefault: false,
	},
	{
		id: SYS_VERIFICATION_VIEW_ID,
		name: nls.localize2('sysVerificationWorkbench', 'Verification'),
		containerIcon: sysIcon,
		ctorDescriptor: new SyncDescriptor(SysVerificationWorkbenchView),
		canToggleVisibility: false,
		canMoveView: false,
		hideByDefault: false,
	},
], viewContainer);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'sys.verification',
	title: nls.localize('sysVerificationConfig', 'Sys Verification'),
	type: 'object',
	properties: {
		'sys.verification.dataSource': {
			type: 'string',
			enum: ['live', 'fixture'],
			default: 'live',
			description: nls.localize('sysVerificationDataSource', 'Where the Verification view gets data. A failing live run shows an error; it never falls back to the fixture.')
		},
		'sys.verification.platformBinary': {
			type: 'string',
			default: '',
			description: nls.localize('sysVerificationBinary', 'Absolute path to the sys-platform spec-code-sync executable.')
		},
		'sys.verification.manifestPath': {
			type: 'string',
			default: '',
			description: nls.localize('sysVerificationManifest', 'Absolute path to the verification manifest JSON passed to `spec-code-sync verification-v0.1`.')
		},
		'sys.verification.timeoutMs': {
			type: 'number',
			default: 60000,
			description: nls.localize('sysVerificationTimeout', 'Timeout for a live verification run, in milliseconds.')
		}
	}
});

class SysBehaviorCodeLensContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.sysBehaviorCodeLens';

	constructor(@ILanguageFeaturesService languageFeatures: ILanguageFeaturesService) {
		super();
		this._register(languageFeatures.codeLensProvider.register(
			{ pattern: '**/*.intent.review.md' },
			new SysBehaviorCodeLensProvider()
		));
	}
}

registerWorkbenchContribution2(SysBehaviorCodeLensContribution.ID, SysBehaviorCodeLensContribution, WorkbenchPhase.AfterRestored);

CommandsRegistry.registerCommand('sys.pointToCode', async (accessor: ServicesAccessor, requirementId: string, scenarioName: string) => {
	const projectService = accessor.get(ISysProjectService);
	const workspaceContextService = accessor.get(IWorkspaceContextService);
	const notificationService = accessor.get(INotificationService);
	const quickInputService = accessor.get(IQuickInputService);
	const editorService = accessor.get(IEditorService);

	const platformRoot = await projectService.getPlatformRoot();
	const workspace = workspaceContextService.getWorkspace().folders[0]?.uri.fsPath;
	if (!platformRoot || !workspace) {
		notificationService.notify({ severity: Severity.Info, message: 'Set the Sys Platform root (Semantic Workbench view) before using Point to code.' });
		return;
	}

	const record = await projectService.readFormalSpec(requirementId);
	if (!record?.draft.operation?.value || record.state !== 'APPROVED') {
		notificationService.notify({ severity: Severity.Info, message: 'This requirement has no confirmed operation yet.' });
		return;
	}

	const transport = new TaskProcessTransport(accessor.get(ISideXTaskService), accessor.get(IFileService));
	const result = await readCandidates(transport, platformRoot, workspace, record.draft.operation.value);
	if (result.kind === 'UNAVAILABLE') {
		notificationService.notify({ severity: Severity.Info, message: `Could not read candidates: ${result.reason}` });
		return;
	}

	const scenario = result.result.scenarios.find(s => s.scenario === scenarioName);
	if (!scenario || scenario.candidates.length === 0) {
		notificationService.notify({ severity: Severity.Info, message: scenario?.reason ?? result.result.reason ?? 'No candidates found for this scenario.' });
		return;
	}

	const picked = await quickInputService.pick(
		scenario.candidates.map((candidate: SysCandidateFunction) => ({
			label: candidate.name,
			description: candidate.file,
			detail: candidate.thenObserved ? 'then not checked as satisfied — evidence found, not verified' : undefined,
			candidate
		})),
		{ placeHolder: `Candidates for "${scenarioName}"` }
	);
	if (!picked) { return; }
	await editorService.openEditor({ resource: URI.joinPath(workspaceContextService.getWorkspace().folders[0].uri, picked.candidate.file) });
});
