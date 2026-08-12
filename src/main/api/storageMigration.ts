import os from 'os'
import path from 'path'

import log from 'electron-log'
import * as fs from 'fs-extra'

import { APP_DATA_DIR, APP_NAME, STORAGE_DIR, VULTISIG_DIR } from './const'

// Marker dropped into the sandbox storage once a host import has run,
// so the migration never repeats (even if the user later removes all wallets).
const MIGRATION_MARKER = path.join(STORAGE_DIR, '.host-storage-migrated')

// Staging dir beside `storage/` (same parent filesystem) so rename is atomic.
// Leftover from a crashed import is cleaned on the next attempt.
const STAGING_DIR = path.join(APP_DATA_DIR, 'storage.migrating')

// Separate vault marker so keystore and Vultisig succeed/fail independently.
const VULTISIG_MIGRATION_MARKER = path.join(VULTISIG_DIR, '.host-vultisig-migrated')
const VULTISIG_STAGING_DIR = path.join(APP_DATA_DIR, 'vultisig.migrating')

/**
 * Previous Flatpak app id (pre Flathub / asgardex.com reverse-DNS rename).
 * finishArgs grants read-only access so first launch can import wallets.
 */
const LEGACY_FLATPAK_APP_ID = 'org.thorchain.asgardex'

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
 * FileStorage vault payloads are root-level `vault:{id}.json` (colons kept).
 * Prefs-only trees (addressBook/config without vaults) do not count.
 */
const isVaultPayloadFile = (name: string): boolean => {
  if (!name.endsWith('.json') || name.endsWith('.tmp')) return false
  // listVaults: split(':').length === 2 && parts[0] === 'vault'
  const base = name.slice(0, -'.json'.length)
  const parts = base.split(':')
  return parts.length === 2 && parts[0] === 'vault' && parts[1].length > 0
}

/**
 * True if a Vultisig FileStorage directory holds at least one vault payload.
 * No SDK import — filesystem only.
 */
const hasVaults = async (dir: string): Promise<boolean> => {
  try {
    if (!(await fs.pathExists(dir))) return false
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- trunk-ignore(eslint/security/detect-non-literal-fs-filename)
    const entries = await fs.readdir(dir)
    return entries.some(isVaultPayloadFile)
  } catch (_) {
    return false
  }
}

/**
 * Newest mtime among vault payload files in a FileStorage root.
 */
const vaultTreeMtimeMs = async (dir: string): Promise<number | undefined> => {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- trunk-ignore(eslint/security/detect-non-literal-fs-filename)
    const entries = await fs.readdir(dir)
    let max: number | undefined
    for (const name of entries) {
      if (!isVaultPayloadFile(name)) continue
      try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- trunk-ignore(eslint/security/detect-non-literal-fs-filename)
        const st = await fs.stat(path.join(dir, name))
        if (max === undefined || st.mtimeMs > max) max = st.mtimeMs
      } catch (_) {
        // skip unreadable entry
      }
    }
    return max
  } catch (_) {
    return undefined
  }
}

/**
 * Host storage dirs that finishArgs may expose (literal host paths).
 * Order is only a default; when several have wallets we pick by mtime.
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
 * Host Vultisig FileStorage dirs (SDK default is ~/.vultisig, not under ASGARDEX).
 * finishArgs: `~/.vultisig:ro` plus existing legacy ASGARDEX config grant.
 */
const hostVultisigCandidates = (): string[] => {
  const home = os.homedir()
  return [
    // Native .deb / AppImage (and any host write using SDK default path)
    path.join(home, '.vultisig'),
    // Only populated if an older Flatpak build relocated vaults under APP_DATA_DIR
    path.join(home, '.var', 'app', LEGACY_FLATPAK_APP_ID, 'config', APP_NAME, 'vultisig')
  ]
}

type HostCandidate = {
  dir: string
  mtimeMs: number
}

const rankCandidates = (withData: HostCandidate[]): string | undefined => {
  if (withData.length === 0) return undefined

  withData.sort((a, b) => {
    if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs
    const aLegacy = a.dir.includes(LEGACY_FLATPAK_APP_ID) ? 1 : 0
    const bLegacy = b.dir.includes(LEGACY_FLATPAK_APP_ID) ? 1 : 0
    return bLegacy - aLegacy
  })

  return withData[0].dir
}

const logMultiCandidateChoice = (kind: string, withData: HostCandidate[], bestDir: string): void => {
  if (withData.length <= 1) return
  const best = withData.find((c) => c.dir === bestDir) ?? withData[0]
  log.info(
    `[storage-migration] Multiple host ${kind} stores; choosing newest ` +
      `(${new Date(best.mtimeMs).toISOString()}): ${best.dir}`
  )
  for (const other of withData) {
    if (other.dir === best.dir) continue
    log.info(
      `[storage-migration] Leaving older host ${kind} store untouched ` +
        `(${new Date(other.mtimeMs).toISOString()}): ${other.dir}`
    )
  }
}

/**
 * Among host candidates that hold wallets, prefer the newest `wallets.json`.
 * Covers three real cohorts without hard-coding “always deb” or “always Flatpak”:
 *  - deb/AppImage only → that tree wins
 *  - legacy Flatpak only → that tree wins
 *  - both present → whichever the user touched last (mtime)
 *
 * On equal mtime, prefer the legacy Flatpak path (this rename’s primary cohort).
 */
