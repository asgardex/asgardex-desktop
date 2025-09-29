import { test as base, expect } from '@playwright/test'
import { ElectronApplication, Page } from 'playwright'
import ElectronSingleton from './ElectronSingleton'

export const test = base.extend<{
  electronApp: ElectronApplication
  mainWindow: Page
}>({
  electronApp: [
    async ({}, use) => {
      const app = await ElectronSingleton.getElectronApp()
      const stats = ElectronSingleton.getStats()

      console.log(`♻️ Using singleton Electron (launch count: ${stats.launchCount})`)

      await use(app)
    },
    { scope: 'worker' }
  ],

  mainWindow: [
    async ({}, use) => {
      const window = await ElectronSingleton.getMainWindow()

      console.log('♻️ Using singleton main window')

      await use(window)
    },
    { scope: 'worker' }
  ]
})

export { expect }

// Helper functions
export class TestHelpers {
  static async waitForAppReady(window: Page): Promise<void> {
    try {
      await window.waitForSelector('body', { timeout: 10000 })
      await window.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 })
    } catch (error) {
      console.warn('App ready check failed:', error)
    }
  }

  static async debugWindowState(window: Page): Promise<void> {
    console.log('=== Debug Window State ===')
    console.log('Title:', await window.title())
    console.log('URL:', await window.url())

    const bodyText = await window.locator('body').textContent()
    console.log('Body text (first 200 chars):', bodyText?.substring(0, 200))

    const elementCount = await window.locator('*').count()
    console.log('Total elements:', elementCount)

    // Include singleton stats
    const stats = ElectronSingleton.getStats()
    console.log('Singleton stats:', stats)
    console.log('========================')
  }

  static async isAppLoaded(window: Page): Promise<boolean> {
    try {
      const url = await window.url()
      if (url.includes('chrome-error://') || url.includes('about:blank')) {
        return false
      }

      const elementCount = await window.locator('*').count()
      return elementCount > 10
    } catch {
      return false
    }
  }

  static validateSingleton(): void {
    const stats = ElectronSingleton.getStats()

    if (stats.launchCount > 1) {
      throw new Error(`SINGLETON VIOLATION: ${stats.launchCount} launches detected! Expected exactly 1.`)
    }

    console.log(`✅ Singleton validation passed: launches=${stats.launchCount}`)
  }
}
