import { dialog } from 'electron'
import { either as E } from 'fp-ts'
import * as fs from 'fs-extra'

import { TxFileFormat, WatchOnlyWallet } from '../../shared/api/offlineTx'

/**
 * Export watch-only wallets (public keys only)
 */
export const exportWatchWallets = async (wallets: WatchOnlyWallet[]): Promise<E.Either<Error, string>> => {
  try {
    const fileName = `watch_wallets_${Date.now()}.json`

    const result = await dialog.showSaveDialog({
      title: 'Export Watch-Only Wallets',
      defaultPath: fileName,
      filters: [
        { name: 'Wallet Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    })

    if (result.canceled || !result.filePath) {
      return E.left(new Error('Export cancelled'))
    }

    const fileData: TxFileFormat = {
      type: 'ASGARDEX_WATCH_WALLET',
      version: '1.0.0',
      data: wallets
    }

    await fs.writeJSON(result.filePath, fileData, { spaces: 2 })
    return E.right(result.filePath)
  } catch (error) {
    return E.left(
      new Error(`Failed to export watch wallets: ${error instanceof Error ? error.message : String(error)}`)
    )
  }
}

/**
 * Import watch-only wallets (public keys only)
 */
export const importWatchWallets = async (): Promise<E.Either<Error, WatchOnlyWallet[]>> => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Import Watch-Only Wallets',
      filters: [
        { name: 'Wallet Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return E.left(new Error('Import cancelled'))
    }

    const fileContent: TxFileFormat = await fs.readJSON(result.filePaths[0])

    // Validate file format
    if (fileContent.type !== 'ASGARDEX_WATCH_WALLET') {
      return E.left(new Error('Invalid file type. Expected watch wallet file.'))
    }

    if (fileContent.version !== '1.0.0') {
      return E.left(new Error(`Unsupported file version: ${fileContent.version}`))
    }

    return E.right(fileContent.data as WatchOnlyWallet[])
  } catch (error) {
    return E.left(
      new Error(`Failed to import watch wallets: ${error instanceof Error ? error.message : String(error)}`)
    )
  }
}
