import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_STORAGES } from '../../shared/const'
import { getStoreFilesIPCMessages } from '../../shared/ipc/fileStore'

const { fsMock, handlers } = vi.hoisted(() => ({
  fsMock: {
    pathExists: vi.fn(),
    readJSON: vi.fn(),
    writeJSON: vi.fn(),
    remove: vi.fn()
  },
  handlers: new Map<string, () => Promise<unknown>>()
}))

vi.mock('fs-extra', () => fsMock)
vi.mock('../utils/file', () => ({
  buildJsonFilePath: (dir: string, name: string, version: string) => `${dir}/${name}-v${version}.json`
}))
vi.mock('electron', () => ({
  app: undefined,
  ipcMain: {
    handle: (channel: string, handler: () => Promise<unknown>) => handlers.set(channel, handler)
  }
}))

import { getFileContent, getFileStoreService } from './fileStore'

const favouritesDefault = DEFAULT_STORAGES.assetFavourites
const userNodesDefault = DEFAULT_STORAGES.userNodes

describe('main/api/fileStore read failures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.clear()
    fsMock.writeJSON.mockResolvedValue(undefined)
  })

  it('rejects the favourites read over IPC when the existing file cannot be parsed', async () => {
    fsMock.pathExists.mockResolvedValue(true)
    fsMock.readJSON.mockRejectedValue(new SyntaxError('Unexpected end of JSON input'))

    getFileStoreService('assetFavourites', favouritesDefault).registerIpcHandlersMain()
    const getFile = handlers.get(getStoreFilesIPCMessages('assetFavourites').GET_FILE)

    await expect(getFile?.()).rejects.toThrow('Unexpected end of JSON input')
    expect(fsMock.writeJSON).not.toHaveBeenCalled()
  })

  it('does not overwrite an unreadable favourites file on save', async () => {
    fsMock.pathExists.mockResolvedValue(true)
    fsMock.readJSON.mockRejectedValue(new Error('EACCES'))

    getFileStoreService('assetFavourites', favouritesDefault).registerIpcHandlersMain()
    const saveFile = handlers.get(getStoreFilesIPCMessages('assetFavourites').SAVE_FILE) as unknown as (
      event: unknown,
      data: unknown
    ) => Promise<unknown>

    await expect(saveFile({}, { favourites: { mainnet: [], stagenet: [], testnet: [] } })).rejects.toThrow('EACCES')
    expect(fsMock.writeJSON).not.toHaveBeenCalled()
  })

  it('still creates the favourites file with defaults when it is missing', async () => {
    fsMock.pathExists.mockResolvedValue(false)

    await expect(getFileContent('assetFavourites', favouritesDefault)).resolves.toEqual(favouritesDefault)
    expect(fsMock.writeJSON).toHaveBeenCalledTimes(1)
    expect(fsMock.readJSON).not.toHaveBeenCalled()
  })

  it('keeps returning defaults for other stores when their file cannot be parsed', async () => {
    fsMock.pathExists.mockResolvedValue(true)
    fsMock.readJSON.mockRejectedValue(new SyntaxError('Unexpected token'))

    await expect(getFileContent('userNodes', userNodesDefault)).resolves.toEqual(userNodesDefault)
  })
})
