import { VerificationProject } from './sysVerification.js';
import { VerificationTransportError, decodeVerificationV01 } from './sysVerificationWire.js';

export interface LiveVerificationConfig {
	readonly platformBinary: string;
	readonly manifestPath: string;
	readonly timeoutMs: number;
}

export interface ProcessResult {
	readonly exitCode: number | null;
	readonly stdout: string;
	readonly stderr: string;
}

/** Injected so unit tests never need the platform binary. Args are an array: no shell. */
export interface VerificationTransport {
	run(command: string, args: string[], timeoutMs: number): Promise<ProcessResult>;
	exists(path: string): Promise<boolean>;
}

/**
 * Thin transport adapter: `spec-code-sync verification-v0.1 <manifest>` → decode.
 * Every failure is a VerificationTransportError; there is deliberately no fixture fallback here.
 */
export async function loadLiveVerification(transport: VerificationTransport, config: LiveVerificationConfig): Promise<VerificationProject> {
	if (!config.platformBinary || !config.manifestPath) {
		throw new VerificationTransportError('CONFIG_MISSING', 'set sys.verification.platformBinary and sys.verification.manifestPath (or choose data source "fixture")');
	}
	if (!await transport.exists(config.manifestPath)) {
		throw new VerificationTransportError('MANIFEST_NOT_FOUND', config.manifestPath);
	}
	const result = await transport.run(config.platformBinary, ['verification-v0.1', config.manifestPath], config.timeoutMs);
	if (result.exitCode !== 0) {
		throw new VerificationTransportError('PLATFORM_EXECUTION_ERROR', `exit ${result.exitCode}: ${result.stderr.trim().slice(0, 500)}`);
	}
	return decodeVerificationV01(result.stdout);
}
