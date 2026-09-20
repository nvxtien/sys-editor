import * as nls from '../../../../nls.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainerLocation } from '../../../common/views.js';
import { SysSemanticWorkbenchView } from './sysSemanticWorkbenchView.js';
import './sysSemanticSnapshotService.js';
import './sysIntentActionService.js';

export const SYS_VIEW_CONTAINER_ID = 'workbench.view.sys';
export const SYS_VIEW_ID = 'workbench.view.sys.semanticWorkbench';

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
], viewContainer);
