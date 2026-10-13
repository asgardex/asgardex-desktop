import type Transport from '@ledgerhq/hw-transport'
import { TxHash } from '@xchainjs/xchain-client'
import { Chain } from '@xchainjs/xchain-util'
import { either as E } from 'fp-ts'

import { IPCLedgerDepositTxParams, IPCLedgerSendTxParams } from '../../../shared/api/io'
import { GasMultiplier, LedgerError, LedgerErrorId } from '../../../shared/api/types'
import { chainToString, isSupportedChain } from '../../../shared/utils/chain'
import {
  ARBChain,
  AVAXChain,
  BASEChain,
  BCHChain,
  BSCChain,
  BTCChain,
  DASHChain,
  DOGEChain,
  ETHChain,
  GAIAChain,
  LTCChain,
  MAYAChain,
  RadixChain,
  SOLChain,
  THORChain,
  TRONChain,
  XRPChain,
  ZECChain
} from '../../../shared/utils/chainIds'
import { isError, isEvmHDMode, isUtxoHDMode } from '../../../shared/utils/guard'

const TransportNodeHidSingleton = require('@ledgerhq/hw-transport-node-hid-singleton')

const evmChainSend = async (
  params: IPCLedgerSendTxParams & { transport: Transport }
): Promise<E.Either<LedgerError, TxHash>> => {
  const [{ EVM_LEDGER_CHAINS }, { evmSend }] = await Promise.all([import('./evm/common'), import('./evm/transaction')])
  const config = EVM_LEDGER_CHAINS[params.chain]
  if (!config) {
    return E.left({ errorId: LedgerErrorId.NOT_IMPLEMENTED, msg: `${params.chain} is not a supported EVM chain` })
  }
  if (!params.asset) {
    return E.left({
      errorId: LedgerErrorId.INVALID_DATA,
      msg: `Asset needs to be defined to send Ledger transaction on ${chainToString(params.chain)}`
    })
  }
  if (!params.feeOption) {
    return E.left({
      errorId: LedgerErrorId.INVALID_DATA,
      msg: `Fee option needs to be set to send Ledger transaction on ${chainToString(params.chain)}`
    })
  }
  if (!isEvmHDMode(params.hdMode)) {
    return E.left({
      errorId: LedgerErrorId.INVALID_DATA,
      msg: `Invalid EvmHDMode set - needed to send Ledger transaction on ${chainToString(params.chain)}`
    })
  }
  if (config.chain === ETHChain && !params.apiKey) {
    return E.left({
      errorId: LedgerErrorId.INVALID_DATA,
      msg: `API key is required for ${chainToString(ETHChain)} Ledger transactions`
    })
  }
  return evmSend({
    config,
    ...params,
    asset: params.asset,
    feeOption: params.feeOption,
    evmHDMode: params.hdMode,
    apiKey: params.apiKey,
    evmRpcUrl: params.evmRpcUrl,
    gasMultiplier: (params.gasMultiplier ?? 1) as GasMultiplier
  })
}

