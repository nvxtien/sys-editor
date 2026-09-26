import { parseStructuredIntent, SysStructuredIntent } from './sysStructuredIntent.js';

export function newSysRequestId(): string {
	return `sys-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sysTrace(requestId: string, stage: string, detail = ''): void {
	console.info(`[SYS_NORMALIZE_INTENT] id=${requestId} stage=${stage}${detail ? ` ${detail}` : ''}`);
}

export async function requestStructuredIntent(httpUrl: string, model: string, requirementId: string, intent: string, requestId: string = newSysRequestId()): Promise<SysStructuredIntent> {
	const url = `${httpUrl.replace(/\/+$/, '')}/v1/sys/normalize-intent`;
	sysTrace(requestId, 'request_sent', `url=${url} model=${model}`);
	let response: Response;
	try {
		response = await fetch(url, {
			method: 'POST',
			// The id rides in the body: a custom header would need a CORS preflight allowance the server does not grant.
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model, intent, requestId }),
			signal: AbortSignal.timeout(90_000)
		});
	} catch (error) {
		sysTrace(requestId, 'request_failed', `error=${error instanceof Error ? error.message : String(error)}`);
		throw new Error(`SideX intent normalization failed: ${error instanceof Error ? error.message : String(error)}. Check SideX Settings → Models.`);
	}
	sysTrace(requestId, 'response', `status=${response.status}`);
	let body: { structuredIntent?: unknown; error?: unknown };
	try { body = await response.json(); } catch { throw new Error('SideX returned an invalid Structured Intent response.'); }
	if (!response.ok) {
		throw new Error(`SideX could not normalize the requirement: ${typeof body.error === 'string' ? body.error : `HTTP ${response.status}`}`);
	}
	if (typeof body.structuredIntent !== 'string') { throw new Error('SideX returned no Structured Intent.'); }
	let value: unknown;
	try { value = JSON.parse(body.structuredIntent); } catch { throw new Error('SideX returned invalid Structured Intent JSON.'); }
	try {
		const parsed = parseStructuredIntent(value, requirementId, { requireKind: true });
		sysTrace(requestId, 'parsed');
		return parsed;
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		sysTrace(requestId, 'rejected', `reason=${reason}`);
		throw new Error(`The model's answer does not match the Structured Intent contract (${reason}). Nothing was saved; try Normalize intent again or pick another model.`);
	}
}
