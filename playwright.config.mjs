import { defineConfig } from 'playwright/test';

export default defineConfig({
	testDir: './tests/gui',
	timeout: 30_000,
	use: {
		baseURL: 'http://127.0.0.1:1420',
		headless: true,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	webServer: {
		command: 'npm run dev -- --host 127.0.0.1',
		url: 'http://127.0.0.1:1420/',
		reuseExistingServer: true,
		timeout: 120_000
	}
});
