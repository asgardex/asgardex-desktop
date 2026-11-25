import path from 'path'

import { dialog } from 'electron'
import * as fs from 'fs-extra'

import { IPCSaveBalancesJsonParams, IPCSaveCsvParams } from '../../shared/api/types'
import { DEFAULT_STORAGES } from '../../shared/const'
import { getFileContent, saveToFile } from './fileStore'

const commonDefault = DEFAULT_STORAGES.common

// Start the dialog in the last used export directory, if it still exists
const getBalancesDefaultPath = async (fileName: string): Promise<string> => {
  try {
    const { lastBalancesExportDir } = await getFileContent('common', commonDefault)
    if (lastBalancesExportDir && (await fs.pathExists(lastBalancesExportDir))) {
      // Basename only: the directory is a path the user already chose in the save dialog.
      const safeName = path.basename(fileName)
      /* trunk-ignore(semgrep/javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal) */
      return path.join(lastBalancesExportDir, safeName)
    }
  } catch (_) {
    // Fall back to the file name only
  }
  return fileName
}

export const saveBalancesJson = async ({ fileName, data }: IPCSaveBalancesJsonParams) => {
  const savePath = await dialog.showSaveDialog({
    defaultPath: await getBalancesDefaultPath(fileName),
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  })
  if (!savePath.canceled && savePath.filePath) {
    await fs.ensureFile(savePath.filePath)
    await fs.writeJSON(savePath.filePath, data, { spaces: 2 })
    // Remembering the directory is best effort and must not fail the export
    await saveToFile('common', { lastBalancesExportDir: path.dirname(savePath.filePath) }, commonDefault).catch(
      () => undefined
    )
  }
}

export const saveCsv = async ({ fileName, content }: IPCSaveCsvParams) => {
  const savePath = await dialog.showSaveDialog({
    defaultPath: fileName,
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  })
  if (!savePath.canceled && savePath.filePath) {
    await fs.ensureFile(savePath.filePath)
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- path chosen by the user in the save dialog
    return fs.writeFile(savePath.filePath, content, 'utf8')
  }
}