const evmChainDeposit = async (
  params: IPCLedgerDepositTxParams & { transport: Transport }
): Promise<E.Either<LedgerError, TxHash>> => {
  const [{ EVM_LEDGER_CHAINS }, { evmDeposit }] = await Promise.all([
    import('./evm/common'),
    import('./evm/transaction')
  ])
  const config = EVM_LEDGER_CHAINS[params.chain]
  if (!config) {
    return E.left({ errorId: LedgerErrorId.NOT_IMPLEMENTED, msg: `${params.chain} is not a supported EVM chain` })
  }
  if (!params.router) {
    return E.left({
      errorId: LedgerErrorId.INVALID_DATA,
      msg: `Router address needs to be defined to send Ledger transaction on ${chainToString(params.chain)}`
    })
  }
  if (!params.asset) {
    return E.left({
      errorId: LedgerErrorId.INVALID_DATA,
      msg: `Asset needs to be defined to send Ledger transaction on ${chainToString(params.chain)}`
    })
  }
  if (!params.recipient) {
    return E.left({
      errorId: LedgerErrorId.INVALID_DATA,
      msg: `Recipient needs to be defined to send Ledger transaction on ${chainToString(params.chain)}`
    })
  }
  if (!params.feeOption) {
    return E.left({
      errorId: LedgerErrorId.INVALID_DATA,
      msg: `Fee option needs to be defined to send Ledger transaction on ${chainToString(params.chain)}`
    })
  }
  if (!isEvmHDMode(params.hdMode)) {
    return E.left({
      errorId: LedgerErrorId.INVALID_DATA,
      msg: `Invalid EvmHDMode set - needed to send Ledger transaction on ${chainToString(params.chain)}`
    })
  }
  if (config.chain === ETHChain && !params.apiKey) {
    return E.left({
      errorId: LedgerErrorId.INVALID_DATA,
      msg: `API key is required for ${chainToString(ETHChain)} Ledger transactions`
    })
  }
  return evmDeposit({
    config,
    asset: params.asset,
    router: params.router,
    transport: params.transport,
    network: params.network,
    amount: params.amount,
    memo: params.memo,
    walletAccount: params.walletAccount,
    walletIndex: params.walletIndex,
    recipient: params.recipient,
    feeOption: params.feeOption,
    evmHDMode: params.hdMode,
    apiKey: params.apiKey,
    evmRpcUrl: params.evmRpcUrl,
    gasMultiplier: (params.gasMultiplier ?? 1) as GasMultiplier
  })
}

const chainSendFunctions: Record<
  Chain,
  (params: IPCLedgerSendTxParams & { transport: Transport }) => Promise<E.Either<LedgerError, TxHash>>
