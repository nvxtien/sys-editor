/**
 * Builds a `verification.v0.1` manifest (see spec-code-sync/src/contract.rs `Input`) with exactly one rule, for
 * one requirement's Verify run. All fields are human-declared input, mirroring the real manifest schema — this
 * never infers or looks up an operation's location; the caller supplies it.
 */
const OPERATION = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/;

/** Validated immediately before building+running a manifest — never stored as project metadata. */
export function validateTargetOperation(text: string): string | undefined {
	return OPERATION.test(text.trim()) ? undefined : 'Use a qualified name like BookingService.createBooking';
}

export interface ManifestInput {
	readonly projectId: string;
	readonly projectRoot: string;
	readonly targetOperation: string;
	readonly sourceFile: string;
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
		readonly source_anchor: { readonly kind: 'SOURCE'; readonly label: string; readonly file: string; readonly symbol: string };
		readonly spec_anchor: { readonly kind: 'SPEC'; readonly label: string; readonly file: string };
	}[];
}

export function buildManifest(input: ManifestInput): Verification01Manifest {
	const symbol = input.targetOperation.slice(input.targetOperation.lastIndexOf('.') + 1);
	return {
		project_id: input.projectId,
		project_root: input.projectRoot,
		target_operation: input.targetOperation,
		rules: [{
			id: input.ruleId,
			title: input.title,
			spec_file: input.specFile,
			source_anchor: { kind: 'SOURCE', label: input.targetOperation, file: input.sourceFile, symbol },
			spec_anchor: { kind: 'SPEC', label: `${input.ruleId}.spec`, file: input.specFile }
		}]
	};
}
