import 'dotenv/config'
import { writeFileSync, mkdtempSync, chmodSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { notarize, stapleApp } from '@electron/notarize'

/*
 Pre-requisites: https://github.com/electron/electron-notarize#prerequisites
    App Store Connect API (recommended):
    1. Create an API key in App Store Connect
    2. Provide APPLE_API_KEY (base64 encoded .p8 file), APPLE_API_KEY_ID, APPLE_API_ISSUER as env's

    Legacy method (deprecated):
    1. Generate an app specific password
    2. Provide SIGNING_APPLE_ID, SIGNING_APP_PASSWORD, SIGNING_TEAM_ID as env's
*/

/*
  Notarizing: https://kilianvalkhof.com/2019/electron/notarizing-your-electron-application/
*/

const isEmpty = (v) => !v || v.length === 0

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export default async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') {
    console.log(`No need to notarize app on ${electronPlatformName}`)
    return
  }

  console.log('Notarizing mac application')

  const appName = context.packager.appInfo.productFilename
  const { APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER, SIGNING_APPLE_ID, SIGNING_APP_PASSWORD, SIGNING_TEAM_ID } =
    process.env

  let options = {
    appBundleId: 'org.thorchain.asgardex',
    appPath: `${appOutDir}/${appName}.app`
  }

  let tempKeyPath = null
  let tempDir = null

  // Prefer App Store Connect API key method (modern)
  if (!isEmpty(APPLE_API_KEY) && !isEmpty(APPLE_API_KEY_ID) && !isEmpty(APPLE_API_ISSUER)) {
    console.log('Using App Store Connect API key authentication')

    // Create a temporary directory with restricted permissions
    tempDir = mkdtempSync(join(tmpdir(), 'notarize-'))
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    chmodSync(tempDir, 0o700) // Only owner can read/write/execute

    tempKeyPath = join(tempDir, 'AuthKey.p8')

    // Decode base64 and write to temp file with restricted permissions
    const keyContent = Buffer.from(APPLE_API_KEY, 'base64').toString('utf-8')
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(tempKeyPath, keyContent, { mode: 0o600 }) // Only owner can read/write

    options = {
      ...options,
      appleApiKey: tempKeyPath,
      appleApiKeyId: APPLE_API_KEY_ID,
      appleApiIssuer: APPLE_API_ISSUER
    }
  }
  // Fallback to legacy method (deprecated but still supported)
  else if (!isEmpty(SIGNING_APPLE_ID) && !isEmpty(SIGNING_TEAM_ID) && !isEmpty(SIGNING_APP_PASSWORD)) {
    console.log('Using legacy Apple ID authentication (deprecated - consider migrating to API keys)')
    options = {
      ...options,
      appleId: SIGNING_APPLE_ID,
      appleIdPassword: SIGNING_APP_PASSWORD,
      teamId: SIGNING_TEAM_ID
    }
  }
  // No valid credentials found
  else {
    const errorMessage =
      'Missing required notarization credentials. Provide either:\n' +
      '1. APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER (recommended), or\n' +
      '2. SIGNING_APPLE_ID, SIGNING_APP_PASSWORD, SIGNING_TEAM_ID (legacy)'
    console.error(errorMessage)
    throw new Error(errorMessage)
  }

  console.log(`appPath: ${options.appPath}`)

  // Retry logic for notarization reliability
  const maxRetries = 3
  let lastError

  try {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Notarization attempt ${attempt}/${maxRetries}`)
        await notarize(options)
        console.log('Notarization successful')

        // Staple the notarization ticket to the app
        console.log('Stapling notarization ticket to app...')
        await stapleApp({
          appPath: options.appPath
        })
        console.log('App stapling successful')
        return
      } catch (error) {
        lastError = error
        console.error(`Notarization attempt ${attempt} failed:`)
        console.error(error.message)

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
          console.log(`Retrying in ${delay / 1000} seconds...`)
          await sleep(delay)
        }
      }
    }

    // All retries failed
    console.error(`Notarization failed after ${maxRetries} attempts`)
    throw new Error(`Notarization failed: ${lastError.message}`)
  } finally {
    // Clean up temporary directory and all contents if created
    if (tempDir) {
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        rmSync(tempDir, { recursive: true, force: true })
        console.log('Cleaned up temporary notarization directory')
      } catch (cleanupError) {
        console.warn('Failed to clean up temporary directory:')
        console.warn(cleanupError.message)
      }
    }
  }
}
