import { contextBridge, ipcRenderer } from 'electron'

import type { ApiMpc, CreationProgressData, DeviceJoinedData, SignProgressData } from '../shared/api/mpcTypes'
import { MpcIPCMessages } from '../shared/api/mpcTypes'
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
import { apiHDWallet } from './api/hdwallet'
import { apiLang } from './api/lang'
import IPCMessages from './ipc/messages'

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

//
// `apiMpc` object - Vultisig MPC wallet API
//
const apiMpc: ApiMpc = {
  // SDK Lifecycle
  init: () => ipcRenderer.invoke(MpcIPCMessages.MPC_INIT),
  dispose: () => ipcRenderer.invoke(MpcIPCMessages.MPC_DISPOSE),
  cancelKeygen: () => ipcRenderer.invoke(MpcIPCMessages.MPC_CANCEL_KEYGEN),

  // Vault Management
  listVaults: () => ipcRenderer.invoke(MpcIPCMessages.MPC_LIST_VAULTS),
  createFastVault: (params) => ipcRenderer.invoke(MpcIPCMessages.MPC_CREATE_FAST_VAULT, params),
  createSecureVault: (params) => ipcRenderer.invoke(MpcIPCMessages.MPC_CREATE_SECURE_VAULT, params),
  verifyVault: (vaultId, code) => ipcRenderer.invoke(MpcIPCMessages.MPC_VERIFY_VAULT, vaultId, code),
  deleteVault: (vaultId) => ipcRenderer.invoke(MpcIPCMessages.MPC_DELETE_VAULT, vaultId),
  renameVault: (vaultId, newName) => ipcRenderer.invoke(MpcIPCMessages.MPC_RENAME_VAULT, vaultId, newName),
  getAddresses: (vaultId) => ipcRenderer.invoke(MpcIPCMessages.MPC_GET_ADDRESSES, vaultId),
  getBalances: (vaultId) => ipcRenderer.invoke(MpcIPCMessages.MPC_GET_BALANCES, vaultId),

  // Vault Import/Export
  importVault: (vultContent, password) => ipcRenderer.invoke(MpcIPCMessages.MPC_IMPORT_VAULT, vultContent, password),
  exportVault: (vaultId, password) => ipcRenderer.invoke(MpcIPCMessages.MPC_EXPORT_VAULT, vaultId, password),
  openVaultFile: () => ipcRenderer.invoke(MpcIPCMessages.MPC_OPEN_VAULT_FILE),

  // Vault Lock/Unlock
  lockVault: (vaultId) => ipcRenderer.invoke(MpcIPCMessages.MPC_LOCK_VAULT, vaultId),
  unlockVault: (vaultId, password) => ipcRenderer.invoke(MpcIPCMessages.MPC_UNLOCK_VAULT, vaultId, password),

  // Transaction Signing
  signBytes: (params) => ipcRenderer.invoke(MpcIPCMessages.MPC_SIGN_BYTES, params),
  sendTransaction: (params) => ipcRenderer.invoke(MpcIPCMessages.MPC_SEND_TX, params),
  cancelSigning: (vaultId: string) => ipcRenderer.invoke(MpcIPCMessages.MPC_CANCEL_SIGNING, vaultId),

  // Event Listeners (return cleanup function)
  onCreationProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: CreationProgressData) => callback(data)
    ipcRenderer.on(MpcIPCMessages.MPC_CREATION_PROGRESS, handler)
    return () => ipcRenderer.removeListener(MpcIPCMessages.MPC_CREATION_PROGRESS, handler)
  },
  onQRCodeReady: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, qrPayload: string) => callback(qrPayload)
    ipcRenderer.on(MpcIPCMessages.MPC_SECURE_VAULT_QR_READY, handler)
    return () => ipcRenderer.removeListener(MpcIPCMessages.MPC_SECURE_VAULT_QR_READY, handler)
  },
  onDeviceJoined: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: DeviceJoinedData) => callback(data)
    ipcRenderer.on(MpcIPCMessages.MPC_DEVICE_JOINED, handler)
    return () => ipcRenderer.removeListener(MpcIPCMessages.MPC_DEVICE_JOINED, handler)
  },

  // Signing Event Listeners (return cleanup function)
  onSignQRReady: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, qrPayload: string) => callback(qrPayload)
    ipcRenderer.on(MpcIPCMessages.MPC_SIGN_QR_READY, handler)
    return () => ipcRenderer.removeListener(MpcIPCMessages.MPC_SIGN_QR_READY, handler)
  },
  onSignDeviceJoined: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: DeviceJoinedData) => callback(data)
    ipcRenderer.on(MpcIPCMessages.MPC_SIGN_DEVICE_JOINED, handler)
    return () => ipcRenderer.removeListener(MpcIPCMessages.MPC_SIGN_DEVICE_JOINED, handler)
  },
  onSignProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: SignProgressData) => callback(data)
    ipcRenderer.on(MpcIPCMessages.MPC_SIGN_PROGRESS, handler)
    return () => ipcRenderer.removeListener(MpcIPCMessages.MPC_SIGN_PROGRESS, handler)
  }
}
contextBridge.exposeInMainWorld('apiMpc', apiMpc)
