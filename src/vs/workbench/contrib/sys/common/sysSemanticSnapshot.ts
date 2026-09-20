import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export type SysKnowledgeState = 'KNOWN' | 'UNKNOWN';
export type SysSyncState = 'PARTIAL' | 'UNKNOWN';
export type SysGovernedIntentState = 'AVAILABLE';

export interface SysGovernedRule {
	readonly id: string;
	readonly label: string;
	readonly description: string;
}

export interface SysOperation {
	readonly name: string;
	readonly rules: readonly SysGovernedRule[];
}

export interface SysSyncItem {
	readonly ruleId: string;
	readonly label: string;
	readonly governed: SysKnowledgeState;
	readonly recovered: SysKnowledgeState;
	readonly state: SysSyncState;
}

export interface SysReview {
	readonly title: string;
	readonly governed: string;
	readonly recovered: string;
	readonly state: string;
	readonly evidence: string;
}

export interface SysEvidence {
	readonly operation: string;
	readonly recoveredSourcePaths: number;
	readonly fullyRecoveredGuards: number;
	readonly falseGreens: number;
	readonly sourceLocation?: string;
}

export interface SysProjectSnapshot {
	readonly project: string;
	readonly governedIntent: SysGovernedIntentState;
	readonly recoveredSourceMeaning: 'PARTIAL';
	readonly sync: SysSyncState;
	readonly unresolvedIntent: readonly string[];
	readonly reviewsRequiringAttention: number;
	readonly operations: readonly SysOperation[];
	readonly governedRules: readonly SysGovernedRule[];
	readonly syncItems: readonly SysSyncItem[];
	readonly reviews: readonly SysReview[];
	readonly evidence: SysEvidence;
}

export const ISysSemanticSnapshotService = createDecorator<ISysSemanticSnapshotService>('sysSemanticSnapshotService');

export interface ISysSemanticSnapshotService {
	readonly _serviceBrand: undefined;
	getSnapshot(): Promise<SysProjectSnapshot>;
}
