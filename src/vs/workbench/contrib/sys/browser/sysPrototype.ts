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
import { URI } from '../../../../base/common/uri.js';
import { IMarkerService, IMarkerData, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { Range } from '../../../../editor/common/core/range.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { SysObligation, SYS_PROTOTYPE_OBLIGATIONS } from '../common/sysPrototypeFixture.js';

const OWNER = 'sys.prototype';

// Registered for every language, not for 'java'. A marker needs no language, but a hover and a
// code action do — and this fork has no Java language contribution, so selecting 'java' left the
// squiggle visible with no reason behind it and no actions on it. Which file an obligation is
// about is decided by the fixture, not by a language id.
const ANY_LANGUAGE = { scheme: '*', pattern: '**/*' };
const INTENT_PAGE = { scheme: '*', pattern: '**/*.intent.review.md' };

const GOVERN = 'sys.prototype.governThis';
const RETRACT = 'sys.prototype.retractObligation';
const EXCEPT = 'sys.prototype.grantException';

/**
 * One confirmation shape for every action. `IDialogService.info` did not surface anywhere a test
 * could see it, and a confirmation nobody sees is the same as no confirmation.
 */
async function report(dialogs: IDialogService, message: string, detail?: string): Promise<void> {
	await dialogs.prompt({
		type: 'info', message, detail,
		buttons: [{ label: 'OK', run: () => undefined }]
	});
}

const byId = (id: string) => SYS_PROTOTYPE_OBLIGATIONS.find(o => o.id === id);

/**
 * Reads a line of code as the sentence it already says, so governing it is editing a proposal
 * rather than composing one. This is the whole bet: a developer will accept or correct a sentence
 * put in front of them, and will not stop to compose one. A wrong guess is fine — it is offered
 * in an editable box, and being wrong costs a correction, not a refusal.
 */
export function proposedStatement(line: string, typeName: string): string | undefined {
	const field = line.trim().match(/^(?:private|protected|public)?\s*(?:final\s+)?([\w<>\[\]]+)\s+(\w+)\s*[;=]/);
	if (field) {
		const [, type, name] = field;
		const readable = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
		// A field holding another declared type is a relationship, not an attribute — the one
		// distinction worth making here, because it is the one the grammar makes.
		return /^[A-Z]/.test(type) && !['String', 'Integer', 'Long', 'Boolean', 'BigDecimal'].includes(type)
			? `Each ${typeName} belongs to exactly one ${type}`
			: `${typeName} has ${/^[aeiou]/.test(readable) ? 'an' : 'a'} ${readable}`;
	}
	const method = line.trim().match(/^(?:public|protected)\s+[\w<>\[\]]+\s+(\w+)\s*\(/);
	if (method) {
		const action = method[1].replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
		return `${typeName} can ${action}`;
	}
	return undefined;
}

/**
 * Governing something at the moment it is written. The design argues this is the only capture
 * point that can work: approving and resolving a conflict are moments a person has already
 * stopped to think, but writing the line is the only moment they still remember why.
 *
 * If this feels like a chore, nothing ever becomes governed and the design has no starting point.
 * That is what this action exists to find out.
 */
CommandsRegistry.registerCommand(GOVERN, async (accessor: ServicesAccessor, proposal: string) => {
	// Taken before the first await: a ServicesAccessor is only valid while the command is running
	// synchronously, and reaching for one afterwards throws — silently, from the user's side,
	// because the action simply does nothing.
	const quickInput = accessor.get(IQuickInputService);
	const dialogs = accessor.get(IDialogService);
	const says = await quickInput.input({
		title: 'Govern this',
		prompt: 'What does this say? Correct it, or press Enter to accept.',
		value: proposal,
		validateInput: async value => value.trim().length < 5 ? 'Say what is true, in a sentence.' : undefined
	});
	if (!says?.trim()) { return; }
	const because = await quickInput.input({
		title: says.trim(),
		prompt: 'Why does it matter? Without a reason this stays an observation, not an obligation.',
		placeHolder: 'orphaned books corrupted the catalogue in March 2024',
		validateInput: async value => value.trim() && value.trim().length < 10 ? 'A reason someone could disagree with, or leave it blank.' : undefined
	});
	// A statement with no reason behind it is not worth governing — it will never drift in a way
	// anyone minds. Saying so is cheaper than letting it in and pruning later.
	await report(dialogs,
		because?.trim() ? 'Prototype: this would become a governed obligation.' : 'Prototype: this would be kept as an observation, not governed.',
		because?.trim() ? `${says.trim()}\n\nWhy — ${because.trim()}` : `${says.trim()}\n\nNothing recorded why it matters, so nothing would enforce it.`
	);
});

/**
 * You cannot retract an obligation without reading why it exists. That is the entire reason the
 * decision layer is worth keeping: this is the one moment a person decides whether to change the
 * code or change the requirement, and without the reason that decision is a coin flip.
 */
CommandsRegistry.registerCommand(RETRACT, async (accessor: ServicesAccessor, id: string) => {
	const dialogs = accessor.get(IDialogService);
	const obligation = byId(id);
	if (!obligation) { return; }
	const decision = obligation.decision;
	const { result } = await dialogs.prompt<'retract' | 'narrow' | undefined>({
		type: 'warning',
		message: obligation.says,
		detail: decision
			? `Why — ${decision.because} (${decision.when}).\nChose: ${decision.chosen}.\nConsidered: ${decision.alternatives.join(' · ')}.`
			: 'Nothing records why this was decided, so retracting it costs nothing anyone wrote down.',
		buttons: [
			{ label: 'Retract it', run: () => 'retract' as const },
			...(obligation.narrowerForm ? [{ label: 'Narrow it instead', run: () => 'narrow' as const }] : [])
		],
		cancelButton: true
	});
	if (!result) { return; }
	await report(dialogs,
		result === 'retract' ? 'Prototype: the obligation would be retracted.' : 'Prototype: the obligation would be narrowed.',
		result === 'narrow' ? obligation.narrowerForm : undefined
	);
});

/**
 * An exception is a decision with a reason, or it is not granted. A free suppression is how every
 * obligation in a system eventually becomes decoration, so there is no button that just silences.
 */
CommandsRegistry.registerCommand(EXCEPT, async (accessor: ServicesAccessor, id: string) => {
	const quickInput = accessor.get(IQuickInputService);
	const dialogs = accessor.get(IDialogService);
	const obligation = byId(id);
	if (!obligation) { return; }
	const reason = await quickInput.input({
		title: `Exception — ${obligation.says}`,
		prompt: 'Why is this location exempt? An exception without a reason is not granted.',
		placeHolder: 'the framework constructs this by reflection, no business path does',
		validateInput: async value => value.trim().length < 10 ? 'Say why, in a sentence someone can disagree with.' : undefined
	});
	if (!reason?.trim()) { return; }
	await report(dialogs, 'Prototype: the exception would be recorded as a decision.',
		obligation.narrowerForm
			? `Better still, the obligation can be narrowed to: “${obligation.narrowerForm}”`
			: `Recorded against this location: “${reason.trim()}”`
	);
});

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
				// Trusted so the requirement renders as a link a reader can follow. Safe here only
				// because every word of this content is ours. A real verdict carries text from the
				// ontology, and text from a store is data: trusting it would make a `command:`
				// link in a requirement's wording executable. Escape it there, or keep it untrusted
				// and link some other way.
				return { range: here[0].range, contents: here.map(l => ({ value: hoverFor(l, model.uri), isTrusted: true })) };
			}
		}));

		// Reading an intent, the question is the mirror of the one asked while reading code: not
		// "what constrains this line" but "is this real, and where?". Without an answer the intent
		// page is a document nobody can check, which is how specifications rot.
		this._register(languageFeatures.hoverProvider.register(INTENT_PAGE, {
			provideHover: (model, position) => {
				const word = model.getWordAtPosition(position);
				if (!word) { return undefined; }
				const about = SYS_PROTOTYPE_OBLIGATIONS.filter(o => o.concept === word.word);
				if (!about.length) { return undefined; }
				return {
					range: new Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
					contents: [{ value: realisedIn(word.word, about, model.uri), isTrusted: true, supportHtml: false }]
				};
			}
		}));

		this._register(languageFeatures.codeActionProvider.register(ANY_LANGUAGE, {
			provideCodeActions: (model, range) => {
				const broken = obligationsFor(model)
					.filter(o => o.verdict === 'CONTRADICTED')
					.flatMap(o => locate(model, o))
					.filter(l => Range.areIntersectingOrTouching(l.range, range));

				// Offered wherever a line says something nothing governs yet. This is the third
				// capture moment, and the only one where the reason is still in the author's head.
				const line = model.getLineContent(range.startLineNumber);
				const typeName = model.uri.path.split('/').pop()?.replace(/\.\w+$/, '') ?? 'This';
				const proposal = broken.length ? undefined : proposedStatement(line, typeName);
				if (proposal) {
					return {
						actions: [{ title: `Sys: govern this — “${proposal}”…`, kind: 'quickfix', command: { id: GOVERN, title: 'Govern', arguments: [proposal] } }],
						dispose: () => { }
					};
				}
				if (!broken.length) { return undefined; }
				// Exactly three choices, and none of them is silent. A suppression here is how
				// every obligation in the system eventually becomes decoration.
				const actions = broken.flatMap(({ obligation }) => [
					{ title: 'Sys: this obligation is wrong…', kind: 'quickfix', command: { id: RETRACT, title: 'Retract', arguments: [obligation.id] } },
					{ title: 'Sys: this location is an exception…', kind: 'quickfix', command: { id: EXCEPT, title: 'Exception', arguments: [obligation.id] } }
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

/**
 * What a concept is realised by, and how each thing said about it is holding up. One concept can
 * be realised by several files — the map to code is not one to one, and listing them all is how
 * the reader sees that rather than being told it.
 */
function realisedIn(concept: string, about: readonly SysObligation[], page: URI): string {
	const root = page.path.split('/.sys/')[0];
	const mark = (verdict: string) => verdict === 'SATISFIED' ? '✓' : verdict === 'CONTRADICTED' ? '✗' : '—';
	const lines = [`**${concept}**`, ''];
	for (const obligation of about) {
		const where = obligation.verdict === 'NOT_OBSERVED'
			// No witness, so nothing to point at. Saying so is the honest answer, and it is the
			// common one on real code.
			? 'nothing in the code says this yet'
			: obligation.files.map(file => `[${file}](${URI.file(`${root}/src/main/java/com/example/${file}`).toString()})`).join(', ');
		lines.push(`${mark(obligation.verdict)} ${obligation.says} — ${where}`);
	}
	return lines.join('\n\n');
}

/**
 * The intent page a requirement is reviewed on. Derived from the source path, which is a guess a
 * real verdict would not need: it would carry the requirement's own uri.
 */
function intentPage(source: URI, requirement: string): URI {
	const [beforeSrc] = source.path.split('/src/');
	// A source tree gives the root away; a file sitting at the root does not, so fall back to its
	// own folder. Both are guesses. A real verdict carries the requirement's own uri and guesses
	// nothing.
	const root = beforeSrc !== source.path ? beforeSrc : source.path.slice(0, source.path.lastIndexOf('/'));
	return URI.file(`${root}/.sys/intents/${requirement}.intent.review.md`);
}

function hoverFor({ obligation, note }: Located, source: URI): string {
	const verdict = obligation.verdict === 'CONTRADICTED' ? '✗ broken' : '✓ held';
	// The requirement is a link, so the mirror of Case 07 holds: from code you reach the intent
	// exactly as from the intent you reach the code. A reference you cannot follow is a citation
	// nobody checks.
	const page = intentPage(source, obligation.requirement);
	const lines = [`**Sys · ${obligation.requirement}** — ${verdict}`, '', obligation.says];
	if (note) { lines.push('', `Here: ${note}`); }
	// On its own line, not nested in bold: a link inside emphasis is not rendered as one.
	lines.push('', `[Open ${obligation.requirement}](${page.toString()})`);
	if (obligation.decision) {
		// The reason travels with the obligation, because it is what a person needs at the moment
		// they are deciding whether to change the code or change the requirement.
		lines.push('', `**Why** — ${obligation.decision.because} (${obligation.decision.when})`);
		lines.push(`Chose: ${obligation.decision.chosen}`);
		lines.push(`Considered: ${obligation.decision.alternatives.join(' · ')}`);
	}
	return lines.join('\n');
}
