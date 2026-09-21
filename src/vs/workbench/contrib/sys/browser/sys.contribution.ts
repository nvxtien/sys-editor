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
import './sysSemanticSnapshotService.js';
import './sysIntentActionService.js';
import './sysVerificationProviderService.js';

export const SYS_VIEW_CONTAINER_ID = 'workbench.view.sys';
export const SYS_VIEW_ID = 'workbench.view.sys.semanticWorkbench';
export const SYS_VERIFICATION_VIEW_ID = 'workbench.view.sys.verificationWorkbench';

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
