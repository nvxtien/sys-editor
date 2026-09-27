/**
 * What the platform says this workspace governs.
 *
 * The editor decides none of it. `system-ontology statements` reads the workspace's specs and
 * answers with statements, the sentence each one reads as, and which concepts it is about; this
 * file carries that answer home and nothing more.
 *
 * There are no verdicts here, because none has been earned: a verdict needs source recovery,
 * which the platform does not do for these statements yet. `GOVERNED_NOT_CHECKED` is the honest
 * state, and rendering it as anything else would be a confident lie.
 */
import { VerificationTransport } from './sysVerificationLive.js';

export interface SysStatement {
	readonly id: string;
	readonly requirement: string;
	readonly predicate: string;
	/** The statement in the words a person reads. Written by the platform, never by the editor. */
	readonly says: string;
	readonly concepts: readonly string[];
	readonly state: string;
}

export interface SysGoverned {
	readonly statements: readonly SysStatement[];
	readonly concepts: readonly string[];
	/** Specs the grammar rejected, named rather than dropped: a statement missing because a file
	 *  failed to parse is indistinguishable from one nobody wrote. */
	readonly unreadable: readonly { readonly requirement: string; readonly reason: string }[];
	/** Present when there was nothing to read, so the caller can say so instead of showing empty. */
	readonly note?: string;
}

export function systemOntologyBinary(platformRoot: string): string {
	return `${platformRoot}/system-ontology/target/debug/system-ontology`;
}

export type SysGovernedResult = { readonly kind: 'READ'; readonly governed: SysGoverned } | { readonly kind: 'UNAVAILABLE'; readonly reason: string };

/**
 * Every failure yields UNAVAILABLE with a reason rather than throwing: a view that cannot reach
 * the platform must say so, not disappear.
 */
export async function readGoverned(transport: Pick<VerificationTransport, 'run'>, platformRoot: string, workspace: string, timeoutMs = 30000): Promise<SysGovernedResult> {
	let result;
	try {
		result = await transport.run(systemOntologyBinary(platformRoot), ['statements', workspace], timeoutMs);
	} catch (error) {
		return { kind: 'UNAVAILABLE', reason: error instanceof Error ? error.message : String(error) };
	}
	if (result.exitCode !== 0) {
		return { kind: 'UNAVAILABLE', reason: result.stderr.trim().slice(0, 300) || `exit ${result.exitCode}` };
	}
	try {
		const governed = JSON.parse(result.stdout) as SysGoverned;
		if (!Array.isArray(governed.statements)) { throw new Error('no statements array'); }
		return { kind: 'READ', governed };
	} catch (error) {
		return { kind: 'UNAVAILABLE', reason: `system-ontology returned something unreadable: ${error instanceof Error ? error.message : String(error)}` };
	}
}

/** Everything the platform governs about one concept, in the order the platform reported it. */
export function governedAbout(governed: SysGoverned, concept: string): readonly SysStatement[] {
	return governed.statements.filter(statement => statement.concepts.includes(concept));
}
