import { test, expect, TestHelpers } from './base/ElectronTestBaseFinal'

test.describe('Electron Basic Tests', () => {
  test('should get app path', async ({ electronApp, mainWindow }) => {
    await TestHelpers.waitForAppReady(mainWindow)

    const appPath = await electronApp.evaluate(async ({ app }) => app.getAppPath())
    console.log('Electron app path:', appPath)
    expect(appPath).toBeTruthy()

    const title = await mainWindow.title()
    console.log('Window title:', title)
    expect(title).toContain('ASGARDEX')
  })

  test('should interact with UI elements', async ({ mainWindow }) => {
    await TestHelpers.waitForAppReady(mainWindow)

    // Check if app is loaded properly first
    const isLoaded = await TestHelpers.isAppLoaded(mainWindow)
    expect(isLoaded).toBe(true)

    // Look for common UI elements that should be visible
    const hasBody = await mainWindow.locator('body').isVisible()
    expect(hasBody).toBe(true)

    // Debug what's actually on the page
    await TestHelpers.debugWindowState(mainWindow)
  })
})
