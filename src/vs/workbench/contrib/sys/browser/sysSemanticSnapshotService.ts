import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ISysSemanticSnapshotService, SysProjectSnapshot } from '../common/sysSemanticSnapshot.js';
import { CINEMA_BOOKING_SNAPSHOT } from '../common/sysSemanticSnapshotFixture.js';

class SysSemanticSnapshotService implements ISysSemanticSnapshotService {
	readonly _serviceBrand: undefined;

	getSnapshot(): Promise<SysProjectSnapshot> {
		// Live contract wiring lands with the platform firewall. Keep the gap explicit.
		return Promise.resolve(CINEMA_BOOKING_SNAPSHOT);
	}
}

registerSingleton(ISysSemanticSnapshotService, SysSemanticSnapshotService, InstantiationType.Delayed);
