import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export type SysSemanticDisposition = 'SUPPORTED_EXACT' | 'UNSUPPORTED' | 'UNRESOLVED';
export type SysRecoveredState = 'AVAILABLE' | 'PARTIAL' | 'UNKNOWN' | 'NOT_RUN' | 'NOT_AVAILABLE';
export type SysSyncState = 'SYNCED' | 'DRIFTED' | 'PARTIAL' | 'CONFLICTED' | 'NEVER_RUN';
export type SysSnapshotMode = 'FIXTURE' | 'LIVE';
export type SysIntegrationState = 'READY' | 'PLATFORM_API_GAP' | 'UNSUPPORTED_VERSION' | 'ERROR';

export interface SysEvidenceRef { readonly id: string; readonly label: string; readonly location?: string; }
export interface SysSemanticItem { readonly id: string; readonly title: string; readonly displayText: string; readonly disposition: SysSemanticDisposition; readonly reason?: string; readonly evidenceRefs: readonly SysEvidenceRef[]; readonly governedRef?: string; readonly parsed?: boolean; readonly confirmedHumanIntent?: boolean; }
export interface SysRecoveredMeaning { readonly state: SysRecoveredState; readonly operations: readonly string[]; }
export interface SysSyncItem { readonly ruleId: string; readonly label: string; readonly state: SysSyncState; readonly eligible: boolean; }

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

export interface SysProjectSnapshot { readonly project: string; readonly mode: SysSnapshotMode; readonly integration: SysIntegrationState; readonly governedIntent: 'AVAILABLE' | 'NOT_AVAILABLE'; readonly semanticItems: readonly SysSemanticItem[]; readonly recoveredMeaning: SysRecoveredMeaning; readonly sync: SysSyncState; readonly reviewsRequiringAttention: number; readonly reviews: readonly SysReview[]; readonly syncItems: readonly SysSyncItem[]; readonly evidence: SysEvidence; }

export const ISysSemanticSnapshotService = createDecorator<ISysSemanticSnapshotService>('sysSemanticSnapshotService');

export interface ISysSemanticSnapshotService {
	readonly _serviceBrand: undefined;
	getSnapshot(): Promise<SysProjectSnapshot>;
}
