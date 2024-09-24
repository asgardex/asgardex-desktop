import React, { useMemo, useState, useEffect } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'
import { Button } from 'antd'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { useDex } from '../../hooks/useDex'
import { PoolsState as PoolStateMaya } from '../../services/mayaMigard/types'
import { PoolsState } from '../../services/midgard/types'

const wasmPath = './wasm/main.wasm' // Assuming main.wasm is placed in the public/wasm directory

export const PlaygroundView: React.FC = (): JSX.Element => {
  const [wasmResult, setWasmResult] = useState<string | null>(null)
  const intl = useIntl()
  const { dex } = useDex()

  const { service: midgardService } = useMidgardContext()
  const { service: midgardMayaService } = useMidgardMayaContext()

  const poolState = useObservableState(
    dex.chain === THORChain ? midgardService.pools.poolsState$ : midgardMayaService.pools.poolsState$,
    RD.initial
  )

  // Load and initialize WASM module
  useEffect(() => {
    async function loadWasm() {
      try {
        // Load wasm_exec.js
        const script = document.createElement('script')
        script.src = '/wasm/wasm_exec.js' // Path to your wasm_exec.js
        script.onload = async () => {
          if (typeof (window as any).Go === 'undefined') {
            console.error('Go runtime not loaded')
            setWasmResult('Error: Go runtime not loaded')
            return
          }

          const go = new (window as any).Go() // Initialize Go runtime

          // Fetch and instantiate the WebAssembly module
          const response = await fetch(wasmPath)
          const wasmModule = await WebAssembly.instantiateStreaming(response, go.importObject)
          go.run(wasmModule.instance)
          setWasmResult('WASM Loaded Successfully') // Indicate success
        }
        document.body.appendChild(script)
      } catch (error) {
        console.error('Failed to load WASM module', error)
        setWasmResult('Error loading WASM module')
      }
    }

    loadWasm()
  }, [])

  const renderPools = useMemo(
    () =>
      RD.fold(
        // initial state
        () => <div />,
        // loading state
        () => <h3>Loading...</h3>,
        // error state
        (error: Error) => <h3>`Loading of pool data failed ${error?.message ?? ''}`</h3>,
        // success state
        (s: PoolsState | PoolStateMaya): JSX.Element => {
          const hasPools = s.poolAssets.length > 0
          return (
            <>
              {!hasPools && <h3>No pools available.</h3>}
              {hasPools && (
                <ul>
                  {s.poolAssets.map((pool: AnyAsset, index: number) => (
                    <li key={index}>{assetToString(pool)}</li>
                  ))}
                </ul>
              )}
            </>
          )
        }
      )(poolState),
    [poolState]
  )

  return (
    <>
      <h1>Playground</h1>
      <h1>i18n</h1>
      <h2>{intl.formatMessage({ id: 'common.greeting' }, { name: 'ASGARDEX' })}</h2>
      <h1>WASM Module</h1>
      <h2>WASM Result: {wasmResult}</h2> {/* Display the result from the WASM module */}
      <h1>Pools</h1>
      <h2>Raw data: {JSON.stringify(poolState)}</h2>
      {renderPools}
      <Button
        onClick={() => {
          midgardService.pools.reloadPools()
          midgardMayaService.pools.reloadPools()
        }}>
        Reload pools
      </Button>
    </>
  )
}
