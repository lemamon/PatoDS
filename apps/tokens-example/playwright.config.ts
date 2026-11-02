import { defineConfig, devices } from '@playwright/test'

// Chromium on every PR; every engine of the browser list nightly / before publishing
// (css-output.md §16, QA-12). Firefox/WebKit are gated so offline Chromium-only runs work.
const allEngines = Boolean(process.env.E2E_ALL_ENGINES)

const projects = [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
if (allEngines) {
  projects.push(
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  )
}

// The app is built from the packaged tarball and served by `vite preview` (the minified
// production bundle), with no external network (css-output.md §16).
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173' },
  projects,
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
