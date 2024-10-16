import { useEffect } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { HealthApi } from '@xchainjs/xchain-mayanode'
import * as FP from 'fp-ts/lib/function'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as Rx from 'rxjs'
import * as RxAjax from 'rxjs/ajax'
import * as RxOp from 'rxjs/operators'

import { NodeUrl } from '../../shared/api/types'
import { useMayachainContext } from '../contexts/MayachainContext'
import { LiveData } from '../helpers/rx/liveData'
import { DEFAULT_CLIENT_URL } from '../services/mayachain/const'
import { getMayanodeAPIConfiguration } from '../services/mayachain/mayanode'
import { useNetwork } from './useNetwork'

export const useMayachainClientUrl = (): {
  rpc: string
  node: string
  setRpc: (url: string) => void
  setNode: (url: string) => void
  checkNode$: (url: string) => LiveData<Error, string>
  checkRpc$: (url: string) => LiveData<Error, string>
} => {
  const { clientUrl$, setMayanodeRpcUrl, setMayanodeApiUrl } = useMayachainContext()
  const { network } = useNetwork()
  const intl = useIntl()

  const [nodeUrl, networkUpdated] = useObservableState<NodeUrl, Network>(
    (network$) =>
      FP.pipe(
        Rx.combineLatest([clientUrl$, network$]),
        RxOp.map(([clientUrl, network]) => clientUrl[network]),
        RxOp.shareReplay(1)
      ),
    DEFAULT_CLIENT_URL[network]
  )

  // To update `useObservableState` properly
  // to push latest `network` into `nodeUrl`
  useEffect(() => networkUpdated(network), [network, networkUpdated])

  const setRpc = (url: string) => setMayanodeRpcUrl(url, network)
  const setNode = (url: string) => setMayanodeApiUrl(url, network)

  const checkNode$ = (url: string) =>
    FP.pipe(
      // Convert Promise to Observable
      Rx.from(new HealthApi(getMayanodeAPIConfiguration(url)).ping()),
      RxOp.map((result) => {
        const { ping } = result.data
        if (ping) return RD.success(url)

        return RD.failure(
          Error(intl.formatMessage({ id: 'setting.mayanode.node.error.unhealthy' }, { endpoint: '/ping' }))
        )
      }),
      RxOp.catchError((_: Error) =>
        Rx.of(RD.failure(Error(`${intl.formatMessage({ id: 'setting.mayanode.node.error.url' })}`)))
      )
    )

  const checkRpc$ = (url: string) =>
    FP.pipe(
      // Check `health` endpoint of MAYANode RPC API
      // https://docs.tendermint.com/v0.34/rpc/#/Info/health
      RxAjax.ajax(`${url}/health`),
      RxOp.map(({ response }) => {
        // Empty result object means no error
        if (response.result && typeof response.result === 'object' && Object.keys(response.result).length === 0)
          return RD.success(url)

        return RD.failure(
          Error(intl.formatMessage({ id: 'setting.mayanode.rpc.error.unhealthy' }, { endpoint: '/health' }))
        )
      }),

      RxOp.catchError((_: Error) =>
        Rx.of(RD.failure(Error(`${intl.formatMessage({ id: 'setting.mayanode.rpc.error.url' })}`)))
      )
    )

  return { rpc: nodeUrl.rpc, node: nodeUrl.node, setRpc, setNode, checkNode$, checkRpc$ }
}
