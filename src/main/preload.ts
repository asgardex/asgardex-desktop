import { contextBridge, ipcRenderer } from 'electron'

import type {
  ApiFileStoreService,
  ApiKeystore,
  ApiUrl,
  AppUpdateRD,
  IPCExportKeystoreParams,
  StoreFileData,
  StoreFileName
} from '../shared/api/types'
import { getStoreFilesIPCMessages } from '../shared/ipc/fileStore'

import { DKLS } from '../vultisig/core/mpc/dkls/dkls'
import { KeygenOperation } from '../vultisig/core/mpc/keygen/KeygenOperation'
import { Schnorr } from '../vultisig/core/mpc/schnorr/schnorrKeygen'
import __wbg_init_dkls from '../vultisig/lib/dkls/vs_wasm'
import dklsWasmUrl from '../vultisig/lib/dkls/vs_wasm_bg.wasm'
import __wbg_init_schnorr from '../vultisig/lib/schnorr/vs_schnorr_wasm'
import schnorrWasmUrl from '../vultisig/lib/schnorr/vs_schnorr_wasm_bg.wasm'

import { apiHDWallet } from './api/hdwallet'
import { apiLang } from './api/lang'
import IPCMessages from './ipc/messages'

let dklsInstance: DKLS | null = null
let schnorrInstance: Schnorr | null = null

type WasmParam = {
  keygenOperation: KeygenOperation
  isInitiateDevice: boolean
  serverURL: string
  sessionId: string
  localPartyId: string
  keygenCommittee: string[]
  oldKeygenCommittee: string[]
  hexEncryptionKey: string
  localUI?: string
  publicKey?: string
  chainCode?: string
}

contextBridge.exposeInMainWorld('vultisig', {
  initDKLSWasm: async () => {
    await __wbg_init_dkls({ module_or_path: dklsWasmUrl })
  },
  initSchnorrWasm: async () => {
    await __wbg_init_schnorr({ module_or_path: schnorrWasmUrl })
  },
  initDKLS: (params: WasmParam) => {
    dklsInstance = new DKLS(
      params.keygenOperation,
      params.isInitiateDevice,
      params.serverURL,
      params.sessionId,
      params.localPartyId,
      params.keygenCommittee,
      params.oldKeygenCommittee,
      params.hexEncryptionKey,
      params.localUI,
      params.publicKey,
      params.chainCode
    )
  },
  initSchnorr: (params: WasmParam & { setupMessage: Uint8Array }) => {
    schnorrInstance = new Schnorr(
      params.keygenOperation,
      params.isInitiateDevice,
      params.serverURL,
      params.sessionId,
      params.localPartyId,
      params.keygenCommittee,
      params.oldKeygenCommittee,
      params.hexEncryptionKey,
      params.setupMessage,
      params.localUI,
      params.publicKey,
      params.chainCode
    )
  },
  startDKLSKeygenWithRetry: async () => {
    if (!dklsInstance) throw new Error('DKLS not initialized')
    return await dklsInstance.startKeygenWithRetry()
  },
  startSchnorrKeygenWithRetry: async () => {
    if (!schnorrInstance) throw new Error('Schnorr not initialized')
    return await schnorrInstance.startKeygenWithRetry()
  }
})

// ContextBridge is used here to expose custom api objects on `window`
// to be accessible at `renderer` processes,
// even if `contextIsolation` is enabled
// https://www.electronjs.org/docs/api/context-bridge

/**
 * When exposing anything to the real world do not forget to
 * declare appropriate types for global Window interface
 * at the src/shared/api/types.ts
 */
//
// `apiKeystore` object
//
const apiKeystore: ApiKeystore = {
  // Note: `params` need to be encoded by `ipcKeystoreWalletsIO` before calling `saveKeystoreWallets` */
  saveKeystoreWallets: (params: unknown) => ipcRenderer.invoke(IPCMessages.SAVE_KEYSTORE_WALLETS, params),
  exportKeystore: (params: IPCExportKeystoreParams) => ipcRenderer.invoke(IPCMessages.EXPORT_KEYSTORE, params),
  load: () => ipcRenderer.invoke(IPCMessages.LOAD_KEYSTORE),
  initKeystoreWallets: () => ipcRenderer.invoke(IPCMessages.INIT_KEYSTORE_WALLETS)
}
contextBridge.exposeInMainWorld('apiKeystore', apiKeystore)

//
// `apiLang` object
//
contextBridge.exposeInMainWorld('apiLang', apiLang)

//
// `apiUrl` object
//
const apiUrl: ApiUrl = {
  openExternal: (url: string) => ipcRenderer.invoke(IPCMessages.OPEN_EXTERNAL_URL, url)
}

contextBridge.exposeInMainWorld('apiUrl', apiUrl)

//
// `apiHDWallet` object
//
contextBridge.exposeInMainWorld('apiHDWallet', apiHDWallet)

//
// api for storage objects
//
const getFileStoreApi = <FileName extends StoreFileName>(
  storeFileName: FileName
): ApiFileStoreService<StoreFileData<FileName>> => {
  const ipcMessages = getStoreFilesIPCMessages(storeFileName)
  return {
    save: (data) => ipcRenderer.invoke(ipcMessages.SAVE_FILE, data),
    remove: () => ipcRenderer.invoke(ipcMessages.REMOVE_FILE),
    get: () => ipcRenderer.invoke(ipcMessages.GET_FILE),
    exists: () => ipcRenderer.invoke(ipcMessages.FILE_EXIST)
  }
}
contextBridge.exposeInMainWorld('apiCommonStorage', getFileStoreApi('common'))
contextBridge.exposeInMainWorld('apiUserNodesStorage', getFileStoreApi('userNodes'))
contextBridge.exposeInMainWorld('apiUserBondProvidersStorage', getFileStoreApi('userBondProviders'))
contextBridge.exposeInMainWorld('apiChainStorage', getFileStoreApi('userChains'))
contextBridge.exposeInMainWorld('apiAddressStorage', getFileStoreApi('userAddresses'))
contextBridge.exposeInMainWorld('apiAssetStorage', getFileStoreApi('userAssets'))
contextBridge.exposeInMainWorld('apiPoolsStorage', getFileStoreApi('pools'))

//
// api for update
//
const apiAppUpdate = {
  checkForAppUpdates: (): Promise<AppUpdateRD> => ipcRenderer.invoke(IPCMessages.APP_CHECK_FOR_UPDATE)
}
contextBridge.exposeInMainWorld('apiAppUpdate', apiAppUpdate)
