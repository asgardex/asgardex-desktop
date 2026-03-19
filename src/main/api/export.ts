import { dialog } from 'electron'
import * as fs from 'fs-extra'

import { IPCSaveBalancesJsonParams } from '../../shared/api/types'

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
