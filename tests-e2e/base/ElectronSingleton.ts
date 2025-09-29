import { ElectronApplication, Page, _electron as electron } from 'playwright'

// TRUE GLOBAL SINGLETON - shared across ALL test files
class ElectronSingletonManager {
  private static electronApp: ElectronApplication | null = null
  private static mainWindow: Page | null = null
  private static isInitialized = false
  private static launchCount = 0

  static async getElectronApp(): Promise<ElectronApplication> {
    if (!this.electronApp) {
      await this.createElectronInstance()
    }
    return this.electronApp!
  }

  static async getMainWindow(): Promise<Page> {
    if (!this.mainWindow) {
      const app = await this.getElectronApp()
      console.log('🖼️ Getting main window reference...')
      this.mainWindow = await app.firstWindow()
      await this.mainWindow.waitForLoadState('domcontentloaded', { timeout: 30000 })
      await this.mainWindow.waitForTimeout(2000)
      console.log('✅ Main window ready')
    }
    return this.mainWindow
  }

  private static async createElectronInstance(): Promise<void> {
    this.launchCount++

    if (this.launchCount > 1) {
      console.error(`❌ SINGLETON VIOLATION: Attempt to create instance #${this.launchCount}`)
      console.error('❌ This should NEVER happen with a proper singleton!')
      throw new Error(`Singleton violation: ${this.launchCount} instances created`)
    }

    console.log('🚀 Creating TRUE GLOBAL Electron instance for ALL test files...')

    this.electronApp = await electron.launch({
      args: [
        '.',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-sandbox',
        '--disable-gpu-sandbox'
      ],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        VITE_NODE_ENV: 'development',
        ELECTRON_ENABLE_LOGGING: '1',
        ELECTRON_DISABLE_SANDBOX: '1',
        ELECTRON_IS_DEV: '1'
      },
      timeout: 60000
    })

    console.log('✅ TRUE GLOBAL Electron instance created successfully')
    this.isInitialized = true
  }

  static getStats() {
    return {
      isInitialized: this.isInitialized,
      hasApp: !!this.electronApp,
      hasWindow: !!this.mainWindow,
      launchCount: this.launchCount
    }
  }

  static async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up singleton...')

    if (this.electronApp) {
      await this.electronApp.close()
      this.electronApp = null
    }

    this.mainWindow = null
    this.isInitialized = false

    console.log('✅ Singleton cleanup complete')
  }
}

export default ElectronSingletonManager
