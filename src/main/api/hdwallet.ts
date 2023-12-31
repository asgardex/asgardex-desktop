import { ipcRenderer } from 'electron'

import { IPCLedgerAddressesIO } from '../../shared/api/io'
import { IPCLedgerAdddressParams } from '../../shared/api/types'
import { ApiHDWallet } from '../../shared/api/types'
import IPCMessages from '../ipc/messages'

export const apiHDWallet: ApiHDWallet = {
  getLedgerAddress: (params: IPCLedgerAdddressParams) => ipcRenderer.invoke(IPCMessages.GET_LEDGER_ADDRESS, params),
  verifyLedgerAddress: (params: IPCLedgerAdddressParams) =>
    ipcRenderer.invoke(IPCMessages.VERIFY_LEDGER_ADDRESS, params),
  // Note: `params` need to be encoded by `ipcLedgerSendTxParamsIO` before calling `sendLedgerTx` */
  sendLedgerTx: (params: unknown) => ipcRenderer.invoke(IPCMessages.SEND_LEDGER_TX, params),
  // Note: `params` need to be encoded by `ipcLedgerDepositTxParams` before calling `depositLedgerTx` */
  depositLedgerTx: (params: unknown) => ipcRenderer.invoke(IPCMessages.DEPOSIT_LEDGER_TX, params),
  // Note: `params` need to be encoded by `ipcLedgerApproveERC20TokenParamsIO` before calling `approveLedgerERC20Token` */
  approveLedgerERC20Token: (params: unknown) => ipcRenderer.invoke(IPCMessages.APPROVE_LEDGER_ERC20_TOKEN, params),
  saveLedgerAddresses: (params: IPCLedgerAddressesIO) => ipcRenderer.invoke(IPCMessages.SAVE_LEDGER_ADDRESSES, params),
  getLedgerAddresses: () => ipcRenderer.invoke(IPCMessages.GET_LEDGER_ADDRESSES)
}
