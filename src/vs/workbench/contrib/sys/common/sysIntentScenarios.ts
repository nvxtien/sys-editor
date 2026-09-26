/**
 * Gherkin scenarios for the review page: a plain-language projection of a Structured Intent,
 * regenerated for each review and never written back. The intent JSON stays the governed record,
 * so viewing a review never changes what was confirmed.
 *
 * Every failure yields undefined rather than throwing. A reviewer must always be able to open the
 * page that shows what they are confirming, whatever the provider is doing.
 */
export async function requestIntentScenarios(httpUrl: string, model: string, intent: string): Promise<string | undefined> {
	try {
		const response = await fetch(`${httpUrl.replace(/\/+$/, '')}/v1/sys/intent-scenarios`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model, intent }),
			signal: AbortSignal.timeout(60_000)
		});
		if (!response.ok) { return undefined; }
		const body = await response.json() as { scenarios?: unknown };
		return typeof body.scenarios === 'string' && body.scenarios.trim() ? body.scenarios.trim() : undefined;
	} catch {
		return undefined;
	}
}
