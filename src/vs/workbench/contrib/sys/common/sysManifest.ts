/**
 * Builds a `verification.v0.1` manifest (see spec-code-sync/src/contract.rs `Input`) with exactly one rule,
 * for one requirement's Verify run. `target_operation` is the Formal Spec's own semantic operation, never a
 * source symbol: determining which code that operation corresponds to is sys-platform's responsibility, and
 * `source_anchor` is left out so nothing here claims a mapping the editor has not been told.
 */
const OPERATION_LINE = /^Operation:[ \t]*(.*)$/m;

/** The semantic operation a Formal Spec declares, e.g. `create booking`. Throws when the spec declares none. */
export function specOperation(specText: string): string {
	const operation = OPERATION_LINE.exec(specText)?.[1].trim();
	if (!operation) {
		throw new Error('This Formal Spec declares no `Operation:`. Add one to the spec before verifying.');
	}
	return operation;
}

export interface ManifestInput {
	readonly projectId: string;
	readonly projectRoot: string;
	/** The Formal Spec's semantic operation. */
	readonly operation: string;
	readonly ruleId: string;
	readonly title: string;
	readonly specFile: string;
}

export interface Verification01Manifest {
	readonly project_id: string;
	readonly project_root: string;
	readonly target_operation: string;
	readonly rules: readonly {
		readonly id: string;
		readonly title: string;
		readonly spec_file: string;
		readonly spec_anchor: { readonly kind: 'SPEC'; readonly label: string; readonly file: string };
	}[];
}

export function buildManifest(input: ManifestInput): Verification01Manifest {
	return {
		project_id: input.projectId,
		project_root: input.projectRoot,
		target_operation: input.operation,
		rules: [{
			id: input.ruleId,
			title: input.title,
			spec_file: input.specFile,
			spec_anchor: { kind: 'SPEC', label: `${input.ruleId}.spec`, file: input.specFile }
		}]
	};
}