const selectHostStorageSource = async (): Promise<string | undefined> => {
  const withWallets: HostCandidate[] = []

  for (const dir of hostStorageCandidates()) {
    const walletsFile = path.join(dir, 'wallets.json')
    if (!(await hasWallets(walletsFile))) continue
    try {
      // Path is from fixed host candidates + APP_NAME, not user input.
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- trunk-ignore(eslint/security/detect-non-literal-fs-filename)
      const st = await fs.stat(walletsFile)
      withWallets.push({ dir, mtimeMs: st.mtimeMs })
    } catch (_) {
      // Race / unreadable after hasWallets — skip
    }
  }

  const best = rankCandidates(withWallets)
  if (best) logMultiCandidateChoice('keystore', withWallets, best)
  return best
}

/**
 * Among host Vultisig stores that hold vault payloads, prefer newest vault file mtime.
 */
const selectHostVultisigSource = async (): Promise<string | undefined> => {
  const withVaults: HostCandidate[] = []

  for (const dir of hostVultisigCandidates()) {
    if (!(await hasVaults(dir))) continue
    const mtimeMs = await vaultTreeMtimeMs(dir)
    if (mtimeMs === undefined) continue
    withVaults.push({ dir, mtimeMs })
  }

  const best = rankCandidates(withVaults)
  if (best) logMultiCandidateChoice('vultisig', withVaults, best)
  return best
}

/**
 * Copy a host directory into `dest` via sibling staging + rename.
 * Marker is written only inside staging so a half-copied tree never becomes live.
 */
const importHostDirAtomically = async (opts: {
  sourceDir: string
  destDir: string
  stagingDir: string
  markerFileName: string
  markerBody: object
}): Promise<void> => {
  const { sourceDir, destDir, stagingDir, markerFileName, markerBody } = opts
  const stagingMarker = path.join(stagingDir, markerFileName)

  // Crash recovery: a prior run may have finished copy+marker, removed dest, then
  // failed before move. Promote that complete staging tree instead of wiping it.
  if (await fs.pathExists(stagingMarker)) {
    try {
      if (await fs.pathExists(destDir)) {
        await fs.remove(destDir)
      }
      await fs.move(stagingDir, destDir)
      return
    } catch (_) {
      await fs.remove(stagingDir).catch(() => undefined)
      // Fall through and re-copy from host.
    }
  } else if (await fs.pathExists(stagingDir)) {
    // Incomplete staging (no marker) — discard and re-copy.
    await fs.remove(stagingDir)
  }

  try {
    await fs.copy(sourceDir, stagingDir)

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- trunk-ignore(eslint/security/detect-non-literal-fs-filename)
    await fs.writeFile(stagingMarker, JSON.stringify(markerBody, null, 2))

    // Caller guaranteed dest has no real wallets/vaults. Empty/default ok to replace.
    if (await fs.pathExists(destDir)) {
      await fs.remove(destDir)
    }
    await fs.move(stagingDir, destDir)
  } catch (error) {
    await fs.remove(stagingDir).catch(() => undefined)
    throw error
  }
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
 * When both native and legacy Flatpak stores have wallets, the newest
 * `wallets.json` (mtime) is imported; older trees are left untouched on disk.
 *
 * Failures are logged and swallowed — migration must never block startup.
 */
export const migrateHostStorageIntoFlatpak = async (): Promise<void> => {
  if (!process.env.FLATPAK_ID) return

  try {
    if (await fs.pathExists(MIGRATION_MARKER)) return
    if (await hasWallets(path.join(STORAGE_DIR, 'wallets.json'))) return

    const sourceStorage = await selectHostStorageSource()
    if (!sourceStorage) return

    log.info(`[storage-migration] Importing host storage from ${sourceStorage} into Flatpak sandbox`)
    await importHostDirAtomically({
      sourceDir: sourceStorage,
      destDir: STORAGE_DIR,
      stagingDir: STAGING_DIR,
      markerFileName: '.host-storage-migrated',
      markerBody: { at: new Date().toISOString(), from: sourceStorage }
    })
    log.info('[storage-migration] Host storage imported successfully')
  } catch (error) {
    log.error(`[storage-migration] Failed to import host storage: ${error}`)
  }
}

/**
 * One-time import of Vultisig FileStorage (`~/.vultisig`) into the Flatpak sandbox.
 *
 * SDK default store is host `~/.vultisig` (not under ASGARDEX). On Flatpak the SDK is
 * reconfigured to `VULTISIG_DIR` (`APP_DATA_DIR/vultisig`) so the live store is writable
 * without a RW host grant. This migrates existing host vaults into that path before
 * the first `initializeSDK()` / MPC IPC call.
 *
 * Independent of keystore migration (separate marker). Never deletes host sources;
 * never overwrites a sandbox that already has vault payloads.
 */
export const migrateHostVultisigIntoFlatpak = async (): Promise<void> => {
  if (!process.env.FLATPAK_ID) return

  try {
    if (await fs.pathExists(VULTISIG_MIGRATION_MARKER)) return
    if (await hasVaults(VULTISIG_DIR)) return

    const sourceDir = await selectHostVultisigSource()
    if (!sourceDir) return

    log.info(`[storage-migration] Importing host Vultisig store from ${sourceDir} into Flatpak sandbox`)
    await importHostDirAtomically({
      sourceDir,
      destDir: VULTISIG_DIR,
      stagingDir: VULTISIG_STAGING_DIR,
      markerFileName: '.host-vultisig-migrated',
      markerBody: { at: new Date().toISOString(), from: sourceDir }
    })
    log.info('[storage-migration] Host Vultisig store imported successfully')
  } catch (error) {
    log.error(`[storage-migration] Failed to import host Vultisig store: ${error}`)
  }
}

/**
 * Run all Flatpak host→sandbox data imports (keystore then Vultisig).
 * Each step swallows its own errors so one cannot block the other or startup.
 */
export const migrateHostDataIntoFlatpak = async (): Promise<void> => {
  await migrateHostStorageIntoFlatpak()
  await migrateHostVultisigIntoFlatpak()
}
