import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchServer, refreshServerEndpoint, resolveServerEndpoint, serverHttpUrl } from '../../../sidexChat/browser/localServer.js';

const endpoint = (port: number) => ({ wsUrl: `ws://127.0.0.1:${port}`, httpUrl: `http://127.0.0.1:${port}`, port, running: true });
const originalFetch = globalThis.fetch;
const g = globalThis as unknown as { __TAURI_INTERNALS__?: unknown };

// The supervisor restarts sidex-server on a NEW port after a crash (or after a rebuild);
// a window that memoized the first port then fails every request with "Load failed".
test('a settled endpoint goes stale after a server restart until it is refreshed', async () => {
	let current = endpoint(50001);
	g.__TAURI_INTERNALS__ = { invoke: async () => current };
	try {
		assert.equal((await resolveServerEndpoint()).port, 50001);
		current = endpoint(50002);
		assert.equal((await resolveServerEndpoint()).port, 50001, 'memoized: this is why a refresh is needed');
		assert.equal((await refreshServerEndpoint()).port, 50002);
		assert.equal(serverHttpUrl(undefined), 'http://127.0.0.1:50002');
	} finally { delete g.__TAURI_INTERNALS__; }
});

test('fetchServer re-resolves the port once and retries when the cached port refuses the connection', async () => {
	let current = endpoint(50011);
	g.__TAURI_INTERNALS__ = { invoke: async () => current };
	const seen: string[] = [];
	globalThis.fetch = async (input) => {
		seen.push(String(input));
		if (String(input).includes(':50011')) { throw new TypeError('Load failed'); }
		return new Response('ok', { status: 200 });
	};
	try {
		await refreshServerEndpoint();
		current = endpoint(50012);
		const response = await fetchServer(undefined, '/v1/sys/core', { method: 'POST' });
		assert.equal(await response.text(), 'ok');
		assert.deepEqual(seen, ['http://127.0.0.1:50011/v1/sys/core', 'http://127.0.0.1:50012/v1/sys/core']);
	} finally { globalThis.fetch = originalFetch; delete g.__TAURI_INTERNALS__; }
});

test('fetchServer does not retry a user-configured server URL or a non-network error', async () => {
	let calls = 0;
	globalThis.fetch = async () => { calls++; throw new TypeError('Load failed'); };
	try {
		await assert.rejects(fetchServer('http://my-own-server:9', '/x', {}), /Load failed/);
		assert.equal(calls, 1);
	} finally { globalThis.fetch = originalFetch; }
});
