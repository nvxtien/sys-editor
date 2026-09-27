/**
 * PROTOTYPE — the Sys workflow wired to fake verdicts, so it can be judged by using it.
 *
 * Nothing here talks to sys-platform. It reads `sysPrototypeFixture.ts` and drives the editor
 * affordances the design picked:
 *
 *   CONTRADICTED   an error marker, whose message is the counterexample
 *   SATISFIED      nothing at all — silence is the reward
 *   NOT_OBSERVED   never a marker: it has no line to mark. It lives in the Sys view.
 *   obligations    a hover, so "what am I touching" needs no navigation
 *   why            the same hover, second section
 *   fixing it      code actions, and there is no "Ignore" among them
 *
 * Delete this file and the fixture together when the real thing lands.
 */
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IMarkerService, IMarkerData, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { Range } from '../../../../editor/common/core/range.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { SysObligation, SYS_PROTOTYPE_OBLIGATIONS } from '../common/sysPrototypeFixture.js';

const OWNER = 'sys.prototype';

// Registered for every language, not for 'java'. A marker needs no language, but a hover and a
// code action do — and this fork has no Java language contribution, so selecting 'java' left the
// squiggle visible with no reason behind it and no actions on it. Which file an obligation is
// about is decided by the fixture, not by a language id.
const ANY_LANGUAGE = { scheme: '*', pattern: '**/*' };

interface Located { readonly obligation: SysObligation; readonly range: Range; readonly note?: string }

function obligationsFor(model: ITextModel): readonly SysObligation[] {
	const path = model.uri.path;
	return SYS_PROTOTYPE_OBLIGATIONS.filter(o => o.files.some(file => path.endsWith(file)));
}

/**
 * Witnesses are found by matching the file's text rather than by stored line numbers, so an
 * edit does not silently point the prototype at the wrong line — the same reason the design
 * derives trace instead of storing it.
 */
function locate(model: ITextModel, obligation: SysObligation): Located[] {
	const text = model.getValue();
	const found: Located[] = [];
	for (const witness of obligation.witnesses) {
		const pattern = new RegExp(witness.pattern.source, witness.pattern.flags.replace('g', '') + 'g');
		for (const match of text.matchAll(pattern)) {
			const start = model.getPositionAt(match.index ?? 0);
			const end = model.getPositionAt((match.index ?? 0) + match[0].length);
			found.push({ obligation, note: witness.note, range: Range.fromPositions(start, end) });
		}
	}
	return found;
}

export class SysPrototypeContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.sysPrototype';

	constructor(
		@IMarkerService private readonly markers: IMarkerService,
		@IModelService private readonly models: IModelService,
		@ILanguageFeaturesService languageFeatures: ILanguageFeaturesService,
	) {
		super();

		for (const model of this.models.getModels()) { this._refresh(model); }
		this._register(this.models.onModelAdded(model => this._refresh(model)));
		this._register(this.models.onModelRemoved(model => this.markers.remove(OWNER, [model.uri])));
		// Re-checked when typing pauses, not on every keystroke: the design promises diagnostics
		// about a second after you stop, and promising less than that would be a promise the real
		// analysis cannot keep either.
		this._register(this.models.onModelAdded(model => {
			let pending: Timeout | undefined;
			const listener = model.onDidChangeContent(() => {
				if (pending) { clearTimeout(pending); }
				pending = setTimeout(() => this._refresh(model), 700);
			});
			this._register(listener);
		}));

		this._register(languageFeatures.hoverProvider.register(ANY_LANGUAGE, {
			provideHover: (model, position) => {
				const here = obligationsFor(model)
					.flatMap(o => locate(model, o))
					.filter(l => l.range.containsPosition(position));
				if (!here.length) { return undefined; }
				return { range: here[0].range, contents: here.map(l => ({ value: hoverFor(l), isTrusted: false })) };
			}
		}));

		this._register(languageFeatures.codeActionProvider.register(ANY_LANGUAGE, {
			provideCodeActions: (model, range) => {
				const broken = obligationsFor(model)
					.filter(o => o.verdict === 'CONTRADICTED')
					.flatMap(o => locate(model, o))
					.filter(l => Range.areIntersectingOrTouching(l.range, range));
				if (!broken.length) { return undefined; }
				// Exactly three choices, and none of them is silent. A suppression here is how
				// every obligation in the system eventually becomes decoration.
				const actions = broken.flatMap(({ obligation }) => [
					{ title: `Sys: this obligation is wrong — “${obligation.says}”…`, kind: 'quickfix' },
					{ title: `Sys: this location is an exception — “${obligation.says}”…`, kind: 'quickfix' }
				]);
				return { actions, dispose: () => { } };
			}
		}));
	}

	private _refresh(model: ITextModel): void {
		const located = obligationsFor(model)
			// NOT_OBSERVED has no line to mark, and SATISFIED earns silence.
			.filter(o => o.verdict === 'CONTRADICTED')
			.flatMap(o => locate(model, o));
		const markers: IMarkerData[] = located.map(({ obligation, range, note }) => ({
			severity: MarkerSeverity.Error,
			// The counterexample, not a code. A reader passes `public Book() {}` nine times out of
			// ten; "leaves category unset" is what makes them stop.
			message: note ? `${obligation.says} — ${note}` : obligation.says,
			source: `Sys · ${obligation.requirement}`,
			startLineNumber: range.startLineNumber,
			startColumn: range.startColumn,
			endLineNumber: range.endLineNumber,
			endColumn: range.endColumn
		}));
		this.markers.changeOne(OWNER, model.uri, markers);
	}
}

function hoverFor({ obligation, note }: Located): string {
	const verdict = obligation.verdict === 'CONTRADICTED' ? '✗ broken' : '✓ held';
	const lines = [`**Sys · ${obligation.requirement}** — ${verdict}`, '', obligation.says];
	if (note) { lines.push('', `Here: ${note}`); }
	if (obligation.decision) {
		// The reason travels with the obligation, because it is what a person needs at the moment
		// they are deciding whether to change the code or change the requirement.
		lines.push('', `**Why** — ${obligation.decision.because} (${obligation.decision.when})`);
		lines.push(`Chose: ${obligation.decision.chosen}`);
		lines.push(`Considered: ${obligation.decision.alternatives.join(' · ')}`);
	}
	return lines.join('\n');
}
