/**
 * PROTOTYPE — fake data, no platform behind it.
 *
 * Exists so the workflow can be judged by clicking through it in the real editor before the
 * system ontology is built. Every verdict here is written by hand. Delete this file and
 * `sysPrototype.ts` together when the real thing lands; nothing else imports them.
 */
export type SysVerdict = 'SATISFIED' | 'CONTRADICTED' | 'NOT_OBSERVED';

export interface SysDecision {
	/** What was decided, in the words a person would say it. */
	readonly chosen: string;
	readonly because: string;
	readonly when: string;
	readonly alternatives: readonly string[];
}

export interface SysWitness {
	/** Matched against the file's text, so the prototype survives edits and regeneration. */
	readonly pattern: RegExp;
	/** Shown on the squiggle: why this line breaks the obligation, in one clause. */
	readonly note?: string;
}

export interface SysObligation {
	readonly id: string;
	readonly requirement: string;
	/** The concept this is about, so an intent page can ask "where is this realised?". */
	readonly concept: string;
	/** The obligation as a person reads it — never a predicate name, never a code. */
	readonly says: string;
	readonly verdict: SysVerdict;
	/** Files this obligation is about, matched by path suffix. */
	readonly files: readonly string[];
	readonly witnesses: readonly SysWitness[];
	readonly decision?: SysDecision;
	/** Offered by the exception action when the obligation can be narrowed rather than waived. */
	readonly narrowerForm?: string;
}

export const SYS_PROTOTYPE_OBLIGATIONS: readonly SysObligation[] = [
	{
		id: 'st:book-needs-category',
		requirement: 'REQ-001',
		concept: 'Book',
		says: 'A Book cannot exist without its Category',
		verdict: 'CONTRADICTED',
		files: ['Book.java'],
		witnesses: [
			{ pattern: /public\s+Book\s*\(\s*\)/, note: 'leaves category unset' },
			{ pattern: /^\s*(?:private|protected)\s+(?!final\b)[\w<>]*\s*Category\s+\w+\s*;/m, note: 'not final, so it can be replaced later' }
		],
		decision: {
			chosen: 'Forbid orphaned books outright',
			because: 'orphaned books corrupted the catalogue in March 2024',
			when: '2024-03',
			alternatives: ['allow orphans and sweep them periodically', 'forbid outright']
		},
		narrowerForm: 'No business operation constructs a Book without a Category'
	},
	{
		id: 'st:category-identified',
		requirement: 'REQ-001',
		concept: 'Category',
		says: 'Category is identified',
		verdict: 'SATISFIED',
		files: ['Category.java'],
		witnesses: [{ pattern: /\b(?:int|long|String|UUID)\s+id\s*[;=)]/ }]
	},
	{
		id: 'st:book-has-title',
		requirement: 'REQ-001',
		concept: 'Book',
		says: 'Book has a title',
		verdict: 'SATISFIED',
		files: ['Book.java'],
		witnesses: [{ pattern: /\bString\s+title\s*[;=)]/ }]
	},
	{
		// The common case, and the one with nowhere to live in the code: an obligation nothing in
		// the source honours or breaks cannot be a diagnostic, because there is no line to mark.
		id: 'st:category-name-not-empty',
		requirement: 'REQ-001',
		concept: 'Category',
		says: 'A Category name is never empty',
		verdict: 'NOT_OBSERVED',
		files: ['Category.java'],
		witnesses: [],
		decision: {
			chosen: 'Require a non-empty name',
			because: 'blank category names made the catalogue unreadable',
			when: '2025-11',
			alternatives: ['allow blank and render a placeholder', 'require non-empty']
		}
	}
];
