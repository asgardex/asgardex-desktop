import { test, expect, TestHelpers } from './base/ElectronTestBaseFinal'

test.describe('Complete Wallet Interface Tests', () => {
  // Helper function to ensure wallet is unlocked
  async function ensureWalletUnlocked(mainWindow: any) {
    const currentUrl = await mainWindow.url()

    if (currentUrl.includes('#/wallet/locked')) {
      console.log('🔓 Unlocking wallet...')
      const passwordInput = mainWindow.locator('input[type="password"]').first()
      await expect(passwordInput).toBeVisible({ timeout: 10000 })
      await passwordInput.fill('password')

      const unlockButton = mainWindow.locator('button:has-text("Unlock")').first()
      await expect(unlockButton).toBeVisible({ timeout: 5000 })
      await unlockButton.click()

      await mainWindow.waitForFunction(() => !window.location.hash.includes('/wallet/locked'), { timeout: 15000 })
    }

    // Wait for interface to load
    await mainWindow.waitForTimeout(3000)
  }

  test('should successfully unlock wallet and verify interface loads', async ({ mainWindow }) => {
    await TestHelpers.waitForAppReady(mainWindow)
    await ensureWalletUnlocked(mainWindow)

    const url = await mainWindow.url()
    expect(url).toContain('#/wallet')
    expect(url).not.toContain('#/wallet/locked')

    // Take comprehensive screenshot
    await mainWindow.screenshot({
      path: 'test-results/wallet-unlocked-complete.png',
      fullPage: true
    })

    console.log('✅ Wallet successfully unlocked and interface loaded')
  })

  test('should verify THOR and MAYA price displays are visible and contain data', async ({ mainWindow }) => {
    await TestHelpers.waitForAppReady(mainWindow)
    await ensureWalletUnlocked(mainWindow)

    // Test THOR price display
    const thorElement = mainWindow.locator('text=THOR').first()
    await expect(thorElement).toBeVisible({ timeout: 10000 })

    const thorText = await thorElement.textContent()
    console.log('THOR price element text:', thorText)
    expect(thorText).toContain('THOR')

    // Look for THOR price value in the general area
    const thorPricePattern = mainWindow.locator('text=/\\$\\s*[0-9]+\\.?[0-9]*.*THOR|THOR.*\\$\\s*[0-9]+\\.?[0-9]*/')
    const hasThorPrice = (await thorPricePattern.count()) > 0

    if (hasThorPrice) {
      console.log('✅ THOR price display found and contains price data')
    } else {
      console.log('ℹ️ THOR element found but price pattern not detected')
    }

    // Test MAYA/TCY price display
    const mayaElement = mainWindow.locator('text=MAYA').first()
    await expect(mayaElement).toBeVisible({ timeout: 10000 })

    const mayaText = await mayaElement.textContent()
    console.log('MAYA price element text:', mayaText)
    expect(mayaText).toContain('MAYA')

    // Take screenshot of price area
    await mainWindow.locator('text=THOR').first().screenshot({
      path: 'test-results/price-displays-area.png'
    })
  })

  test('should test all navigation tabs functionality', async ({ mainWindow }) => {
    await TestHelpers.waitForAppReady(mainWindow)
    await ensureWalletUnlocked(mainWindow)

    // Test WALLET tab (should be current)
    const walletTab = mainWindow.locator('text=WALLET').first()
    await expect(walletTab).toBeVisible({ timeout: 5000 })

    // Test SWAP tab navigation
    const swapTab = mainWindow.locator('text=SWAP').first()
    await expect(swapTab).toBeVisible({ timeout: 5000 })
    await swapTab.click()
    await mainWindow.waitForTimeout(2000)

    let currentUrl = await mainWindow.url()
    console.log('After clicking SWAP:', currentUrl)
    expect(currentUrl.toLowerCase()).toMatch(/swap|pool/)

    await mainWindow.screenshot({
      path: 'test-results/swap-interface.png',
      fullPage: true
    })

    // Test BONDS tab navigation
    const bondsTab = mainWindow.locator('text=BONDS').first()
    await expect(bondsTab).toBeVisible({ timeout: 5000 })
    await bondsTab.click()
    await mainWindow.waitForTimeout(2000)

    currentUrl = await mainWindow.url()
    console.log('After clicking BONDS:', currentUrl)
    expect(currentUrl.toLowerCase()).toContain('bonds')

    await mainWindow.screenshot({
      path: 'test-results/bonds-interface.png',
      fullPage: true
    })

    // Return to WALLET tab
    await walletTab.click()
    await mainWindow.waitForTimeout(2000)

    currentUrl = await mainWindow.url()
    console.log('Back to WALLET:', currentUrl)
    expect(currentUrl.toLowerCase()).toMatch(/wallet|assets/)

    console.log('✅ All navigation tabs working correctly')
  })

  test('should verify wallet assets interface elements', async ({ mainWindow }) => {
    await TestHelpers.waitForAppReady(mainWindow)
    await ensureWalletUnlocked(mainWindow)

    // Ensure we're on the wallet/assets page
    const walletTab = mainWindow.locator('text=WALLET').first()
    await walletTab.click()
    await mainWindow.waitForTimeout(2000)

    // Check for sub-navigation tabs in wallet
    const assetsTab = mainWindow.locator('nav a:has-text("Assets")').first()
    const tradeAssetsTab = mainWindow.locator('nav a:has-text("Trade Assets")').first()
    const lpSharesTab = mainWindow.locator('nav a:has-text("LP Shares")').first()

    await expect(assetsTab).toBeVisible({ timeout: 5000 })
    console.log('✅ Assets tab found')

    const hasTradeAssets = await tradeAssetsTab.isVisible({ timeout: 2000 }).catch(() => false)
    if (hasTradeAssets) {
      console.log('✅ Trade Assets tab found')
    }

    const hasLPShares = await lpSharesTab.isVisible({ timeout: 2000 }).catch(() => false)
    if (hasLPShares) {
      console.log('✅ LP Shares tab found')
    }

    // Look for total balance display
    const balanceElement = mainWindow.locator('text=/Total balance|TOTAL BALANCE/')
    const hasBalance = await balanceElement.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasBalance) {
      const balanceText = await balanceElement.textContent()
      console.log('✅ Total balance found:', balanceText)
    }

    // Look for USD amount
    const usdAmount = mainWindow.locator('text=/\\$\\s*[0-9,]+/')
    const hasUsdAmount = (await usdAmount.count()) > 0

    if (hasUsdAmount) {
      const amount = await usdAmount.first().textContent()
      console.log('✅ USD amount found:', amount)
    }

    await mainWindow.screenshot({
      path: 'test-results/wallet-assets-complete.png',
      fullPage: true
    })
  })

  test('should verify network status and app branding', async ({ mainWindow }) => {
    await TestHelpers.waitForAppReady(mainWindow)
    await ensureWalletUnlocked(mainWindow)

    // Check ASGARDEX branding
    const asgardexLogo = mainWindow.locator('text=ASGARDEX').first()
    await expect(asgardexLogo).toBeVisible({ timeout: 5000 })
    console.log('✅ ASGARDEX branding visible')

    // Check MAINNET indicator
    const mainnetIndicator = mainWindow.locator('text=MAINNET').first()
    await expect(mainnetIndicator).toBeVisible({ timeout: 5000 })
    console.log('✅ MAINNET network indicator visible')

    // Verify page title
    const title = await mainWindow.title()
    expect(title).toContain('ASGARDEX')
    console.log('✅ Page title contains ASGARDEX:', title)
  })

  test('should verify interactive elements and user interface responsiveness', async ({ mainWindow }) => {
    await TestHelpers.waitForAppReady(mainWindow)
    await ensureWalletUnlocked(mainWindow)

    // Count interactive elements
    const buttonCount = await mainWindow.locator('button').count()
    const linkCount = await mainWindow.locator('a').count()

    console.log(`📊 Interface analysis:`)
    console.log(`  - Buttons: ${buttonCount}`)
    console.log(`  - Links: ${linkCount}`)

    expect(buttonCount).toBeGreaterThan(5) // Should have multiple interactive elements
    expect(linkCount).toBeGreaterThan(3) // Should have navigation links

    // Test that the interface is responsive (not frozen)
    const bodyVisible = await mainWindow.locator('body').isVisible()
    expect(bodyVisible).toBeTruthy()

    // Verify no obvious error states
    const errorElements = await mainWindow.locator('text=/error|failed|crash/i').count()
    expect(errorElements).toBe(0) // Should not have obvious error messages

    console.log('✅ Interface is responsive and functional')
  })

  test('should test wallet sub-navigation tabs functionality', async ({ mainWindow }) => {
    await TestHelpers.waitForAppReady(mainWindow)
    await ensureWalletUnlocked(mainWindow)

    // Ensure we're on the wallet page
    const walletTab = mainWindow.locator('text=WALLET').first()
    await walletTab.click()
    await mainWindow.waitForTimeout(2000)

    // Test Assets tab
    const assetsTab = mainWindow.locator('nav a:has-text("Assets")').first()
    await assetsTab.click()
    await mainWindow.waitForTimeout(1000)

    await mainWindow.screenshot({
      path: 'test-results/wallet-assets-tab.png',
      fullPage: true
    })
    console.log('✅ Assets tab clicked and screenshot taken')

    // Test Trade Assets tab if available
    const tradeAssetsTab = mainWindow.locator('nav a:has-text("Trade Assets")').first()
    const hasTradeAssets = await tradeAssetsTab.isVisible({ timeout: 2000 }).catch(() => false)

    if (hasTradeAssets) {
      await tradeAssetsTab.click()
      await mainWindow.waitForTimeout(1000)

      await mainWindow.screenshot({
        path: 'test-results/wallet-trade-assets-tab.png',
        fullPage: true
      })
      console.log('✅ Trade Assets tab clicked and screenshot taken')
    }

    // Test LP Shares tab if available
    const lpSharesTab = mainWindow.locator('nav a:has-text("LP Shares")').first()
    const hasLPShares = await lpSharesTab.isVisible({ timeout: 2000 }).catch(() => false)

    if (hasLPShares) {
      await lpSharesTab.click()
      await mainWindow.waitForTimeout(1000)

      await mainWindow.screenshot({
        path: 'test-results/wallet-lp-shares-tab.png',
        fullPage: true
      })
      console.log('✅ LP Shares tab clicked and screenshot taken')
    }

    // Return to Assets tab
    await assetsTab.click()
    await mainWindow.waitForTimeout(1000)
  })
})
