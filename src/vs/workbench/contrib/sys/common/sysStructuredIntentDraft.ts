import { parseStructuredIntent, SysStructuredIntent } from './sysStructuredIntent.js';

export async function requestStructuredIntent(httpUrl: string, model: string, requirementId: string, intent: string, operation?: string): Promise<SysStructuredIntent> {
	let response: Response;
	try {
		response = await fetch(`${httpUrl.replace(/\/+$/, '')}/v1/sys/normalize-intent`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model, intent, ...(operation ? { operation } : {}) }),
			signal: AbortSignal.timeout(90_000)
		});
	} catch (error) {
		throw new Error(`SideX intent normalization failed: ${error instanceof Error ? error.message : String(error)}. Check SideX Settings → Models.`);
	}
	let body: { structuredIntent?: unknown; error?: unknown };
	try { body = await response.json(); } catch { throw new Error('SideX returned an invalid Structured Intent response.'); }
	if (!response.ok) {
		throw new Error(`SideX could not normalize the requirement: ${typeof body.error === 'string' ? body.error : `HTTP ${response.status}`}`);
	}
	if (typeof body.structuredIntent !== 'string') { throw new Error('SideX returned no Structured Intent.'); }
	let value: unknown;
	try { value = JSON.parse(body.structuredIntent); } catch { throw new Error('SideX returned invalid Structured Intent JSON.'); }
	return parseStructuredIntent(value, requirementId);
}
