import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftFormalSpecWithRepair, isSysDraftRejection, SysDraftAttempt, SysDraftRepair } from '../sysFormalSpecRepair.js';
import { requestSysFormalSpecDraft } from '../sysFormalSpecDraft.js';

// The loop lives in the client because clients own LLM calls (sys-core and sys-platform make none).
// The validator is sys-platform (`sys requirement --draft-only`); a rejection is fed back, never overridden.

const REJECTION = (detail: string) => new Error(`draft is not a valid Formal Spec (governed state unchanged):\nformal-spec parse failed:\nAMBIGUOUS_OR_UNSUPPORTED_SPEC\n\n${detail}`);

function scripted(drafts: string[], accepted: Set<string>) {
	const repairs: (SysDraftRepair | undefined)[] = [];
	let next = 0;
	return {
		repairs,
		request: async (repair: SysDraftRepair | undefined) => { repairs.push(repair); return drafts[next++]; },
		validate: async (draft: string) => {
			if (accepted.has(draft)) { return { draftSpec: draft }; }
			throw REJECTION(`bad value in: ${draft}`);
		}
	};
}

test('a draft the validator accepts is returned after one attempt, with no repair requested', async () => {
	const s = scripted(['good'], new Set(['good']));
	const out = await draftFormalSpecWithRepair({ request: s.request, validate: s.validate });
	assert.deepEqual(out, { result: { draftSpec: 'good' }, attempts: 1 });
	assert.deepEqual(s.repairs, [undefined]);
});

test('a rejected draft is sent back with the validator error and the model gets another go', async () => {
	const s = scripted(['bad one', 'good'], new Set(['good']));
	const out = await draftFormalSpecWithRepair({ request: s.request, validate: s.validate });
	assert.equal(out.attempts, 2);
	assert.equal(s.repairs[0], undefined);
	assert.equal(s.repairs[1]?.previousDraft, 'bad one');
	assert.match(s.repairs[1]!.error, /AMBIGUOUS_OR_UNSUPPORTED_SPEC[\s\S]*bad value in: bad one/);
});

test('every repair carries the most recent draft, not the first one', async () => {
	const s = scripted(['first', 'second', 'third'], new Set(['third']));
	await draftFormalSpecWithRepair({ request: s.request, validate: s.validate });
	assert.deepEqual(s.repairs.map(r => r?.previousDraft), [undefined, 'first', 'second']);
});

test('it gives up after a bounded number of attempts and reports the last validator message', async () => {
	const s = scripted(['a', 'b', 'c', 'd'], new Set());
	await assert.rejects(
		draftFormalSpecWithRepair({ request: s.request, validate: s.validate }),
		(error: Error) => /after 3 attempts/.test(error.message) && /bad value in: c/.test(error.message) && !/bad value in: d/.test(error.message)
	);
	assert.equal(s.repairs.length, 3, 'never an unbounded loop');
});

test('the attempt limit is configurable and at least one attempt is always made', async () => {
	const one = scripted(['a', 'b'], new Set(['b']));
	await assert.rejects(draftFormalSpecWithRepair({ request: one.request, validate: one.validate, maxAttempts: 1 }), /after 1 attempt/);
	assert.equal(one.repairs.length, 1);
	const zero = scripted(['a'], new Set(['a']));
	assert.equal((await draftFormalSpecWithRepair({ request: zero.request, validate: zero.validate, maxAttempts: 0 })).attempts, 1);
});

test('an infrastructure failure is never retried and never reported as a rejected draft', async () => {
	let requests = 0;
	await assert.rejects(
		draftFormalSpecWithRepair({
			request: async () => { requests++; return 'draft'; },
			validate: async () => { throw new Error('Sys Platform CLI not found. Build it with: cargo build'); }
		}),
		/Sys Platform CLI not found/
	);
	assert.equal(requests, 1);
});

test('a provider failure stops the loop immediately', async () => {
	let validations = 0;
	await assert.rejects(
		draftFormalSpecWithRepair({
			request: async () => { throw new Error('SideX could not draft a Formal Spec: anthropic is not connected'); },
			validate: async () => { validations++; return 1; }
		}),
		/not connected/
	);
	assert.equal(validations, 0);
});

test('each attempt is reported so the outcome can be traced', async () => {
	const seen: SysDraftAttempt[] = [];
	const s = scripted(['bad', 'good'], new Set(['good']));
	await draftFormalSpecWithRepair({ request: s.request, validate: s.validate, onAttempt: a => seen.push(a) });
	assert.deepEqual(seen.map(a => [a.attempt, a.outcome]), [[1, 'REJECTED'], [2, 'ACCEPTED']]);
	assert.match(seen[0].reason!, /bad value in: bad/);
});

// The CLI reports a compile-stage rejection without the "not a valid Formal Spec" wrapper.
const COMPILE_REJECTION = () => new Error('ontology-compiler compile failed:\nsymbolic condition value MISSING requires a declared enum type for category state');

test('a compile-stage rejection by the platform is a rejection too, and is repaired like any other', async () => {
	assert.ok(isSysDraftRejection(COMPILE_REJECTION()));
	const repairs: (SysDraftRepair | undefined)[] = [];
	const drafts = ['no declaration', 'declared'];
	let next = 0;
	const out = await draftFormalSpecWithRepair({
		request: async repair => { repairs.push(repair); return drafts[next++]; },
		validate: async draft => { if (draft === 'declared') { return draft; } throw COMPILE_REJECTION(); }
	});
	assert.equal(out.attempts, 2);
	assert.match(repairs[1]!.error, /requires a declared enum type/);
});

test('only the platform validator rejection counts as a rejection', () => {
	assert.ok(isSysDraftRejection(REJECTION('x')));
	for (const other of [new Error('Sys Platform CLI not found'), new Error('Initialize Sys Platform in this project first with `sys init .`.'), 'draft is not a valid Formal Spec', undefined]) {
		assert.ok(!isSysDraftRejection(other), String(other));
	}
});

const originalFetch = globalThis.fetch;

test('the request carries the repair material only when a repair is asked for', async () => {
	const bodies: Record<string, unknown>[] = [];
	globalThis.fetch = async (_input, init) => {
		bodies.push(JSON.parse(String(init?.body)));
		return new Response(JSON.stringify({ draftSpec: 'Requirement: R\n\nOperation: op\n' }), { status: 200 });
	};
	try {
		await requestSysFormalSpecDraft('http://sidex', 'm', 'INTENT');
		await requestSysFormalSpecDraft('http://sidex', 'm', 'INTENT', { previousDraft: 'old', error: 'why' });
		assert.deepEqual(bodies[0], { model: 'm', intent: 'INTENT' });
		assert.deepEqual(bodies[1], { model: 'm', intent: 'INTENT', repair: { previousDraft: 'old', error: 'why' } });
	} finally { globalThis.fetch = originalFetch; }
});
