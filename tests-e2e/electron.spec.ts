import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { test, expect } from '@playwright/test'
import { _electron as electron } from 'playwright'

let app, window
let viteProcess: ChildProcessWithoutNullStreams

const VITE_URL = 'http://localhost:3000'

//Run using npx playwright test --headed --debug to launch inspector.

async function startVite() {
  return new Promise<void>((resolve, reject) => {
    // Launches normal yarn dev
    viteProcess = spawn('yarn', ['dev'], { shell: false })
    let viteReady = false

    viteProcess.stdout.on('data', (data) => {
      const text = data.toString()
      console.log('[VITE STDOUT]', text)
      if (text.includes('start electron app...') && !viteReady) {
        viteReady = true
        setTimeout(() => resolve(), 3000)
      }
    })

    viteProcess.stderr.on('data', (data) => {
      console.error('[VITE STDERR]', data.toString())
    })

    viteProcess.on('error', (err) => {
      console.error('[VITE ERROR]', err)
      reject(err)
    })
    viteProcess.on('exit', (code) => {
      if (!viteReady) {
        reject(new Error(`Vite exited with code ${code} before ready`))
      }
    })
  })
}

test.beforeAll(async () => {
  await startVite()
  try {
    console.log('Launching Electron...')
    // Launches a second instance that works with the inspetor.
    app = await electron.launch({
      args: ['build/main/electron.js'],
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: VITE_URL,
        ELECTRON_ENABLE_LOGGING: 'true',
        ELECTRON_DISABLE_SANDBOX: '1'
      },
      timeout: 30000
    })

    console.log('Waiting for first window...')
    window = await app.firstWindow()
    console.log('Waiting for DOM to load...')
    await window.waitForLoadState('domcontentloaded', { timeout: 30000 })
  } catch (error) {
    console.error('Electron launch failed:', error)
    throw error
  }
})

test.afterAll(async () => {
  if (app) await app.close()
  if (viteProcess) viteProcess.kill('SIGTERM')
})

test('app basic test', async () => {
  const appPath = await app.evaluate(async ({ app }) => app.getAppPath())
  console.log('Electron app path:', appPath)
  const title = await window.title()
  console.log('Window title:', title)
  expect(title).toBeTruthy()
})

test('interact with UI', async () => {
  await window.click('[data-testid="protocol-switch"]')
  const optionsVisible = await window.isVisible('[data-testid="protocol-options"]')
  expect(optionsVisible).toBe(true)

  await window.click('[data-testid="open-modal"]')
  const modalColor = await window
    .locator('[data-testid="modal"]')
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(modalColor).toBe('rgb(0, 0, 0)') // Adjust to expected color
})
