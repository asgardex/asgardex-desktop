import path from 'path'

import { app } from 'electron'

export const APP_NAME = app?.name ?? 'ASGARDEX'

export const APP_DATA_DIR = path.join(app?.getPath('appData') ?? './testdata', APP_NAME)
export const STORAGE_DIR = path.join(APP_DATA_DIR, 'storage')

/**
 * Vultisig SDK FileStorage base path inside the app data tree.
 * Used on Flatpak so vaults live under the sandbox-writable XDG config
 * (`…/ASGARDEX/vultisig`) instead of host `~/.vultisig`. Native builds keep
 * the SDK default (`~/.vultisig`) unless a custom FileStorage is passed.
 */
export const VULTISIG_DIR = path.join(APP_DATA_DIR, 'vultisig')
