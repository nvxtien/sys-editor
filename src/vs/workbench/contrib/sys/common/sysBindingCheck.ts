/**
 * Checks that a bound `Class.method` name is present in the project's program IR — reusing the exact mechanism
 * sys-platform itself uses to recover an operation (`java reverse.ProjectMain <project-root>`, JSON on stdout).
 * This is a name lookup, never semantic verification: FOUND/NOT_FOUND is not SYNCED/VERIFIED.
 */
import { VerificationTransport } from './sysVerificationLive.js';

export type BindingCheckResult = { readonly kind: 'FOUND' } | { readonly kind: 'NOT_FOUND' } | { readonly kind: 'CHECK_ERROR'; readonly reason: string };

export interface PlatformConfig {
	/** Root of the sys-platform checkout: `<platformRoot>/build/classes` must exist. */
	readonly platformRoot: string;
	readonly projectRoot: string;
}

/** Reads only `functions[].name`, the same field `spec-code-sync`'s pipeline reads from this program IR. */
export function decodeProgramIrFunctionNames(programIrJson: string): string[] {
	try {
		const value = JSON.parse(programIrJson) as { functions?: unknown };
		if (!Array.isArray(value.functions)) { return []; }
		return value.functions.filter((f): f is { name: string } => !!f && typeof (f as { name?: unknown }).name === 'string').map(f => f.name);
	} catch {
		return [];
	}
}

export function checkBinding(programIrJson: string, operation: string): BindingCheckResult {
	return decodeProgramIrFunctionNames(programIrJson).includes(operation) ? { kind: 'FOUND' } : { kind: 'NOT_FOUND' };
}

export async function runBindingCheck(transport: Pick<VerificationTransport, 'run'>, config: PlatformConfig, operation: string, timeoutMs = 60000): Promise<BindingCheckResult> {
	const result = await transport.run('java', ['-cp', `${config.platformRoot}/build/classes`, 'reverse.ProjectMain', config.projectRoot], timeoutMs);
	if (result.exitCode !== 0) {
		return { kind: 'CHECK_ERROR', reason: `reverse.ProjectMain exited ${result.exitCode}: ${result.stderr.trim().slice(0, 500)}` };
	}
	try {
		JSON.parse(result.stdout);
	} catch (e) {
		return { kind: 'CHECK_ERROR', reason: `reverse.ProjectMain produced non-JSON output: ${(e as Error).message}` };
	}
	return checkBinding(result.stdout, operation);
}
