import * as path from 'path'
import { dialog } from 'electron'
import * as fs from 'fs-extra'
import { either as E } from 'fp-ts'

import { TxFileFormat, OfflineTxBundle, SignedTxBundle, WatchOnlyWallet } from '../../shared/api/offlineTx'

/**
 * Export unsigned transaction bundle to USB or selected location
 */
export const exportUnsignedTx = async (bundle: OfflineTxBundle): Promise<E.Either<Error, string>> => {
  try {
    const fileName = `unsigned_tx_${bundle.chain}_${Date.now()}.json`

    const result = await dialog.showSaveDialog({
      title: 'Export Unsigned Transaction',
      defaultPath: fileName,
      filters: [
        { name: 'Transaction Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    })

    if (result.canceled || !result.filePath) {
      return E.left(new Error('Export cancelled'))
    }

    const fileData: TxFileFormat = {
      type: 'ASGARDEX_UNSIGNED_TX',
      version: '1.0.0',
      data: bundle
    }

    await fs.writeJSON(result.filePath, fileData, { spaces: 2 })
    return E.right(result.filePath)
  } catch (error) {
    return E.left(new Error(`Failed to export transaction: ${error instanceof Error ? error.message : String(error)}`))
  }
}

/**
 * Import unsigned transaction bundle from USB or file
 */
export const importUnsignedTx = async (): Promise<E.Either<Error, OfflineTxBundle>> => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Import Unsigned Transaction',
      filters: [
        { name: 'Transaction Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return E.left(new Error('Import cancelled'))
    }

    const fileContent: TxFileFormat = await fs.readJSON(result.filePaths[0])

    // Validate file format
    if (fileContent.type !== 'ASGARDEX_UNSIGNED_TX') {
      return E.left(new Error('Invalid file type. Expected unsigned transaction file.'))
    }

    if (fileContent.version !== '1.0.0') {
      return E.left(new Error(`Unsupported file version: ${fileContent.version}`))
    }

    return E.right(fileContent.data as OfflineTxBundle)
  } catch (error) {
    return E.left(new Error(`Failed to import transaction: ${error instanceof Error ? error.message : String(error)}`))
  }
}

/**
 * Export signed transaction bundle to USB or selected location
 */
export const exportSignedTx = async (bundle: SignedTxBundle): Promise<E.Either<Error, string>> => {
  try {
    const fileName = `signed_tx_${bundle.chain}_${Date.now()}.json`

    const result = await dialog.showSaveDialog({
      title: 'Export Signed Transaction',
      defaultPath: fileName,
      filters: [
        { name: 'Transaction Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['createDirectory', 'showOverwriteConfirmation']
    })

    if (result.canceled || !result.filePath) {
      return E.left(new Error('Export cancelled'))
    }

    const fileData: TxFileFormat = {
      type: 'ASGARDEX_SIGNED_TX',
      version: '1.0.0',
      data: bundle
    }

    await fs.writeJSON(result.filePath, fileData, { spaces: 2 })
    return E.right(result.filePath)
  } catch (error) {
    return E.left(
      new Error(`Failed to export signed transaction: ${error instanceof Error ? error.message : String(error)}`)
    )
  }
}

/**
 * Import signed transaction bundle from USB or file
 */
export const importSignedTx = async (): Promise<E.Either<Error, SignedTxBundle>> => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Import Signed Transaction',
      filters: [
        { name: 'Transaction Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return E.left(new Error('Import cancelled'))
    }

    const fileContent: TxFileFormat = await fs.readJSON(result.filePaths[0])

    // Validate file format
    if (fileContent.type !== 'ASGARDEX_SIGNED_TX') {
      return E.left(new Error('Invalid file type. Expected signed transaction file.'))
    }

    if (fileContent.version !== '1.0.0') {
      return E.left(new Error(`Unsupported file version: ${fileContent.version}`))
    }

    return E.right(fileContent.data as SignedTxBundle)
  } catch (error) {
    return E.left(
      new Error(`Failed to import signed transaction: ${error instanceof Error ? error.message : String(error)}`)
    )
  }
}

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

/**
 * Clear transaction files from a USB drive or directory
 */
export const clearTransactionFiles = async (directoryPath?: string): Promise<E.Either<Error, number>> => {
  try {
    let targetPath = directoryPath

    if (!targetPath) {
      const result = await dialog.showOpenDialog({
        title: 'Select USB Drive or Directory to Clear',
        properties: ['openDirectory']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return E.left(new Error('Operation cancelled'))
      }

      targetPath = result.filePaths[0]
    }

    // Find all transaction files
    const files = await fs.readdir(targetPath)
    const txFiles = files.filter(
      (file) => file.match(/^(unsigned|signed)_tx_.*\.json$/) || (file.includes('ASGARDEX_') && file.endsWith('.json'))
    )

    // Delete transaction files
    let deletedCount = 0
    for (const file of txFiles) {
      const filePath = path.join(targetPath, file)
      try {
        // Verify it's a transaction file before deleting
        const content = await fs.readJSON(filePath)
        if (content.type === 'ASGARDEX_UNSIGNED_TX' || content.type === 'ASGARDEX_SIGNED_TX') {
          await fs.remove(filePath)
          deletedCount++
        }
      } catch {
        // Skip files that can't be read or aren't valid JSON
        continue
      }
    }

    return E.right(deletedCount)
  } catch (error) {
    return E.left(
      new Error(`Failed to clear transaction files: ${error instanceof Error ? error.message : String(error)}`)
    )
  }
}
