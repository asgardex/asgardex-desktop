import { dialog } from 'electron'
import * as fs from 'fs-extra'

import { IPCSaveBalancesJsonParams, IPCSaveCsvParams } from '../../shared/api/types'

export const saveBalancesJson = async ({ fileName, data }: IPCSaveBalancesJsonParams) => {
  const savePath = await dialog.showSaveDialog({
    defaultPath: fileName,
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  })
  if (!savePath.canceled && savePath.filePath) {
    await fs.ensureFile(savePath.filePath)
    return fs.writeJSON(savePath.filePath, data, { spaces: 2 })
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
