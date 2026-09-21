import { VerificationSourceSpan } from './sysVerification.js';

/** The part of an opened text model the decision needs; lines are 1-based like the editor. */
export interface NavigationModel {
	readonly lineCount: number;
	/** Length of the line + 1, as the editor's `getLineMaxColumn`. */
	lineMaxColumn(line: number): number;
}

export interface NavigationInput {
	readonly span?: VerificationSourceSpan;
	readonly hasSymbol: boolean;
	/** SHA-256 of the file bytes now on disk, `sha256:<hex>`; undefined when it could not be computed. */
	readonly currentDigest?: string;
	/** An editor for this file has unsaved changes, so the model no longer equals the bytes the platform read. */
	readonly dirty: boolean;
	readonly model?: NavigationModel;
}

export interface NavigationRange {
	readonly startLineNumber: number;
	readonly startColumn: number;
	readonly endLineNumber: number;
	readonly endColumn: number;
}

export type NavigationDecision =
	| { readonly action: 'REVEAL_SPAN'; readonly range: NavigationRange; readonly message: string }
	| { readonly action: 'SYMBOL_FALLBACK' }
	| { readonly action: 'FILE_ONLY'; readonly message: string };

/**
 * Order: observed span (only if fresh and it fits the file) -> symbol provider (only when there is no span) -> file only.
 * Nothing is searched or clamped: a span that is stale, unverifiable or outside the file is not revealed.
 */
export function decideNavigation(input: NavigationInput): NavigationDecision {
	const { span } = input;
	if (!span) {
		return input.hasSymbol ? { action: 'SYMBOL_FALLBACK' } : { action: 'FILE_ONLY', message: 'opened file only: no observed location' };
	}
	if (input.dirty) {
		return { action: 'FILE_ONLY', message: 'opened file only: unsaved changes, location may have moved (save and refresh)' };
	}
	if (!input.currentDigest) {
		return { action: 'FILE_ONLY', message: 'opened file only: cannot verify the file is unchanged since verification' };
	}
	if (input.currentDigest !== span.sourceDigest) {
		return { action: 'FILE_ONLY', message: 'opened file only: file changed since verification (refresh)' };
	}
	const model = input.model;
	if (!model || !fits(span, model)) {
		return { action: 'FILE_ONLY', message: 'opened file only: location does not fit this file' };
	}
	return {
		action: 'REVEAL_SPAN',
		range: { startLineNumber: span.startLine, startColumn: span.startColumn, endLineNumber: span.endLine, endColumn: span.endColumn },
		message: 'opened at declaration'
	};
}

function fits(span: VerificationSourceSpan, model: NavigationModel): boolean {
	return span.startLine >= 1 && span.endLine <= model.lineCount
		&& span.startColumn <= model.lineMaxColumn(span.startLine)
		&& span.endColumn <= model.lineMaxColumn(span.endLine);
}
