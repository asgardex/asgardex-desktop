import { useCallback, useEffect } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ApiUrls } from '../../shared/api/types'
import { DEFAULT_ARB_RPC_URLS } from '../../shared/arb/const'
import { DEFAULT_AVAX_RPC_URLS } from '../../shared/avax/const'
import { DEFAULT_BASE_RPC_URLS } from '../../shared/base/const'
import { DEFAULT_BSC_RPC_URLS } from '../../shared/bsc/const'
import { DEFAULT_ETH_RPC_URLS } from '../../shared/ethereum/const'
import { LiveData } from '../helpers/rx/liveData'
import { ethRpc$, bscRpc$, arbRpc$, avaxRpc$, baseRpc$, modifyStorage } from '../services/storage/common'
import { useNetwork } from './useNetwork'

export type EvmChain = 'ETH' | 'BSC' | 'ARB' | 'AVAX' | 'BASE'

type EvmRpcUrlHook = {
  url: string
  setUrl: (url: string) => void
  checkUrl$: (url: string) => LiveData<Error, string>
}

const getObservableForChain = (chain: EvmChain): Rx.Observable<ApiUrls> => {
  switch (chain) {
    case 'ETH':
      return ethRpc$
    case 'BSC':
      return bscRpc$
    case 'ARB':
      return arbRpc$
    case 'AVAX':
      return avaxRpc$
    case 'BASE':
      return baseRpc$
  }
}

const getDefaultForChain = (chain: EvmChain): ApiUrls => {
  switch (chain) {
    case 'ETH':
      return DEFAULT_ETH_RPC_URLS
    case 'BSC':
      return DEFAULT_BSC_RPC_URLS
    case 'ARB':
      return DEFAULT_ARB_RPC_URLS
    case 'AVAX':
      return DEFAULT_AVAX_RPC_URLS
    case 'BASE':
      return DEFAULT_BASE_RPC_URLS
  }
}

const getStorageKeyForChain = (chain: EvmChain): string => {
  switch (chain) {
    case 'ETH':
      return 'ethRpc'
    case 'BSC':
      return 'bscRpc'
    case 'ARB':
      return 'arbRpc'
    case 'AVAX':
      return 'avaxRpc'
    case 'BASE':
      return 'baseRpc'
  }
}

export const useEvmRpcUrl = (chain: EvmChain): EvmRpcUrlHook => {
  const { network } = useNetwork()
  const intl = useIntl()

  const rpcUrls$ = getObservableForChain(chain)
  const defaultUrls = getDefaultForChain(chain)
  const storageKey = getStorageKeyForChain(chain)

  // Track current URLs for all networks (to preserve custom URLs when updating)
  const currentUrls = useObservableState(rpcUrls$, defaultUrls)

  const [rpcUrl, networkUpdated] = useObservableState<string, Network>(
    (network$) =>
      FP.pipe(
        Rx.combineLatest([rpcUrls$, network$]),
        RxOp.map(([urls, net]) => urls[net]),
        RxOp.shareReplay(1)
      ),
    defaultUrls[network]
  )

  // Update observable when network changes
  useEffect(() => networkUpdated(network), [network, networkUpdated])

  const setUrl = useCallback(
    (url: string) => {
      modifyStorage(
        O.some({
          [storageKey]: {
            ...currentUrls,
            [network]: url
          }
        })
      )
    },
    [network, storageKey, currentUrls]
  )

  const checkUrl$ = useCallback(
    (url: string): LiveData<Error, string> =>
      FP.pipe(
        Rx.from(
          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_blockNumber',
              params: [],
              id: 1
            })
          })
        ),
        RxOp.switchMap((response) => {
          if (!response.ok) {
            return Rx.of(RD.failure(Error(intl.formatMessage({ id: 'settings.evm.rpc.error.url' }))))
          }
          return Rx.from(response.json())
        }),
        RxOp.map((result) => {
          if (result && result.result && typeof result.result === 'string' && result.result.startsWith('0x')) {
            return RD.success(url)
          }
          return RD.failure(Error(intl.formatMessage({ id: 'settings.evm.rpc.error.url' })))
        }),
        RxOp.catchError((_: Error) =>
          Rx.of(RD.failure(Error(intl.formatMessage({ id: 'settings.evm.rpc.error.url' }))))
        ),
        RxOp.startWith(RD.pending)
      ),
    [intl]
  )

  return { url: rpcUrl, setUrl, checkUrl$ }
}
