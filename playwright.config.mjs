import { defineConfig } from 'playwright/test';

export default defineConfig({
	testDir: './tests/gui',
	timeout: 30_000,
	use: {
		baseURL: 'http://127.0.0.1:1420',
		// Watchable on demand: PW_WATCH=1 opens a real window and slows the run down enough to
		// follow. Off by default so CI and ordinary runs stay headless and fast.
		headless: !process.env.PW_WATCH,
		launchOptions: process.env.PW_WATCH ? { slowMo: 700 } : {},
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