> = {
  [THORChain]: async ({ transport, network, asset, recipient, amount, memo, walletAccount, walletIndex }) => {
    if (!asset) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `"nodeUrl" needs to be defined to send Ledger transaction on ${chainToString(THORChain)}`
      })
    }
    const THOR = await import('./thorchain/transaction')
    return THOR.send({ transport, network, asset, recipient, amount, memo, walletAccount, walletIndex })
  },
  [MAYAChain]: async ({ transport, network, asset, recipient, amount, memo, walletAccount, walletIndex }) => {
    if (!asset) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `"nodeUrl" needs to be defined to send Ledger transaction on ${chainToString(MAYAChain)}`
      })
    }
    const MAYA = await import('./mayachain/transaction')
    return MAYA.send({ transport, network, asset, recipient, amount, memo, walletAccount, walletIndex })
  },
  [BTCChain]: async (params) => {
    if (params.apiKey === undefined) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `${chainToString(params.asset.chain)} needs an api key`
      })
    }
    if (!params.feeOption) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Fee option needs to be set to send Ledger transaction on ${chainToString(params.asset.chain)}`
      })
    }
    // Check if hdMode is valid for Bitcoin (optional for backward compatibility)
    if (params.hdMode && !isUtxoHDMode(params.hdMode) && params.hdMode !== 'default') {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Invalid UtxoHDMode set for Bitcoin transaction: ${params.hdMode}`
      })
    }
    const BTC = await import('./bitcoin/transaction')
    return BTC.send({ ...params, feeOption: params.feeOption, hdMode: params.hdMode, apiKey: params.apiKey })
  },
  [LTCChain]: async (params) => {
    if (!params.feeOption) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Fee option needs to be set to send Ledger transaction on ${chainToString(params.asset.chain)}`
      })
    }
    if (params.apiKey === undefined) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `${chainToString(params.asset.chain)} needs an api key`
      })
    }
    const LTC = await import('./litecoin/transaction')
    return LTC.send({ ...params, feeOption: params.feeOption, apiKey: params.apiKey })
  },
  [BCHChain]: async (params) => {
    if (!params.feeOption) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Fee option needs to be set to send Ledger transaction on ${chainToString(params.asset.chain)}`
      })
    }
    const BCH = await import('./bitcoincash/transaction')
    return BCH.send({ ...params, feeOption: params.feeOption })
  },
  [DOGEChain]: async (params) => {
    if (params.apiKey === undefined) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `${chainToString(params.asset.chain)} needs an api key`
      })
    }
    const DOGE = await import('./doge/transaction')
    return DOGE.send({ ...params, apiKey: params.apiKey })
  },
  [DASHChain]: async (params) => {
    if (params.apiKey === undefined) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `${chainToString(params.asset.chain)} needs an api key`
      })
    }
    const DASH = await import('./dash/transaction')
    return DASH.send({ ...params, apiKey: params.apiKey })
  },
  [ETHChain]: evmChainSend,
  [AVAXChain]: evmChainSend,
  [BASEChain]: evmChainSend,
  [BSCChain]: evmChainSend,
  [ARBChain]: evmChainSend,
  [GAIAChain]: async (params) => {
    if (!params.asset) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Asset needs to be defined to send Ledger transaction on ${chainToString(GAIAChain)}`
      })
    }
    if (!params.feeAmount) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Fee amount needs to be defined to send Ledger transaction on ${chainToString(GAIAChain)}`
      })
    }
    const COSMOS = await import('./cosmos/transaction')
    return COSMOS.send(params)
  },
  [XRPChain]: async (params) => {
    if (!params.asset) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Asset needs to be defined to send Ledger transaction on ${chainToString(XRPChain)}`
      })
    }
    const XRP = await import('./ripple/transaction')
    return XRP.send({
      transport: params.transport,
      network: params.network,
      amount: params.amount,
      asset: params.asset,
      recipient: params.recipient,
      memo: params.memo,
      walletAccount: params.walletAccount,
      walletIndex: params.walletIndex,
      destinationTag: params.destinationTag
    })
  },
  [SOLChain]: async ({ transport, network, asset, recipient, amount, memo, walletAccount, walletIndex }) => {
    if (!asset) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Asset needs to be defined to send Ledger transaction on ${chainToString(SOLChain)}`
      })
    }
    const SOL = await import('./solana/transaction')
    return SOL.send({ transport, network, asset, recipient, amount, memo, walletAccount, walletIndex })
  },
  [TRONChain]: async (params) => {
    if (!params.asset) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `Asset needs to be defined to send Ledger transaction on ${chainToString(TRONChain)}`
      })
    }
    const TRON = await import('./tron/transaction')
    return TRON.send({ ...params, walletAccount: params.walletAccount })
  }
}

const unsupportedChains: Chain[] = [RadixChain, ZECChain, 'ADA']

export const sendTx = async ({
  chain,
  network,
  sender,
  recipient,
  amount,
  asset,
  feeAmount,
  memo,
  feeRate,
  feeOption,
  walletAccount,
  walletIndex,
  nodeUrl,
  hdMode,
  apiKey,
  destinationTag,
  evmRpcUrl,
  gasMultiplier,
  sendMax,
  selectedUtxos,
  utxoSelectionPreferences
}: IPCLedgerSendTxParams): Promise<E.Either<LedgerError, TxHash>> => {
  if (!isSupportedChain(chain) || unsupportedChains.includes(chain)) {
    return E.left({
      errorId: LedgerErrorId.NOT_IMPLEMENTED,
      msg: `${chain} is not supported or enabled for 'sendTx'`
    })
  }

  const sendFunction = chainSendFunctions[chain]
  if (!sendFunction) {
    return E.left({
      errorId: LedgerErrorId.NOT_IMPLEMENTED,
      msg: `${chain} is not supported for 'sendTx'`
    })
  }

  let transport: Transport | undefined
  try {
    const opened: Transport = await TransportNodeHidSingleton.default.create()
    transport = opened
    return await sendFunction({
      transport: opened,
      chain,
      network,
      sender,
      recipient,
      amount,
      asset,
      feeAmount,
      memo,
      feeRate,
      feeOption,
      walletAccount,
      walletIndex,
      nodeUrl,
      hdMode,
      feeAsset: undefined,
      apiKey,
      destinationTag,
      evmRpcUrl,
      gasMultiplier,
      sendMax,
      selectedUtxos,
      utxoSelectionPreferences
    })
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.SEND_TX_FAILED,
      msg: isError(error) ? (error?.message ?? error.toString()) : `${error}`
    })
  } finally {
    if (transport) {
      try {
        await transport.close()
      } catch {
        // A failed chunk import or send must not leave the HID handle open.
      }
    }
  }
}

