/**
 * Checks a requirement's Formal Spec text by running the exact binary spec-code-sync's own pipeline uses to
 * compile the expected side (`ontology-compiler compile <spec>`). A nonzero exit is that tool's normal "no"
 * answer for bad spec text (PARSE_ERROR); a transport failure (missing binary, timeout) is CHECK_ERROR.
 * Never a semantic verdict: this only says whether the text parses.
 */
import { VerificationTransport } from './sysVerificationLive.js';

export type SpecCheckResult = { readonly kind: 'PARSE_OK' } | { readonly kind: 'PARSE_ERROR'; readonly reason: string } | { readonly kind: 'CHECK_ERROR'; readonly reason: string };

export function ontologyCompilerBinary(platformRoot: string): string {
	return `${platformRoot}/ontology-compiler/target/debug/ontology-compiler`;
}

export async function runSpecCheck(transport: Pick<VerificationTransport, 'run'>, platformRoot: string, specFile: string, timeoutMs = 60000): Promise<SpecCheckResult> {
	let result;
	try {
		result = await transport.run(ontologyCompilerBinary(platformRoot), ['compile', specFile], timeoutMs);
	} catch (e) {
		return { kind: 'CHECK_ERROR', reason: e instanceof Error ? e.message : String(e) };
	}
	return result.exitCode === 0 ? { kind: 'PARSE_OK' } : { kind: 'PARSE_ERROR', reason: result.stderr.trim().slice(0, 500) || `exit ${result.exitCode}` };
}
