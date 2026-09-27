/**
 * PROTOTYPE — the "Needs you" list, on fake verdicts.
 *
 * It answers one question the design could not answer on paper: NOT_OBSERVED has no line in the
 * code to mark, so it has nowhere to live except a list — and a list nobody opens is the same as
 * nowhere. Using this is how we find out which it is.
 *
 * Ordered the way the design says attention is spent: what is broken first, then what nothing in
 * the code says anything about. What is held is never listed — a list of things that are fine is
 * the noise this whole design is trying not to make.
 *
 * Delete with sysPrototype.ts and sysPrototypeFixture.ts.
 */
import * as DOM from '../../../../base/browser/dom.js';
import { URI } from '../../../../base/common/uri.js';
import { SysObligation, SYS_PROTOTYPE_OBLIGATIONS } from '../common/sysPrototypeFixture.js';

const $ = DOM.$;

/** `workspaceRoot` is only needed to turn a fixture's file name into something openable. */
export function renderSysNeedsMe(parent: HTMLElement, section: HTMLElement, open: (resource: URI) => void, workspaceRoot?: URI): void {
	const broken = SYS_PROTOTYPE_OBLIGATIONS.filter(o => o.verdict === 'CONTRADICTED');
	const unobserved = SYS_PROTOTYPE_OBLIGATIONS.filter(o => o.verdict === 'NOT_OBSERVED');
	if (!broken.length && !unobserved.length) { return; }

	const host = DOM.append(parent, section);
	DOM.append(host, $('p.sys-proto-note')).textContent = 'Prototype — these verdicts are fixtures, not the platform.';

	for (const obligation of broken) {
		const row = DOM.append(host, $('div.sys-req-row'));
		const main = DOM.append(row, $('div.sys-req-main'));
		main.tabIndex = 0;
		DOM.append(main, $('span.sys-req-id')).textContent = '✗';
		DOM.append(main, $('span.sys-req-title')).textContent = obligation.says;
		DOM.append(row, $('div.sys-req-status')).textContent = `${obligation.requirement} · broken in ${obligation.files.join(', ')}`;
		// Broken has a place in the code, so the row's job is to get you there and then get out
		// of the way. Everything else about it is already on the line itself.
		// The fixture names a file, not a path, so this is a best guess at where it lives. A real
		// verdict carries the witness's own uri and needs no guessing.
		const target = workspaceRoot && obligation.files[0]
			? URI.joinPath(workspaceRoot, 'src/main/java/com/example', obligation.files[0])
			: undefined;
		if (target) {
			main.title = 'Open where it broke';
			main.addEventListener('click', () => open(target));
			main.addEventListener('keydown', e => { if (e.key === 'Enter') { open(target); } });
		}
	}

	for (const obligation of unobserved) {
		const row = DOM.append(host, $('div.sys-req-row'));
		const main = DOM.append(row, $('div.sys-req-main'));
		DOM.append(main, $('span.sys-req-id')).textContent = '—';
		DOM.append(main, $('span.sys-req-title')).textContent = obligation.says;
		// Not a failure, and it must not read as one: nothing in the code honours or breaks this.
		DOM.append(row, $('div.sys-req-status')).textContent = `${obligation.requirement} · nothing in the code says this yet`;
		if (obligation.decision) {
			DOM.append(row, $('div.sys-req-binding')).textContent = `Why: ${obligation.decision.because}`;
		}
	}
}

export function needsYouCount(): number {
	return SYS_PROTOTYPE_OBLIGATIONS.filter((o: SysObligation) => o.verdict !== 'SATISFIED').length;
}
