/**
 * Bounded repair loop for Formal Spec drafting. Clients own LLM calls (sys-core and sys-platform make
 * none): ask the model for a draft, let sys-platform validate it, and when the platform rejects it
 * hand the exact rejection back to the model. The platform stays the only judge; nothing here loosens
 * or reinterprets what it says.
 */
export interface SysDraftRepair {
	readonly previousDraft: string;
	readonly error: string;
}

export interface SysDraftAttempt {
	readonly attempt: number;
	readonly outcome: 'ACCEPTED' | 'REJECTED';
	readonly reason?: string;
}

/** One initial draft plus two repairs. */
export const SYS_DRAFT_MAX_ATTEMPTS = 3;

// How `sys requirement --draft-only` words the platform's verdict on the draft: a parse-stage rejection
// is wrapped, a compile-stage one is not.
const REJECTION_MARKERS = ['draft is not a valid Formal Spec', 'ontology-compiler compile failed'];

/** Only the platform validator's verdict on the draft itself; a missing CLI or a dead server is not one. */
export function isSysDraftRejection(error: unknown): boolean {
	return error instanceof Error && REJECTION_MARKERS.some(marker => error.message.includes(marker));
}

export async function draftFormalSpecWithRepair<T>(options: {
	readonly request: (repair: SysDraftRepair | undefined) => Promise<string>;
	readonly validate: (draft: string) => Promise<T>;
	readonly maxAttempts?: number;
	readonly onAttempt?: (attempt: SysDraftAttempt) => void;
}): Promise<{ readonly result: T; readonly attempts: number }> {
	const maxAttempts = Math.max(1, options.maxAttempts ?? SYS_DRAFT_MAX_ATTEMPTS);
	let repair: SysDraftRepair | undefined;
	for (let attempt = 1; ; attempt++) {
		const draft = await options.request(repair);
		try {
			const result = await options.validate(draft);
			options.onAttempt?.({ attempt, outcome: 'ACCEPTED' });
			return { result, attempts: attempt };
		} catch (error) {
			if (!isSysDraftRejection(error)) { throw error; }
			const reason = (error as Error).message;
			options.onAttempt?.({ attempt, outcome: 'REJECTED', reason });
			if (attempt >= maxAttempts) {
				throw new Error(`Sys Platform rejected the Formal Spec draft after ${attempt} attempt${attempt === 1 ? '' : 's'}. Last validator message:\n${reason}`);
			}
			repair = { previousDraft: draft, error: reason };
		}
	}
}
