import { CancellationToken } from '../../../../base/common/cancellation.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { CodeLens, CodeLensList, CodeLensProvider } from '../../../../editor/common/languages.js';

/**
 * Real Gherkin scenario lines, found inside a fenced ```gherkin block only. A `Scenario:` line
 * anywhere else in the review Markdown (prose mentioning the word, an example in a comment) must
 * never grow a lens — the fence is the only signal this scanner trusts.
 */
export function scanGherkinScenarioLines(text: string): readonly { readonly line: number; readonly keyword: string; readonly scenarioName: string }[] {
	const lines = text.split('\n');
	const found: { line: number; keyword: string; scenarioName: string }[] = [];
	let inFence = false;
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		if (raw.trim() === '```gherkin') { inFence = true; continue; }
		if (inFence && raw.trim() === '```') { inFence = false; continue; }
		if (!inFence) { continue; }
		const match = /^\s*(Scenario Outline|Scenario):\s*(.+)$/.exec(raw);
		if (match) { found.push({ line: i, keyword: match[1], scenarioName: match[2].trim() }); }
	}
	return found;
}

/**
 * Reads the requirement id from the review page's own first line — the same format
 * `renderFormalSpecReview` always emits (`# {id} — Formal Spec review`) — rather than guessing it
 * from the file name, which is an implementation detail of `writeFormalSpecReview` this provider
 * should not need to know.
 */
function requirementIdOf(text: string): string | undefined {
	const match = /^#\s+(\S+)\s+—\s+Formal Spec review/.exec(text.split('\n', 1)[0] ?? '');
	return match?.[1];
}

export class SysBehaviorCodeLensProvider implements CodeLensProvider {
	provideCodeLenses(model: ITextModel, _token: CancellationToken): CodeLensList {
		const text = model.getValue();
		const requirementId = requirementIdOf(text);
		if (!requirementId) { return { lenses: [] }; }
		const lenses: CodeLens[] = scanGherkinScenarioLines(text).map(found => ({
			range: { startLineNumber: found.line + 1, startColumn: 1, endLineNumber: found.line + 1, endColumn: 1 },
			command: {
				id: 'sys.pointToCode',
				title: 'Point to code',
				arguments: [requirementId, found.scenarioName]
			}
		}));
		return { lenses };
	}
}
