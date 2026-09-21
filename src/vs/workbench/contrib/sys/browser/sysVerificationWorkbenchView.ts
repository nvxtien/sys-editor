import './media/sysSemanticWorkbench.css';
import * as DOM from '../../../../base/browser/dom.js';
import { URI } from '../../../../base/common/uri.js';
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
import { VerificationTransportError } from '../common/sysVerificationWire.js';
import { ISysVerificationDataProvider } from './sysVerificationProviderService.js';
import {
	ALL_DISPOSITIONS,
	DispositionFilter,
	VerificationAnchor,
	VerificationObligation,
	VerificationProject,
	VerificationRule,
	VerificationSemanticView,
	dispositionLabel,
	filterRulesByDisposition,
	pickStableSelection
} from '../common/sysVerification.js';

const $ = DOM.$;

type SemanticViewTab = 'GOVERNED' | 'RECOVERED' | 'VERIFICATION';

export class SysVerificationWorkbenchView extends ViewPane {
	private project: VerificationProject | undefined;
	private loadState: 'IDLE' | 'LOADING' | 'READY' | 'ERROR' = 'IDLE';
	private loadError: string | undefined;
	private loadPromise: Promise<void> | undefined;
	private bodyContainer: HTMLElement | undefined;

	private filter: DispositionFilter = 'ALL';
	private selectedRuleId: string | undefined;
	private expandedObligationIds = new Set<string>();
	private activeTabByObligationId = new Map<string, SemanticViewTab>();

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
		@ISysVerificationDataProvider private readonly dataProvider: ISysVerificationDataProvider
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
	}

	protected override renderBody(parent: HTMLElement): void {
		this.bodyContainer = parent;
		super.renderBody(parent);
		parent.classList.add('sys-semantic-workbench');
		void this.load();
	}

	private async load(): Promise<void> {
		if (this.loadPromise) {
			return this.loadPromise;
		}
		this.loadState = 'LOADING';
		this.loadPromise = (async () => {
			try {
				const project = await this.dataProvider.getProject();
				this.selectedRuleId = pickStableSelection(project.rules, this.selectedRuleId);
				const ids = new Set(project.rules.flatMap(r => r.obligations.map(o => o.id)));
				this.expandedObligationIds = new Set([...this.expandedObligationIds].filter(id => ids.has(id)));
				this.project = project;
				this.loadState = 'READY';
				this.loadError = undefined;
			} catch (error) {
				this.loadState = 'ERROR';
				this.project = undefined;
				this.selectedRuleId = undefined;
				this.loadError = error instanceof VerificationTransportError ? `${error.code}: ${error.message}` : String(error);
				console.error('[SysVerificationWorkbenchView] load failed', error instanceof Error ? error.message : error);
			} finally {
				this.loadPromise = undefined;
				if (this.bodyContainer) {
					this._renderContent(this.bodyContainer);
				}
			}
		})();
		return this.loadPromise;
	}

	private _renderContent(parent: HTMLElement): void {
		parent.textContent = '';

		if (this.loadState === 'LOADING' && !this.project) {
			DOM.append(parent, $('p')).textContent = 'Loading verification data...';
			return;
		}
		if (this.loadState === 'ERROR') {
			DOM.append(parent, $('p.sys-verification-unavailable')).textContent = `Unable to load verification data — ${this.loadError ?? 'unknown error'}. This is an infrastructure error, not a verification result.`;
			this._refreshButton(parent);
			return;
		}
		const project = this.project;
		if (!project) {
			return;
		}

		const header = DOM.append(parent, $('div.sys-header'));
		DOM.append(header, $('div.sys-eyebrow')).textContent = 'SEMANTIC VERIFICATION';
		DOM.append(header, $('h1.sys-title')).textContent = project.projectId;
		DOM.append(header, $('p.sys-subtitle')).textContent = 'Governed intent vs. recovered meaning, with evidence';
		DOM.append(header, $('p.sys-subtitle')).textContent = `Data source: ${project.dataSource ?? 'UNKNOWN'}`;
		this._refreshButton(header);

		if (project.contractStatus === 'PLATFORM_CONTRACT_GAP') {
			const gap = DOM.append(parent, $('section.sys-section'));
			DOM.append(gap, $('p.sys-verification-unavailable')).textContent =
				'Platform verification contract gap: the live platform does not yet expose structured verification data. Showing no live rules.';
			if (project.missingPlatformFields?.length) {
				DOM.append(gap, $('p.sys-detail-value')).textContent = `Missing: ${project.missingPlatformFields.join(', ')}`;
			}
			return;
		}

		const filterSection = DOM.append(parent, $('section.sys-section'));
		DOM.append(filterSection, $('h2.sys-section-title')).textContent = 'Filter by disposition';
		const filterBar = DOM.append(filterSection, $('div.sys-verification-filters'));
		this._filterButton(filterBar, 'ALL', 'All');
		for (const disposition of ALL_DISPOSITIONS) {
			this._filterButton(filterBar, disposition, dispositionLabel(disposition));
		}

		const listSection = DOM.append(parent, $('section.sys-section'));
		DOM.append(listSection, $('h2.sys-section-title')).textContent = 'Governed rules';
		const list = DOM.append(listSection, $('div.sys-verification-rule-list'));
		const visibleRules = filterRulesByDisposition(project.rules, this.filter);
		if (!visibleRules.length) {
			DOM.append(list, $('p.sys-list-empty')).textContent = 'No rules match this filter.';
		}
		for (const rule of visibleRules) {
			this._renderRuleRow(list, rule);
		}
	}

	private _refreshButton(parent: HTMLElement): void {
		const btn = DOM.append(parent, $('button.sys-verification-filter-btn'));
		btn.textContent = 'Refresh';
		btn.addEventListener('click', () => void this.load());
	}

	private _filterButton(parent: HTMLElement, filter: DispositionFilter, label: string): void {
		const btn = DOM.append(parent, $('button.sys-verification-filter-btn'));
		btn.textContent = label;
		if (this.filter === filter) {
			btn.classList.add('sys-verification-filter-active');
		}
		btn.addEventListener('click', () => {
			this.filter = filter;
			if (this.bodyContainer) {
				this._renderContent(this.bodyContainer);
			}
		});
	}

	private _renderRuleRow(parent: HTMLElement, rule: VerificationRule): void {
		const row = DOM.append(parent, $('div.sys-verification-rule-row'));
		if (this.selectedRuleId === rule.id) {
			row.classList.add('sys-verification-rule-selected');
		}
		DOM.append(row, $('span.sys-verification-rule-id')).textContent = rule.id;
		DOM.append(row, $('span.sys-verification-rule-title')).textContent = rule.title;
		this._dispositionBadge(row, rule.aggregateDisposition);
		row.addEventListener('click', () => {
			this.selectedRuleId = this.selectedRuleId === rule.id ? undefined : rule.id;
			if (this.bodyContainer) {
				this._renderContent(this.bodyContainer);
			}
		});

		if (this.selectedRuleId === rule.id) {
			this._renderRuleDetail(parent, rule);
		}
	}

	private _renderRuleDetail(parent: HTMLElement, rule: VerificationRule): void {
		const detail = DOM.append(parent, $('div.sys-obligation-body'));

		if (rule.obligations.length > 1) {
			DOM.append(detail, $('p.sys-verification-aggregate-note')).textContent =
				`Aggregate is ${dispositionLabel(rule.aggregateDisposition)}. Each obligation below keeps its own disposition; a synced obligation never implies the aggregate is synced.`;
		}

		if (rule.evidence?.length) {
			DOM.append(detail, $('div.sys-semantic-view-evidence')).textContent = `Rule evidence\n${rule.evidence.join('\n')}`;
		}
		for (const obligation of rule.obligations) {
			this._renderObligation(detail, obligation);
		}
	}

	private _renderObligation(parent: HTMLElement, obligation: VerificationObligation): void {
		const container = DOM.append(parent, $('div.sys-obligation'));
		const header = DOM.append(container, $('div.sys-obligation-header'));
		DOM.append(header, $('span.sys-obligation-kind')).textContent = obligation.kind;
		this._dispositionBadge(header, obligation.disposition);

		const isExpanded = this.expandedObligationIds.has(obligation.id);
		header.addEventListener('click', () => {
			if (this.expandedObligationIds.has(obligation.id)) {
				this.expandedObligationIds.delete(obligation.id);
			} else {
				this.expandedObligationIds.add(obligation.id);
			}
			if (this.bodyContainer) {
				this._renderContent(this.bodyContainer);
			}
		});

		if (!isExpanded) {
			return;
		}

		const body = DOM.append(container, $('div.sys-obligation-body'));

		const tabs = DOM.append(body, $('div.sys-verification-view-tabs'));
		const activeTab = this.activeTabByObligationId.get(obligation.id) ?? 'GOVERNED';
		this._tabButton(tabs, obligation.id, 'GOVERNED', activeTab);
		this._tabButton(tabs, obligation.id, 'RECOVERED', activeTab);
		this._tabButton(tabs, obligation.id, 'VERIFICATION', activeTab);

		if (activeTab === 'GOVERNED') {
			this._renderSemanticView(body, obligation.governed);
		} else if (activeTab === 'RECOVERED') {
			this._renderSemanticView(body, obligation.recovered);
		} else {
			this._renderVerification(body, obligation);
		}

		this._renderEvidenceAndNavigation(body, obligation);
	}

	private _tabButton(parent: HTMLElement, obligationId: string, tab: SemanticViewTab, activeTab: SemanticViewTab): void {
		const btn = DOM.append(parent, $('button.sys-verification-view-tab'));
		btn.textContent = tab.charAt(0) + tab.slice(1).toLowerCase();
		if (tab === activeTab) {
			btn.classList.add('sys-verification-view-tab-active');
		}
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.activeTabByObligationId.set(obligationId, tab);
			if (this.bodyContainer) {
				this._renderContent(this.bodyContainer);
			}
		});
	}

	private _renderSemanticView(parent: HTMLElement, view: VerificationSemanticView | undefined): void {
		if (!view) {
			DOM.append(parent, $('p.sys-verification-unavailable')).textContent = 'Data unavailable.';
			return;
		}
		const block = DOM.append(parent, $('div.sys-semantic-view-block'));
		const summaryRow = DOM.append(block, $('div.sys-semantic-view-summary'));
		summaryRow.textContent = view.summary;
		const provenanceBadge = DOM.append(summaryRow, $(`span.sys-provenance-badge.sys-provenance-${view.provenance}`));
		provenanceBadge.textContent = view.provenance;
		if (view.expression) {
			DOM.append(block, $('div.sys-semantic-view-expression')).textContent = view.expression;
		}
		if (view.evidence?.length) {
			DOM.append(block, $('div.sys-semantic-view-evidence')).textContent = view.evidence.join('\n');
		}
		if (view.completeness) {
			DOM.append(block, $('div.sys-detail-value')).textContent = `Completeness: ${view.completeness}`;
		}
	}

	private _renderVerification(parent: HTMLElement, obligation: VerificationObligation): void {
		const block = DOM.append(parent, $('div.sys-semantic-view-block'));
		if (obligation.proof?.length) {
			DOM.append(block, $('div.sys-semantic-view-evidence')).textContent = obligation.proof.join('\n');
		}
		if (obligation.why) {
			DOM.append(block, $('div.sys-semantic-view-summary')).textContent = `Why ${dispositionLabel(obligation.disposition)}: ${obligation.why}`;
		} else if (!obligation.proof?.length) {
			DOM.append(block, $('p.sys-verification-unavailable')).textContent = 'No proof obligation available for this disposition.';
		}
		if (obligation.reasons.length) {
			DOM.append(block, $('div.sys-semantic-view-evidence')).textContent = `Reasons: ${obligation.reasons.join(', ')}`;
		}
		const completenessRow = DOM.append(block, $('div.sys-detail'));
		DOM.append(completenessRow, $('span.sys-detail-label')).textContent = 'Completeness:';
		DOM.append(completenessRow, $('span.sys-detail-value')).textContent = obligation.completeness
			?? (obligation.governed?.completeness || obligation.recovered?.completeness
				? `governed=${obligation.governed?.completeness ?? 'MISSING'}, recovered=${obligation.recovered?.completeness ?? 'MISSING'}`
				: 'UNKNOWN');
	}

	private _renderEvidenceAndNavigation(parent: HTMLElement, obligation: VerificationObligation): void {
		const section = DOM.append(parent, $('div.sys-list-section'));
		DOM.append(section, $('h3.sys-subsection-title')).textContent = 'Evidence / Navigation';
		if (obligation.evidence !== undefined) {
			DOM.append(section, $('div.sys-semantic-view-evidence')).textContent = obligation.evidence.length ? obligation.evidence.join('\n') : 'Evidence: none provided by platform.';
		}
		if (!obligation.anchors.length) {
			DOM.append(section, $('p.sys-list-empty')).textContent = 'No source or spec anchors available.';
			return;
		}
		for (const anchor of obligation.anchors) {
			this._renderAnchor(section, anchor);
		}
	}

	private _renderAnchor(parent: HTMLElement, anchor: VerificationAnchor): void {
		const btn = DOM.append(parent, $<HTMLButtonElement>('button.sys-verification-anchor'));
		btn.textContent = `[${anchor.kind}] ${anchor.label}`;
		if (!anchor.file) {
			btn.disabled = true;
			btn.title = 'No navigable location for this anchor.';
			return;
		}
		if (anchor.range) {
			btn.title = `range: ${anchor.range}`;
		}
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			const target = anchor.file!.includes('://') ? URI.parse(anchor.file!) : URI.file(anchor.file!);
			this.openerService.open(target).catch(err => {
				btn.title = `Unable to open ${anchor.file}: ${err instanceof Error ? err.message : err}`;
				btn.textContent = `[${anchor.kind}] ${anchor.label} — cannot open`;
			});
		});
	}

	private _dispositionBadge(parent: HTMLElement, disposition: VerificationObligation['disposition']): void {
		const badge = DOM.append(parent, $(`span.sys-disposition-badge.sys-disposition-${disposition}`));
		badge.textContent = dispositionLabel(disposition);
	}
}
