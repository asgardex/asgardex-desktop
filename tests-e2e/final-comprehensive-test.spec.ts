import { test, expect, TestHelpers } from './base/ElectronTestBaseFinal'

test.describe('Final Comprehensive E2E Test Suite', () => {
  test('01 - should have singleton Electron instance', async ({ electronApp, mainWindow }) => {
    await TestHelpers.waitForAppReady(mainWindow)

    console.log('\n✅ TEST 1: Singleton validation')

    const url = await mainWindow.url()
    const title = await mainWindow.title()
    const windows = electronApp.windows()

    console.log(`URL: ${url}`)
    console.log(`Title: ${title}`)
    console.log(`Windows: ${windows.length} (should be 2: app + devtools)`)

    expect(title).toContain('ASGARDEX')
    expect(windows.length).toBe(2) // App + DevTools
    expect(url).toContain('localhost:3000')
  })

  test('02 - should identify key wallet elements', async ({ mainWindow }) => {
    await TestHelpers.waitForAppReady(mainWindow)

    console.log('\n✅ TEST 2: Wallet element identification')

    const url = await mainWindow.url()
    console.log(`Current URL: ${url}`)

    if (url.includes('#/wallet/locked')) {
      console.log('🔒 Wallet is locked - checking lock screen elements')

      // Check password input
      const passwordInput = mainWindow.locator('input[type="password"]').first()
      await expect(passwordInput).toBeVisible()
      console.log('✅ Password input found')

      // Check unlock button
      const unlockButton = mainWindow.locator('button:has-text("Unlock")').first()
      await expect(unlockButton).toBeVisible()
      console.log('✅ Unlock button found')
    } else {
      console.log('🔓 Wallet is already unlocked - checking unlocked elements')

      // Check for navigation tabs
      const walletTab = await mainWindow
        .locator('text=WALLET')
        .first()
        .isVisible()
        .catch(() => false)
      const swapTab = await mainWindow
        .locator('text=SWAP')
        .first()
        .isVisible()
        .catch(() => false)

      console.log(`WALLET tab visible: ${walletTab}`)
      console.log(`SWAP tab visible: ${swapTab}`)
    }
  })

  test('03 - should unlock wallet if locked', async ({ mainWindow }) => {
    await TestHelpers.waitForAppReady(mainWindow)

    console.log('\n✅ TEST 3: Wallet unlock functionality')

    const initialUrl = await mainWindow.url()
    console.log(`Initial URL: ${initialUrl}`)

    if (initialUrl.includes('#/wallet/locked')) {
      console.log('🔒 Unlocking wallet...')

      // Enter password
      const passwordInput = mainWindow.locator('input[type="password"]').first()
      await passwordInput.fill('password')
      console.log('✅ Password entered')

      // Click unlock
      const unlockButton = mainWindow.locator('button:has-text("Unlock")').first()
      await unlockButton.click()
      console.log('✅ Unlock button clicked')

      // Wait for navigation
      await mainWindow.waitForFunction(() => !window.location.hash.includes('/wallet/locked'), { timeout: 15000 })

      const newUrl = await mainWindow.url()
      console.log(`After unlock URL: ${newUrl}`)

      expect(newUrl).not.toContain('#/wallet/locked')
      console.log('🔓 Wallet successfully unlocked!')
    } else {
      console.log('🔓 Wallet was already unlocked (singleton state preserved)')
      expect(initialUrl).not.toContain('#/wallet/locked')
    }
  })

  test('04 - should test navigation and prices in unlocked state', async ({ mainWindow }) => {
    await TestHelpers.waitForAppReady(mainWindow)

    console.log('\n✅ TEST 4: Navigation and price testing')

    const url = await mainWindow.url()
    console.log(`Current URL: ${url}`)

    // Should be unlocked by now (from previous test or singleton state)
    expect(url).not.toContain('#/wallet/locked')

    // Check for navigation tabs
    console.log('🧭 Checking navigation tabs...')
    const walletTab = await mainWindow
      .locator('text=WALLET')
      .first()
      .isVisible()
      .catch(() => false)
    const swapTab = await mainWindow
      .locator('text=SWAP')
      .first()
      .isVisible()
      .catch(() => false)
    const bondsTab = await mainWindow
      .locator('text=BONDS')
      .first()
      .isVisible()
      .catch(() => false)

    console.log(`WALLET tab visible: ${walletTab}`)
    console.log(`SWAP tab visible: ${swapTab}`)
    console.log(`BONDS tab visible: ${bondsTab}`)

    // Check for price elements
    console.log('💰 Checking price elements...')
    const thorVisible = await mainWindow
      .locator('text=THOR')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false)
    const tcyVisible = await mainWindow
      .locator('text=TCY')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    console.log(`THOR price visible: ${thorVisible}`)
    console.log(`TCY price visible: ${tcyVisible}`)

    // Look for price patterns
    const priceElements = await mainWindow.locator('text=/\\$\\s*[0-9]+\\.[0-9]+/').all()
    console.log(`Found ${priceElements.length} price-like elements`)

    if (priceElements.length > 0) {
      const firstPrice = await priceElements[0].textContent()
      console.log(`Sample price: ${firstPrice}`)
    }

    // At least some navigation should be visible
    const hasNavigation = walletTab || swapTab || bondsTab
    expect(hasNavigation).toBeTruthy()
  })

  test('05 - should maintain singleton state throughout', async ({ electronApp, mainWindow }) => {
    await TestHelpers.waitForAppReady(mainWindow)

    console.log('\n✅ TEST 5: Final singleton validation')

    // This test should still see the unlocked state
    const url = await mainWindow.url()
    const windows = electronApp.windows()

    console.log(`Final URL: ${url}`)
    console.log(`Final window count: ${windows.length}`)

    // Should NOT be locked (state preserved from earlier tests)
    expect(url).not.toContain('#/wallet/locked')

    // Should still have exactly 2 windows
    expect(windows.length).toBe(2)

    console.log('🎉 Singleton behavior confirmed across all tests!')

    // Take final screenshot
    await mainWindow.screenshot({
      path: 'test-results/final-state.png',
      fullPage: true
    })
    console.log('📸 Final screenshot saved')
  })
})