const chainDepositFunctions: Record<
  Chain,
  (params: IPCLedgerDepositTxParams & { transport: Transport }) => Promise<E.Either<LedgerError, TxHash>>
> = {
  [THORChain]: async ({ transport, network, asset, amount, memo, walletAccount, walletIndex, nodeUrl }) => {
    if (!nodeUrl) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `"nodeUrl" needs to be defined to send Ledger transaction on ${chainToString(THORChain)}`
      })
    }
    const THOR = await import('./thorchain/transaction')
    return THOR.deposit({ transport, network, amount, asset, memo, walletAccount, walletIndex })
  },
  [MAYAChain]: async ({ transport, network, asset, amount, memo, walletAccount, walletIndex, nodeUrl }) => {
    if (!nodeUrl) {
      return E.left({
        errorId: LedgerErrorId.INVALID_DATA,
        msg: `"nodeUrl" needs to be defined to send Ledger transaction on ${chainToString(MAYAChain)}`
      })
    }
    const MAYA = await import('./mayachain/transaction')
    return MAYA.deposit({ transport, network, amount, asset, memo, walletAccount, walletIndex })
  },
  [ETHChain]: evmChainDeposit,
  [AVAXChain]: evmChainDeposit,
  [BSCChain]: evmChainDeposit,
  [BASEChain]: evmChainDeposit,
  [ARBChain]: evmChainDeposit
}

export const deposit = async ({
  chain,
  network,
  asset,
  router,
  recipient,
  amount,
  memo,
  walletAccount,
  walletIndex,
  feeOption,
  nodeUrl,
  hdMode,
  apiKey,
  evmRpcUrl,
  gasMultiplier
}: IPCLedgerDepositTxParams): Promise<E.Either<LedgerError, TxHash>> => {
  if (!isSupportedChain(chain) || unsupportedChains.includes(chain)) {
    return E.left({
      errorId: LedgerErrorId.NOT_IMPLEMENTED,
      msg: `${chain} is not supported or enabled for 'deposit'`
    })
  }

  const depositFunction = chainDepositFunctions[chain]
  if (!depositFunction) {
    return E.left({
      errorId: LedgerErrorId.NOT_IMPLEMENTED,
      msg: `${chain} is not supported for 'deposit'`
    })
  }

  let transport: Transport | undefined
  try {
    const opened: Transport = await TransportNodeHidSingleton.default.create()
    transport = opened
    return await depositFunction({
      transport: opened,
      chain,
      network,
      asset,
      router,
      recipient,
      amount,
      memo,
      walletAccount,
      walletIndex,
      feeOption,
      nodeUrl,
      hdMode,
      apiKey,
      evmRpcUrl,
      gasMultiplier
    })
  } catch (error) {
    return E.left({
      errorId: LedgerErrorId.DEPOSIT_TX_FAILED,
      msg: isError(error) ? (error?.message ?? error.toString()) : `${error}`
    })
  } finally {
    if (transport) {
      try {
        await transport.close()
      } catch {
        // A failed chunk import or deposit must not leave the HID handle open.
      }
    }
  }
}
