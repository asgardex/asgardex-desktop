import os from 'os'
import path from 'path'

import log from 'electron-log'
import * as fs from 'fs-extra'

import { APP_NAME, STORAGE_DIR } from './const'

// Marker dropped into the sandbox storage once a host import has run,
// so the migration never repeats (even if the user later removes all wallets).
const MIGRATION_MARKER = path.join(STORAGE_DIR, '.host-storage-migrated')

/**
 * Returns `true` if the given `wallets.json` exists and holds at least one wallet.
 * Any read/parse problem is treated as "no wallets" so migration logic stays safe.
 */
const hasWallets = async (walletsFile: string): Promise<boolean> => {
  try {
    if (!(await fs.pathExists(walletsFile))) return false
    const content = await fs.readJSON(walletsFile)
    return Array.isArray(content) && content.length > 0
  } catch (_) {
    return false
  }
}

/**
 * Previous Flatpak app id (pre Flathub / asgardex.com reverse-DNS rename).
 * finishArgs grants read-only access so first launch can import wallets.
 */
const LEGACY_FLATPAK_APP_ID = 'org.thorchain.asgardex'

/**
 * Candidate host storage dirs, in preference order.
 * Paths are reachable only when the corresponding `--filesystem=…:ro` finishArg is set.
 */
const hostStorageCandidates = (): string[] => {
  const home = os.homedir()
  return [
    // Native .deb / AppImage install
    path.join(home, '.config', APP_NAME, 'storage'),
    // Legacy Flatpak id sandbox (org.thorchain.asgardex → com.asgardex.Asgardex)
    path.join(home, '.var', 'app', LEGACY_FLATPAK_APP_ID, 'config', APP_NAME, 'storage')
  ]
}

/**
 * One-time import of keystores/storage when running inside a Flatpak sandbox.
 *
 * Electron's `userData` resolves to `~/.config/ASGARDEX` for the native
 * `.deb`/`AppImage` install, but inside the Flatpak sandbox `~/.config` is
 * redirected to `~/.var/app/<appId>/config`, so wallets created by the native
 * (or previous Flatpak id) install are invisible. finishArgs grant read-only
 * access to those host paths so on first run we can copy them in.
 *
 * Guards (all must hold, otherwise it is a no-op):
 *  - running inside a Flatpak sandbox (`FLATPAK_ID` is set),
 *  - the migration has not run before (no marker file),
 *  - the sandbox has no wallets yet (never overwrite real sandbox data),
 *  - at least one host candidate actually has wallets to import.
 *
 * Failures are logged and swallowed — migration must never block startup.
 */
export const migrateHostStorageIntoFlatpak = async (): Promise<void> => {
  // Only relevant inside a Flatpak sandbox
  if (!process.env.FLATPAK_ID) return

  try {
    // Already migrated → nothing to do
    if (await fs.pathExists(MIGRATION_MARKER)) return

    // Never clobber a sandbox that already holds wallets
    if (await hasWallets(path.join(STORAGE_DIR, 'wallets.json'))) return

    let sourceStorage: string | undefined
    for (const candidate of hostStorageCandidates()) {
      if (await hasWallets(path.join(candidate, 'wallets.json'))) {
        sourceStorage = candidate
        break
      }
    }
    if (!sourceStorage) return

    log.info(`[storage-migration] Importing host storage from ${sourceStorage} into Flatpak sandbox`)
    await fs.ensureDir(STORAGE_DIR)
    // Sandbox holds only empty defaults at this point, so a full overwrite is safe
    // and ensures the empty `wallets.json` is replaced by the host's.
    await fs.copy(sourceStorage, STORAGE_DIR, { overwrite: true })
    // MIGRATION_MARKER is a constant path under the app-controlled STORAGE_DIR (no user input).
    /* trunk-ignore(eslint/security/detect-non-literal-fs-filename) */
    await fs.writeFile(MIGRATION_MARKER, new Date().toISOString())
    log.info('[storage-migration] Host storage imported successfully')
  } catch (error) {
    // Never block startup because of a failed migration
    log.error(`[storage-migration] Failed to import host storage: ${error}`)
  }
}
