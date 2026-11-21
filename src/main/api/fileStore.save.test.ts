import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_STORAGES } from '../../shared/const'
import { Locale } from '../../shared/i18n/types'

const { fsMock, disk } = vi.hoisted(() => ({
  fsMock: {
    pathExists: vi.fn(),
    readJSON: vi.fn(),
    writeJSON: vi.fn(),
    remove: vi.fn()
  },
  disk: new Map<string, unknown>()
}))

vi.mock('fs-extra', () => fsMock)
vi.mock('../utils/file', () => ({
  buildJsonFilePath: (dir: string, name: string, version: string) => `${dir}/${name}-v${version}.json`
}))
vi.mock('electron', () => ({ app: undefined, ipcMain: { handle: vi.fn() } }))

import { saveToFile } from './fileStore'

const commonDefault = DEFAULT_STORAGES.common

// Yield to the event loop so overlapping saves can interleave their awaited I/O
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('main/api/fileStore saveToFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    disk.clear()
    fsMock.pathExists.mockImplementation(async (path: string) => disk.has(path))
    fsMock.readJSON.mockImplementation(async (path: string) => {
      await tick()
      return structuredClone(disk.get(path))
    })
    fsMock.writeJSON.mockImplementation(async (path: string, data: unknown) => {
      await tick()
      disk.set(path, structuredClone(data))
    })
  })

  it('keeps both changes when two saves to the same store overlap', async () => {
    await saveToFile('common', {}, commonDefault)

    const [a, b] = await Promise.all([
      saveToFile('common', { locale: Locale.DE }, commonDefault),
      saveToFile('common', { lastBalancesExportDir: '/home/u/exports' }, commonDefault)
    ])

    expect(a).toMatchObject({ locale: Locale.DE })
    expect(b).toMatchObject({ locale: Locale.DE, lastBalancesExportDir: '/home/u/exports' })
    expect([...disk.values()][0]).toMatchObject({ locale: Locale.DE, lastBalancesExportDir: '/home/u/exports' })
  })

  it('runs later saves after a failed one', async () => {
    await saveToFile('common', {}, commonDefault)
    fsMock.writeJSON.mockRejectedValueOnce(new Error('EACCES'))

    const failed = saveToFile('common', { locale: Locale.DE }, commonDefault)
    const next = saveToFile('common', { lastBalancesExportDir: '/home/u/exports' }, commonDefault)

    await expect(failed).rejects.toThrow('EACCES')
    await expect(next).resolves.toMatchObject({ lastBalancesExportDir: '/home/u/exports' })
  })
})
