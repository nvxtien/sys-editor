import './media/sysSemanticWorkbench.css';
import * as DOM from '../../../../base/browser/dom.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { ViewPane, IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { ISysSemanticSnapshotService, SysProjectSnapshot } from '../common/sysSemanticSnapshot.js';
import {
	ISysIntentActionService,
	SysIntentItem,
	SysIntentItemDetails,
	SysIntentStatus
} from '../common/sysIntentAction.js';

const $ = DOM.$;

export class SysSemanticWorkbenchView extends ViewPane {
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
		@ISysIntentActionService private readonly intentActionService: ISysIntentActionService
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
		this._metric(summaryGrid, 'Governed intent', snapshot.governedIntent);
		this._metric(summaryGrid, 'Recovered source meaning', snapshot.recoveredSourceMeaning);
		this._metric(summaryGrid, 'Sync', snapshot.sync);

		// Count unresolved and confirmed from intent items
		const unresolvedCount = this.intentItems.filter(i => i.status === 'UNRESOLVED').length;
		const confirmedCount = this.intentItems.filter(i => i.status === 'CONFIRMED').length;

		this._metric(summaryGrid, 'Unresolved intent', String(unresolvedCount));
		this._metric(summaryGrid, 'Confirmed human intent', String(confirmedCount));
		this._metric(summaryGrid, 'Reviews requiring attention', String(snapshot.reviewsRequiringAttention));

		const intent = DOM.append(parent, this._section('Intent'));
		for (const operation of snapshot.operations) {
			const operationBlock = DOM.append(intent, $('div.sys-operation'));
			DOM.append(operationBlock, $('h3.sys-operation-title')).textContent = operation.name;
			for (const rule of operation.rules) {
				const ruleEl = DOM.append(operationBlock, $('div.sys-rule'));
				DOM.append(ruleEl, $('span.sys-status.sys-status-known')).textContent = 'KNOWN';
				DOM.append(ruleEl, $('span.sys-rule-description')).textContent = rule.description;
			}
		}

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
		const headings = ['Rule', 'Governed', 'Recovered', 'State'];
		for (const heading of headings) {
			DOM.append(table, $('div.sys-sync-heading')).textContent = heading;
		}
		for (const item of snapshot.syncItems) {
			DOM.append(table, $('div.sys-sync-cell')).textContent = item.label;
			DOM.append(table, $('div.sys-sync-cell.sys-status-known')).textContent = item.governed;
			DOM.append(table, $('div.sys-sync-cell.sys-status-unknown')).textContent = item.recovered;
			DOM.append(table, $('div.sys-sync-cell.sys-status-partial')).textContent = item.state;
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
