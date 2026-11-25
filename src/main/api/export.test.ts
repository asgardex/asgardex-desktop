import path from 'path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_STORAGES } from '../../shared/const'

const { dialogMock, fsMock, fileStoreMock } = vi.hoisted(() => ({
  dialogMock: { showSaveDialog: vi.fn() },
  fsMock: { pathExists: vi.fn(), ensureFile: vi.fn(), writeJSON: vi.fn(), writeFile: vi.fn() },
  fileStoreMock: { getFileContent: vi.fn(), saveToFile: vi.fn() }
}))

vi.mock('electron', () => ({ dialog: dialogMock }))
vi.mock('fs-extra', () => fsMock)
vi.mock('./fileStore', () => fileStoreMock)

import { saveBalancesJson } from './export'

const commonDefault = DEFAULT_STORAGES.common
const data = { walletName: 'w', exportedAt: '2026-11-21T00:00:00.000Z', balances: [], lpPositions: [] }
const fileName = '20261121-140509-w.json'

describe('main/api/export saveBalancesJson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fsMock.ensureFile.mockResolvedValue(undefined)
    fsMock.writeJSON.mockResolvedValue(undefined)
    fileStoreMock.saveToFile.mockResolvedValue(undefined)
  })

  it('opens the dialog in the remembered directory when it exists', async () => {
    fileStoreMock.getFileContent.mockResolvedValue({ ...commonDefault, lastBalancesExportDir: '/home/u/exports' })
    fsMock.pathExists.mockResolvedValue(true)
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: true })

    await saveBalancesJson({ fileName, data })

    expect(dialogMock.showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: path.join('/home/u/exports', fileName) })
    )
  })

  it('falls back to the file name when the remembered directory is gone', async () => {
    fileStoreMock.getFileContent.mockResolvedValue({ ...commonDefault, lastBalancesExportDir: '/mnt/usb' })
    fsMock.pathExists.mockResolvedValue(false)
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: true })

    await saveBalancesJson({ fileName, data })

    expect(dialogMock.showSaveDialog).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: fileName }))
  })

  it('falls back to the file name when nothing is remembered', async () => {
    fileStoreMock.getFileContent.mockResolvedValue(commonDefault)
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: true })

    await saveBalancesJson({ fileName, data })

    expect(dialogMock.showSaveDialog).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: fileName }))
  })

  it('remembers the directory after a successful save', async () => {
    fileStoreMock.getFileContent.mockResolvedValue(commonDefault)
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/home/u/docs/b.json' })

    await saveBalancesJson({ fileName, data })

    expect(fsMock.writeJSON).toHaveBeenCalledWith('/home/u/docs/b.json', data, { spaces: 2 })
    expect(fileStoreMock.saveToFile).toHaveBeenCalledWith(
      'common',
      { lastBalancesExportDir: '/home/u/docs' },
      commonDefault
    )
  })

  it('does not remember anything when the dialog is cancelled', async () => {
    fileStoreMock.getFileContent.mockResolvedValue(commonDefault)
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: true })

    await saveBalancesJson({ fileName, data })

    expect(fsMock.writeJSON).not.toHaveBeenCalled()
    expect(fileStoreMock.saveToFile).not.toHaveBeenCalled()
  })

  it('still succeeds when remembering the directory fails', async () => {
    fileStoreMock.getFileContent.mockResolvedValue(commonDefault)
    fileStoreMock.saveToFile.mockRejectedValue(new Error('EACCES'))
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/home/u/docs/b.json' })

    await expect(saveBalancesJson({ fileName, data })).resolves.toBeUndefined()
    expect(fsMock.writeJSON).toHaveBeenCalled()
  })
})
