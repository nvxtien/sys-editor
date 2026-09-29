/**
 * Saying a platform error in a person's words.
 *
 * sys-core names the condition with a stable code; turning that into a sentence is the editor's
 * job, because it is rendering. A reader met with UNKNOWN_PROJECT_LANGUAGE is being shown the
 * platform's own vocabulary — the same thing the review page was cleaned of.
 */
const MESSAGES: Record<string, (detail?: string) => string> = {
	UNKNOWN_PROJECT_LANGUAGE: detail =>
		`Could not tell what language this project is written in, so no code was generated. Looked for ${detail} at the project root.`,
	MISSING_FORMAL_SPEC: () => 'Normalize this requirement first — it has no Formal Spec yet.',
	MISSING_REQUIREMENT: () => 'This requirement no longer exists.',
	IDENTITY_MISMATCH: () => 'The requirement changed after this was reviewed. Review it again before confirming.',
	FORMAL_SPEC_NOT_APPROVED: () => 'Confirm this Formal Spec first: only a confirmed Formal Spec authorizes what comes after it.',
	OPERATION_UNSPECIFIED: () => 'This Formal Spec states no operation, and a Formal Spec must declare one. Clarify which operation the requirement governs and normalize again.',
	NOT_FORMALIZABLE: () => 'Nothing this Formal Spec states can be represented by the current grammar.',
	NO_GENERATED_FILES: () => 'The model answered with no files, so nothing was written.',
	UNSAFE_GENERATED_PATH: detail => `The model named a file outside the project, so nothing was written: ${detail}`,
	INVALID_FORMAL_SPEC_SHAPE: detail => `This Formal Spec cannot be read back: ${detail}`,
	INVALID_KIND: detail => `This Formal Spec states a kind the platform does not know: ${detail}`,
	INVALID_REQUIREMENT_ID: () => 'That requirement id is not one this project can use.'
};

/**
 * `text` is whatever came back from sys-core — a wire error, or plain text from a transport
 * failure that never reached it. Plain text is passed through: rewriting it would hide the only
 * thing a reader has.
 */
export function sysCoreErrorMessage(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) { return 'Sys Platform could not complete this and gave no reason.'; }

	let wire: { error?: unknown; detail?: unknown };
	try {
		wire = JSON.parse(trimmed);
	} catch {
		return trimmed;
	}
	if (typeof wire?.error !== 'string') { return trimmed; }
	const detail = typeof wire.detail === 'string' ? wire.detail : undefined;

	// An unknown code still has to read as a sentence, and still has to name itself so a bug
	// report can quote it.
	return MESSAGES[wire.error]?.(detail)
		?? `Sys Platform could not complete this: ${wire.error}${detail ? ` (${detail})` : ''}.`;
}
