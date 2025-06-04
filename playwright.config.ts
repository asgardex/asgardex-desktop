import path from 'path'
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests-e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/*.test.ts', '**/*.unit.ts'],
  timeout: 120000,
  retries: 2,
  use: {
    headless: !!process.env.CI,
    launchOptions: {
      executablePath: require('electron')
    }
  },
  projects: [
    {
      name: 'electron',
      use: {
        launchOptions: {
          executablePath: require('electron'),
          args: [path.join(__dirname, 'build/main/electron.js')]
        }
      }
    }
  ]
})
