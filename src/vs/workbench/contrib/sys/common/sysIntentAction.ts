/*---------------------------------------------------------------------------------------------
 *  Sys Human Intent Actions v0.1 - Intent Action State Model
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

/**
 * Governance state of an intent item.
 * Distinct from the interaction status - governance is external authority.
 */
export type SysGovernanceState = 'NOT_GOVERNED' | 'GOVERNED';

/**
 * Interaction status of an intent item within the GUI.
 */
export type SysIntentStatus = 'UNRESOLVED' | 'CANDIDATE' | 'CONFIRMED';

/**
 * Represents a single intent item that a human can interact with.
 */
export interface SysIntentItem {
	readonly id: string;
	readonly title: string;
	readonly question: string;
	readonly status: SysIntentStatus;
	readonly candidateMeaning?: string;
	readonly confirmedMeaning?: string;
	readonly leftOpenByHuman: boolean;
	readonly governanceState: SysGovernanceState;
}

/**
 * Information about a specific intent item for display in the detail view.
 */
export interface SysIntentItemDetails {
	readonly item: SysIntentItem;
	readonly isReplacing: boolean;
	readonly replacementOldMeaning?: string;
	readonly replacementNewMeaning?: string;
}

/**
 * Commands available in the intent action service.
 */
export interface ISysIntentActionService {
	readonly _serviceBrand: undefined;

	/**
	 * Get all intent items for the current project.
	 */
	getIntentItems(): Promise<readonly SysIntentItem[]>;

	/**
	 * Get details for a specific intent item.
	 */
	getIntentItemDetails(id: string): Promise<SysIntentItemDetails | undefined>;

	/**
	 * Propose a clarification for an unresolved item.
	 * Moves status from UNRESOLVED to CANDIDATE.
	 */
	proposeClarification(id: string, text: string): Promise<void>;

	/**
	 * Confirm the proposed clarification.
	 * Moves status from CANDIDATE to CONFIRMED.
	 * Records the exact user text as confirmedMeaning.
	 */
	confirmClarification(id: string): Promise<void>;

	/**
	 * Explicitly leave an item unresolved.
	 * Sets leftOpenByHuman = true, status remains UNRESOLVED.
	 */
	leaveUnresolved(id: string): Promise<void>;

	/**
	 * Propose a replacement for an already confirmed item.
	 * Does not change state until confirmReplacement is called.
	 */
	proposeReplacement(id: string, text: string): Promise<void>;

	/**
	 * Confirm the replacement, replacing the old confirmed meaning.
	 */
	confirmReplacement(id: string): Promise<void>;

	/**
	 * Cancel a proposed replacement.
	 */
	cancelReplacement(id: string): Promise<void>;

	/**
	 * Subscribe to changes in intent items.
	 */
	readonly onDidChangeIntentItems: import('../../../../base/common/event.js').Event<void>;
}

/**
 * Decorator for ISysIntentActionService dependency injection.
 */
export const ISysIntentActionService = createDecorator<ISysIntentActionService>('sysIntentActionService');

/**
 * Cinema Booking fixture intent items for v0.1.
 * These are the initial unresolved items from the semantic snapshot.
 */
export const CINEMA_BOOKING_INTENT_ITEMS: SysIntentItem[] = [
	{
		id: 'customer-validation',
		title: 'customer validation',
		question: 'The specification defines customer.name and customer.phone but does not define validation semantics.',
		status: 'UNRESOLVED',
		leftOpenByHuman: false,
		governanceState: 'NOT_GOVERNED'
	},
	{
		id: 'status-transition-rules',
		title: 'status transition rules',
		question: 'The specification does not define when a booking can transition between statuses.',
		status: 'UNRESOLVED',
		leftOpenByHuman: false,
		governanceState: 'NOT_GOVERNED'
	}
];
