/*---------------------------------------------------------------------------------------------
 *  Sys Human Intent Actions v0.1 - Intent Action Service Implementation
 *--------------------------------------------------------------------------------------------*/

import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { CINEMA_BOOKING_INTENT_ITEMS, ISysIntentActionService, SysGovernanceState, SysIntentItem, SysIntentItemDetails, SysIntentStatus } from '../common/sysIntentAction.js';

const SYS_INTENT_ITEMS_KEY = 'sys.intentItems';

/**
 * In-memory replacement state (not persisted, only for current session).
 */
interface ReplacementState {
	oldMeaning?: string;
	newMeaning?: string;
}

/**
 * Service that manages human intent interaction state.
 * Uses workspace storage for persistence across sessions.
 */
class SysIntentActionService extends Disposable implements ISysIntentActionService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeIntentItems = this._register(new Emitter<void>());
	readonly onDidChangeIntentItems: Event<void> = this._onDidChangeIntentItems.event;

	private intentItems: Map<string, SysIntentItem> = new Map();
	private replacementStates: Map<string, ReplacementState> = new Map();

	constructor(
		@IStorageService private readonly storageService: IStorageService
	) {
		super();
		// Initialize from storage or fixture
		void this.initialize();
	}

	private async initialize(): Promise<void> {
		// Try to load from storage
		const stored = this.storageService.getObject<SysIntentItem[]>(SYS_INTENT_ITEMS_KEY, StorageScope.WORKSPACE);
		if (stored && stored.length > 0) {
			// Validate and load stored items
			for (const item of stored) {
				if (this.isValidIntentItem(item)) {
					this.intentItems.set(item.id, { ...item });
				}
			}
		} else {
			// Initialize from fixture
			for (const item of CINEMA_BOOKING_INTENT_ITEMS) {
				this.intentItems.set(item.id, { ...item });
			}
		}
	}

	private isValidIntentItem(item: unknown): item is SysIntentItem {
		if (!item || typeof item !== 'object') {
			return false;
		}
		const i = item as Record<string, unknown>;
		return (
			typeof i.id === 'string' &&
			typeof i.title === 'string' &&
			typeof i.question === 'string' &&
			(i.status === 'UNRESOLVED' || i.status === 'CANDIDATE' || i.status === 'CONFIRMED') &&
			typeof i.leftOpenByHuman === 'boolean' &&
			(i.governanceState === 'NOT_GOVERNED' || i.governanceState === 'GOVERNED')
		);
	}

	private persist(): void {
		const items: SysIntentItem[] = [];
		for (const item of this.intentItems.values()) {
			items.push({ ...item });
		}
		this.storageService.store(
			SYS_INTENT_ITEMS_KEY,
			JSON.stringify(items),
			StorageScope.WORKSPACE,
			StorageTarget.USER
		);
		this._onDidChangeIntentItems.fire();
	}

	async getIntentItems(): Promise<readonly SysIntentItem[]> {
		return Array.from(this.intentItems.values());
	}

	async getIntentItemDetails(id: string): Promise<SysIntentItemDetails | undefined> {
		const item = this.intentItems.get(id);
		if (!item) {
			return undefined;
		}

		const replacementState = this.replacementStates.get(id);
		return {
			item: { ...item },
			isReplacing: replacementState !== undefined,
			replacementOldMeaning: replacementState?.oldMeaning,
			replacementNewMeaning: replacementState?.newMeaning
		};
	}

	async proposeClarification(id: string, text: string): Promise<void> {
		const item = this.intentItems.get(id);
		if (!item) {
			return;
		}

		// Store exact user text (H2: candidate text is exact)
		const candidateMeaning = text;

		// Only update if status allows transition UNRESOLVED -> CANDIDATE
		if (item.status === 'UNRESOLVED') {
			this.intentItems.set(id, {
				...item,
				status: 'CANDIDATE',
				candidateMeaning,
				leftOpenByHuman: false
			});
			// Clear any pending replacement
			this.replacementStates.delete(id);
			this.persist();
		}
	}

	async confirmClarification(id: string): Promise<void> {
		const item = this.intentItems.get(id);
		if (!item) {
			return;
		}

		// Only update if status allows transition CANDIDATE -> CONFIRMED
		if (item.status === 'CANDIDATE' && item.candidateMeaning !== undefined) {
			this.intentItems.set(id, {
				...item,
				status: 'CONFIRMED',
				confirmedMeaning: item.candidateMeaning,
				candidateMeaning: undefined
			});
			// Clear any pending replacement
			this.replacementStates.delete(id);
			this.persist();
		}
	}

	async leaveUnresolved(id: string): Promise<void> {
		const item = this.intentItems.get(id);
		if (!item) {
			return;
		}

		// Mark as deliberately left open by human (H6)
		// Clear any candidate meaning but keep status as UNRESOLVED
		this.intentItems.set(id, {
			...item,
			status: 'UNRESOLVED',
			candidateMeaning: undefined,
			leftOpenByHuman: true
		});
		// Clear any pending replacement
		this.replacementStates.delete(id);
		this.persist();
	}

	async proposeReplacement(id: string, text: string): Promise<void> {
		const item = this.intentItems.get(id);
		if (!item) {
			return;
		}

		// Only allow replacement for CONFIRMED items (H7)
		if (item.status === 'CONFIRMED' && item.confirmedMeaning !== undefined) {
			this.replacementStates.set(id, {
				oldMeaning: item.confirmedMeaning,
				newMeaning: text
			});
			this._onDidChangeIntentItems.fire();
		}
	}

	async confirmReplacement(id: string): Promise<void> {
		const replacementState = this.replacementStates.get(id);
		const item = this.intentItems.get(id);

		if (!item || !replacementState || !replacementState.newMeaning) {
			return;
		}

		// Only allow if we have an old meaning to replace (H7, H8)
		if (item.status === 'CONFIRMED' && replacementState.oldMeaning !== undefined) {
			this.intentItems.set(id, {
				...item,
				confirmedMeaning: replacementState.newMeaning
			});
			this.replacementStates.delete(id);
			this.persist();
		}
	}

	async cancelReplacement(id: string): Promise<void> {
		this.replacementStates.delete(id);
		this._onDidChangeIntentItems.fire();
	}
}

registerSingleton(ISysIntentActionService, SysIntentActionService, InstantiationType.Delayed);
