// useSwapQuote quote path: an unknown halt status alone must not drop THOR / MAYA from the quote request
// (the node quote decides), a known halt still does.
import { act, createElement } from 'react'
import * as RD from '@devexperts/remote-data-ts'
import { assetFromStringEx, baseAmount, Chain } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import { createRoot } from 'react-dom/client'
import * as Rx from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UNKNOWN_MIMIR_HALT as UNKNOWN_MIMIR_HALT_MAYA } from '../services/mayachain/const'
import { UNKNOWN_MIMIR_HALT as UNKNOWN_MIMIR_HALT_THOR } from '../services/thorchain/const'
import { getThorchainMimirHalt } from './useMimirHalt'
import { getMayachainMimirHalt } from './useMimirHaltMaya'
import { useSwapQuote } from './useSwapQuote'

const mocks = vi.hoisted(() => ({
  estimateSwap: vi.fn(),
  thorMimir: {} as unknown,
  mayaMimir: {} as unknown,
  thorInbound$: undefined as unknown,
  mayaInbound$: undefined as unknown
}))

vi.mock('../store/aggregator/hooks', () => ({
  useAggregator: () => ({
    estimateSwap: mocks.estimateSwap,
    protocols: ['Thorchain', 'Mayachain', 'Chainflip'],
    isBoostEnabled: false
  })
}))
vi.mock('../contexts/MayachainQueryContext', () => ({ useMayachainQueryContext: () => ({ mayachainQuery: {} }) }))
vi.mock('../contexts/ThorchainQueryContext', () => ({ useThorchainQueryContext: () => ({ thorchainQuery: {} }) }))
vi.mock('../contexts/OneClickContext', () => ({
  useOneClickContext: () => ({ isOneClickSupportedAsset: () => false })
}))
vi.mock('../contexts/ChainflipContext', () => ({
  useChainflipContext: () => ({ isChainflipSupportedAssetSync: () => false })
}))
vi.mock('../contexts/MidgardContext', () => ({
  useMidgardContext: () => ({ service: { pools: { haltedChains$: mocks.thorInbound$ } } })
}))
vi.mock('../contexts/MidgardMayaContext', () => ({
  useMidgardMayaContext: () => ({ service: { pools: { haltedChains$: mocks.mayaInbound$ } } })
}))
vi.mock('./useMimirHalt', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useThorchainMimirHalt: () => ({ mimirHalt: mocks.thorMimir })
}))
vi.mock('./useMimirHaltMaya', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useMayachainMimirHalt: () => ({ mimirHalt: mocks.mayaMimir })
}))

const BTC = assetFromStringEx('BTC.BTC')
const ETH = assetFromStringEx('ETH.ETH')
const failed = RD.failure(Error('inbound_addresses down')) as RD.RemoteData<Error, Chain[]>

const renderQuoteHook = () => {
  let result: ReturnType<typeof useSwapQuote> | undefined
  const Probe = () => {
    result = useSwapQuote({
      sourceAsset: BTC,
      targetAsset: ETH,
      sourceAssetDecimal: 8,
      sourceWalletAddress: 'bc1qsource',
      destinationAddress: '0xdestination',
      quoteOnly: true,
      streaming: { enabled: false, interval: 0, quantity: 0 },
      slipTolerance: 1,
      affiliateBps: O.some(false)
    })
    return null
  }
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const root = createRoot(document.createElement('div'))
  act(() => root.render(createElement(Probe)))
  return { get: () => result as NonNullable<typeof result>, unmount: () => act(() => root.unmount()) }
}

const quotedProtocols = async (get: () => ReturnType<typeof useSwapQuote>) => {
  await act(async () => {
    await get().fetchQuote(baseAmount(100000000, 8))
  })
  expect(mocks.estimateSwap).toHaveBeenCalledTimes(1)
  return mocks.estimateSwap.mock.calls[0][2] as string[]
}

describe('hooks/useSwapQuote: halt status and the quote request', () => {
  beforeEach(() => {
    mocks.estimateSwap.mockReset()
    mocks.estimateSwap.mockResolvedValue([])
  })
  afterEach(() => vi.restoreAllMocks())

  it('mimir and inbound_addresses unknown (THOR and MAYA): both are still quoted', async () => {
    mocks.thorMimir = UNKNOWN_MIMIR_HALT_THOR
    mocks.mayaMimir = UNKNOWN_MIMIR_HALT_MAYA
    mocks.thorInbound$ = Rx.of(failed)
    mocks.mayaInbound$ = Rx.of(RD.pending)
    const { get, unmount } = renderQuoteHook()
    expect(get().quoteRefreshKey).toContain('Thorchain,Mayachain,Chainflip')
    expect(await quotedProtocols(get)).toEqual(['Thorchain', 'Mayachain', 'Chainflip'])
    unmount()
  })

  it('a known THOR trading halt next to an unknown inbound list still drops THOR', async () => {
    mocks.thorMimir = getThorchainMimirHalt({ mimir: { HALTBTCTRADING: 1 }, lastHeight: 100, chains: ['BTC', 'ETH'] })
    mocks.mayaMimir = UNKNOWN_MIMIR_HALT_MAYA
    mocks.thorInbound$ = Rx.of(failed)
    mocks.mayaInbound$ = Rx.of(failed)
    const { get, unmount } = renderQuoteHook()
    expect(await quotedProtocols(get)).toEqual(['Mayachain', 'Chainflip'])
    unmount()
  })

  it('a known halted chain in inbound_addresses next to an unknown mimir still drops that protocol', async () => {
    mocks.thorMimir = UNKNOWN_MIMIR_HALT_THOR
    mocks.mayaMimir = getMayachainMimirHalt({ mimir: {}, lastHeight: 100, chains: ['BTC', 'ETH'] })
    mocks.thorInbound$ = Rx.of(RD.success(['ETH']))
    mocks.mayaInbound$ = Rx.of(RD.success([]))
    const { get, unmount } = renderQuoteHook()
    expect(await quotedProtocols(get)).toEqual(['Mayachain', 'Chainflip'])
    unmount()
  })
})
