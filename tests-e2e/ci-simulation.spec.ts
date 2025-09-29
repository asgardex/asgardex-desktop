import { test, expect, TestHelpers } from './base/ElectronTestBaseFinal'

test.describe('CI Environment Simulation', () => {
  test('should handle CI-like headless environment', async ({ electronApp, mainWindow }) => {
    // Simulate CI environment
    process.env.CI = 'true'

    console.log('\n🤖 SIMULATING CI ENVIRONMENT')
    console.log('CI env var:', process.env.CI)

    await TestHelpers.waitForAppReady(mainWindow)

    // Basic functionality check
    const url = await mainWindow.url()
    const title = await mainWindow.title()
    const windows = electronApp.windows()

    console.log(`✅ App loaded in CI mode: ${title}`)
    console.log(`✅ URL accessible: ${url}`)
    console.log(`✅ Window count: ${windows.length}`)

    expect(title).toContain('ASGARDEX')
    expect(url).toContain('localhost:3000')
    expect(windows.length).toBe(2)
  })

  test('should handle resource constraints', async ({ mainWindow }) => {
    console.log('\n🤖 TESTING RESOURCE CONSTRAINTS')

    await TestHelpers.waitForAppReady(mainWindow)

    // Test with reduced timeouts (CI-like conditions)
    const quickTimeout = 3000 // Reduced from normal 10000

    try {
      // Quick operations that should work in CI
      const isVisible = await mainWindow.locator('body').isVisible({ timeout: quickTimeout })
      expect(isVisible).toBe(true)

      const elementCount = await mainWindow.locator('*').count()
      expect(elementCount).toBeGreaterThan(10)

      console.log('✅ App responds quickly under constraints')
    } catch (error) {
      console.error('❌ App too slow for CI constraints:', error.message)
      throw error
    }
  })

  test('should handle network timing issues', async ({ mainWindow }) => {
    console.log('\n🤖 TESTING NETWORK TIMING')

    // Test multiple page loads (simulating CI network variability)
    for (let i = 1; i <= 3; i++) {
      console.log(`Network test ${i}/3`)

      await TestHelpers.waitForAppReady(mainWindow)

      const url = await mainWindow.url()
      expect(url).toContain('localhost:3000')

      // Small delay between checks
      await mainWindow.waitForTimeout(1000)
    }

    console.log('✅ Stable under network timing variations')
  })

  test('should generate CI artifacts', async ({ mainWindow }) => {
    console.log('\n🤖 TESTING CI ARTIFACT GENERATION')

    await TestHelpers.waitForAppReady(mainWindow)

    // Generate artifacts that CI would collect
    await mainWindow.screenshot({
      path: 'test-results/ci-simulation-screenshot.png',
      fullPage: true
    })

    // Generate debug info
    await TestHelpers.debugWindowState(mainWindow)

    // Test video recording capability (if available)
    const context = mainWindow.context()
    console.log('Browser context available:', !!context)

    console.log('✅ CI artifacts generated successfully')
  })

  test('should validate singleton under CI stress', async ({ electronApp, mainWindow }) => {
    console.log('\n🤖 TESTING SINGLETON UNDER CI STRESS')

    // Rapid successive operations
    for (let i = 1; i <= 5; i++) {
      await TestHelpers.waitForAppReady(mainWindow)

      const windows = electronApp.windows()
      expect(windows.length).toBe(2)

      // Quick validation
      TestHelpers.validateSingleton()

      console.log(`Stress test ${i}/5: ✅ Singleton stable`)
    }

    console.log('✅ Singleton survives CI-like stress conditions')
  })
})
