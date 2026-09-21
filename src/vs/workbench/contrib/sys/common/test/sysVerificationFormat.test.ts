import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatExistsWitness, formatProof, formatSemanticExpression, Unformattable } from '../sysVerificationFormat.js';

const B = (name: string, ordinal: number, scope = [1]) => ({ display_name: name, operation: 'op', ordinal, scope });
const ref = (b: ReturnType<typeof B>) => ({ kind: 'ref', binder: b });
const coll = { kind: 'parameter', id: 1, name: 'xs' };

test('COLLECTION_EMPTINESS respects the structured comparison', () => {
	assert.equal(formatSemanticExpression({ kind: 'COLLECTION_EMPTINESS', collection: 'xs', property: null, comparison: 'IS' }, 'DERIVED'), 'isEmpty(xs)');
	assert.equal(formatSemanticExpression({ kind: 'COLLECTION_EMPTINESS', collection: 'a', property: 'b', comparison: 'IS_NOT' }, 'SPECIFIED'), 'not isEmpty(a.b)');
});

test('OR/AND preserve grouping', () => {
	const e = { kind: 'OR', terms: [{ kind: 'UNKNOWN' }, { kind: 'AND', terms: [{ kind: 'UNKNOWN' }, { kind: 'UNKNOWN' }] }] };
	assert.equal(formatSemanticExpression(e, 'DERIVED'), 'UNKNOWN OR (UNKNOWN AND UNKNOWN)');
});

test('COMPARE supports the contract operators and fails boundedly otherwise', () => {
	const c = (op: string) => ({ kind: 'COMPARE', op, left: { kind: 'PROPERTY', receiver: 'r', property: 'n' }, right: { kind: 'CONSTANT', value: '1' } });
	assert.equal(formatSemanticExpression(c('GTE'), 'SPECIFIED'), 'r.n >= 1');
	assert.equal(formatSemanticExpression(c('LT'), 'SPECIFIED'), 'r.n < 1');
	assert.throws(() => formatSemanticExpression(c('SPACESHIP'), 'SPECIFIED'), Unformattable);
});

test('FAILURE requires a structured type; EFFECTS preserves order', () => {
	assert.equal(formatSemanticExpression({ kind: 'FAILURE', type: 'E' }, 'SPECIFIED'), 'Failure(E)');
	assert.throws(() => formatSemanticExpression({ kind: 'FAILURE' }, 'SPECIFIED'), Unformattable);
	const m = (p: string) => ({ kind: 'STATE_MUTATION', receiver: 'o', property: p, value: { kind: 'CONSTANT', value: '1' } });
	assert.equal(formatSemanticExpression({ kind: 'EFFECTS', data: [m('b'), m('a')] }, 'DERIVED'), 'Effects[\n  o.b = 1\n  o.a = 1\n]');
	assert.equal(formatSemanticExpression({ kind: 'EFFECTS', data: [] }, 'DERIVED'), 'Effects[]');
});

test('unknown semantic kind is not interpreted', () => {
	assert.throws(() => formatSemanticExpression({ kind: 'MYSTERY' }, 'DERIVED'), Unformattable);
});

const witness = (over: { i?: ReturnType<typeof B>; j?: ReturnType<typeof B>; refJ?: ReturnType<typeof B> } = {}) => {
	const i = over.i ?? B('i', 0);
	const j = over.j ?? B('j', 1);
	return {
		binders: [
			{ binder: i, domain: { kind: 'range', start: { kind: 'literal', value: '0' }, end_exclusive: { kind: 'cardinality', collection: coll }, step: { kind: 'literal', value: '1' } } },
			{ binder: j, domain: { kind: 'range', start: { kind: 'add', left: ref(i), right: { kind: 'literal', value: '1' } }, end_exclusive: { kind: 'cardinality', collection: coll }, step: { kind: 'literal', value: '1' } } }
		],
		predicate: { kind: 'equal',
			left: { kind: 'property', property: 'id', receiver: { kind: 'indexedaccess', collection: coll, index: ref(i) } },
			right: { kind: 'property', property: 'id', receiver: { kind: 'indexedaccess', collection: coll, index: ref(over.refJ ?? j) } } },
		evidence: { exit: { kind: 'return', value: { kind: 'literal', value: 'true' } } },
		provenance: 'DERIVED', completeness: 'EXACT'
	};
};

test('exists-witness renders ranges, dependent range, indexed access, equality, Return(true), provenance, completeness', () => {
	assert.deepEqual(formatExistsWitness(witness()), [
		'ExistsWitness', 'i ∈ [0, |xs|)', 'j ∈ [i + 1, |xs|)', 'xs[i].id == xs[j].id', 'Return(true)', 'provenance = DERIVED', 'completeness = EXACT'
	]);
});

test('binder refs resolve by structural id; duplicate display names do not collide', () => {
	// two binders both displayed "k": ordinal distinguishes them, so each ref keeps its own table entry
	const lines = formatExistsWitness(witness({ i: B('k', 0), j: B('k', 1) }));
	assert.equal(lines[2], 'k ∈ [k + 1, |xs|)');
	assert.equal(lines[3], 'xs[k].id == xs[k].id');
	// a ref whose structural id is absent from the binder table is explicit, even if a display name matches
	const bad = formatExistsWitness(witness({ refJ: B('j', 7) }));
	assert.match(bad[3], /<unresolved binder op\|1\|7>/);
});

test('proof renders violation polarity, never direct equality', () => {
	const side = (data: object, provenance: string) => ({ kind: (data as { kind: string }).kind, data, provenance, completeness: 'EXACT' });
	const lines = formatProof({
		kind: 'RELATIONAL_EQUIVALENCE', relation: 'VIOLATION_EQUIVALENCE', result: 'PROVEN', obligations: ['A', 'B'],
		governed: side({ kind: 'DISTINCT_BY', collection: 'xs', property: null, by: ['id'] }, 'SPECIFIED'),
		recovered: side({ kind: 'EXISTS_DUPLICATE_BY', collection: 'xs', property: null, by: ['id'] }, 'DERIVED')
	});
	assert.equal(lines[1], 'violation(DistinctBy(xs, by=[id])) <=> ExistsDuplicateBy(xs, by=[id])');
	assert.ok(!lines[1].includes(' == '));
	assert.deepEqual(lines.slice(3), ['obligation: A', 'obligation: B']);
	assert.throws(() => formatProof({ kind: 'RELATIONAL_EQUIVALENCE', relation: 'EQUALITY', result: 'PROVEN', obligations: [] }), Unformattable);
});
