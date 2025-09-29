import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests-e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/*.test.ts', '**/*.unit.ts'],
  timeout: 120000,
  retries: 0, // Disable retries to prevent new worker creation
  workers: 1, // Single worker for Electron stability
  fullyParallel: false, // Sequential execution prevents resource conflicts

  // Start development server before tests
  webServer: {
    command: 'yarn dev',
    url: 'http://localhost:3000',
    timeout: 120000,
    reuseExistingServer: !process.env.CI
  },

  use: {
    headless: !!process.env.CI
  },

  projects: [
    {
      name: 'electron',
      use: {
        launchOptions: {
          executablePath: require('electron'),
          args: ['.'], // Launch from current directory in dev mode
          env: {
            ...process.env,
            NODE_ENV: 'development',
            VITE_NODE_ENV: 'development',
            ELECTRON_IS_DEV: '1'
          }
        }
      }
    }
  ]
})
