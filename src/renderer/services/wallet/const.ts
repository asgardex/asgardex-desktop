import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BASEChain } from '@xchainjs/xchain-base'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { ADAChain } from '@xchainjs/xchain-cardano'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { KUJIChain } from '@xchainjs/xchain-kujira'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { RadixChain } from '@xchainjs/xchain-radix'
import { XRPChain } from '@xchainjs/xchain-ripple'
import { SOLChain } from '@xchainjs/xchain-solana'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { TRONChain } from '@xchainjs/xchain-tron'
import { ZECChain } from '@xchainjs/xchain-zcash'
import { option as O } from 'fp-ts'

import { LoadTxsParams } from '../clients'
import { MAX_ITEMS_PER_PAGE } from '../const'
import { BalancesState, BalancesStateFilter, KeystoreState, LedgerAddresses, LoadTxsHandler } from './types'

/**
 * Initial KeystoreState
 * Note: It needs to be empty (O.none)
 */
export const INITIAL_KEYSTORE_STATE: KeystoreState = O.none

export const INITIAL_BALANCES_STATE: BalancesState = {
  balances: O.none,
  errors: O.none,
  loading: false
}

export const DEFAULT_BALANCES_FILTER: BalancesStateFilter = {
  [BCHChain]: 'all',
  [DASHChain]: 'all',
  [BTCChain]: 'all',
  [GAIAChain]: 'all',
  [DOGEChain]: 'all',
  [ETHChain]: 'all',
  [ARBChain]: 'all',
  [AVAXChain]: 'all',
  [BSCChain]: 'all',
  [LTCChain]: 'all',
  [THORChain]: 'all',
  [MAYAChain]: 'all',
  [KUJIChain]: 'all',
  [RadixChain]: 'all',
  [SOLChain]: 'all',
  [TRONChain]: 'all',
  [BASEChain]: 'all',
  [ADAChain]: 'all',
  [ZECChain]: 'all',
  [XRPChain]: 'all'
}

export const INITIAL_LOAD_TXS_PROPS: LoadTxsParams = {
  limit: MAX_ITEMS_PER_PAGE,
  offset: 0
}

export const EMPTY_LOAD_TXS_HANDLER: LoadTxsHandler = (_: LoadTxsParams) => {}

export const INITIAL_LEDGER_ADDRESSES: LedgerAddresses = [] // empty by default

export const MAX_WALLET_NAME_CHARS = 20
