import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { VerificationProject } from '../common/sysVerification.js';
import { CINEMA_BOOKING_VERIFICATION_PROJECT, LIVE_PLATFORM_CONTRACT_GAP_PROJECT } from '../common/sysVerificationFixture.js';

export const ISysVerificationDataProvider = createDecorator<ISysVerificationDataProvider>('sysVerificationDataProvider');

export interface ISysVerificationDataProvider {
	readonly _serviceBrand: undefined;
	getProject(): Promise<VerificationProject>;
}

/** UI-development / pilot provider. No semantic behavior; returns the fixed pilot dataset. */
export class FixtureVerificationDataProvider implements ISysVerificationDataProvider {
	readonly _serviceBrand: undefined;

	getProject(): Promise<VerificationProject> {
		return Promise.resolve(CINEMA_BOOKING_VERIFICATION_PROJECT);
	}
}

/**
 * Not registered: sys-platform does not yet expose the structured verification fields listed
 * in LIVE_PLATFORM_CONTRACT_GAP_PROJECT.missingPlatformFields. Kept here so the adapter boundary
 * and contract shape exist ahead of the platform change, without faking live integration.
 */
export class LivePlatformVerificationDataProvider implements ISysVerificationDataProvider {
	readonly _serviceBrand: undefined;

	getProject(): Promise<VerificationProject> {
		return Promise.resolve(LIVE_PLATFORM_CONTRACT_GAP_PROJECT);
	}
}

// sys-platform does not yet expose the structured verification contract (governed rule id,
// disposition, obligations, governed/recovered semantic objects, evidence, anchors). Registering
// the fixture provider here keeps the contract PLATFORM_CONTRACT_GAP-honest: swap this line for a
// live provider once that contract lands, without changing the workbench view.
registerSingleton(ISysVerificationDataProvider, FixtureVerificationDataProvider, InstantiationType.Delayed);
