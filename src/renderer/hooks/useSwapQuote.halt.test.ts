// useSwapQuote quote path, with the real halt hooks and real held / stall-checked streams:
// an unknown halt status alone must not drop THOR / MAYA from the quote request (the node quote decides),
// a halt proven by fresh mimir still does - also while lastblock failed or its height stalled.
import { act, createElement } from 'react'
import * as RD from '@devexperts/remote-data-ts'
import { assetFromStringEx, baseAmount, Chain } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import { createRoot } from 'react-dom/client'
import * as Rx from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSwapQuote } from './useSwapQuote'

const mocks = vi.hoisted(() => ({
  estimateSwap: vi.fn(),
  thor: {} as Record<string, unknown>,
  maya: {} as Record<string, unknown>,
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
vi.mock('../contexts/ThorchainContext', () => ({ useThorchainContext: () => mocks.thor }))
vi.mock('../contexts/MayachainContext', () => ({ useMayachainContext: () => mocks.maya }))
vi.mock('../services/storage/userChains', () => ({ userChains$: Rx.of(['BTC', 'ETH', 'THOR', 'MAYA']) }))

const MINUTE = 60 * 1000
const BTC = assetFromStringEx('BTC.BTC')
const ETH = assetFromStringEx('ETH.ETH')

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

type Lastblock = RD.RemoteData<Error, unknown>
const thorLastblock = (h: number): Lastblock => RD.success([{ chain: 'BTC', thorchain: h }])
const mayaLastblock = (h: number): Lastblock => RD.success([{ chain: 'BTC', mayachain: h }])
const lastblockDown: Lastblock = RD.failure(Error('lastblock down'))

/** Fresh service streams per test (the halt streams are shared per stream pair) */
const setStreams = ({
  thorMimir = RD.success({}),
  mayaMimir = RD.success({}),
  thorBlock = thorLastblock(100),
  mayaBlock = mayaLastblock(100),
  thorInbound = RD.success([]),
  mayaInbound = RD.success([])
}: {
  thorMimir?: RD.RemoteData<Error, Record<string, number>>
  mayaMimir?: RD.RemoteData<Error, Record<string, number>>
  thorBlock?: Lastblock
  mayaBlock?: Lastblock
  thorInbound?: RD.RemoteData<Error, Chain[]>
  mayaInbound?: RD.RemoteData<Error, Chain[]>
}) => {
  mocks.thor = {
    mimir$: new Rx.BehaviorSubject(thorMimir),
    thorchainLastblockState$: new Rx.BehaviorSubject(thorBlock)
  }
  mocks.maya = {
    mimir$: new Rx.BehaviorSubject(mayaMimir),
    mayachainLastblockState$: new Rx.BehaviorSubject(mayaBlock)
  }
  mocks.thorInbound$ = new Rx.BehaviorSubject(thorInbound)
  mocks.mayaInbound$ = new Rx.BehaviorSubject(mayaInbound)
}

describe('hooks/useSwapQuote: halt status and the quote request (real halt hooks)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.estimateSwap.mockReset()
    mocks.estimateSwap.mockResolvedValue([])
  })
  afterEach(() => vi.useRealTimers())

  it('mimir and inbound_addresses unknown (THOR and MAYA): both are still quoted', async () => {
    setStreams({
      thorMimir: RD.failure(Error('mimir down')),
      mayaMimir: RD.failure(Error('mimir down')),
      thorInbound: RD.failure(Error('inbound down')),
      mayaInbound: RD.pending
    })
    const { get, unmount } = renderQuoteHook()
    expect(get().quoteRefreshKey).toContain('Thorchain,Mayachain,Chainflip')
    expect(await quotedProtocols(get)).toEqual(['Thorchain', 'Mayachain', 'Chainflip'])
    unmount()
  })

  it('mimir without halts + lastblock down: both are still quoted (unknown alone does not block)', async () => {
    setStreams({ thorBlock: lastblockDown, mayaBlock: lastblockDown })
    const { get, unmount } = renderQuoteHook()
    expect(await quotedProtocols(get)).toEqual(['Thorchain', 'Mayachain', 'Chainflip'])
    unmount()
  })

  it.each([['HALTTRADING'], ['HALTBTCCHAIN'], ['HALTBTCTRADING'], ['HALTCHAINGLOBAL']])(
    'THOR mimir %s = 1 + lastblock Failure + inbound Success([]): THOR is not quoted',
    async (key) => {
      setStreams({ thorMimir: RD.success({ [key]: 1 }), thorBlock: lastblockDown })
      const { get, unmount } = renderQuoteHook()
      expect(await quotedProtocols(get)).toEqual(['Mayachain', 'Chainflip'])
      unmount()
    }
  )

  it.each([['HALTTRADING'], ['HALTETHCHAIN'], ['HALTBTCTRADING'], ['HALTCHAINGLOBAL']])(
    'MAYA mimir %s = 1 + lastblock Failure + inbound Success([]): MAYA is not quoted',
    async (key) => {
      setStreams({ mayaMimir: RD.success({ [key]: 1 }), mayaBlock: lastblockDown })
      const { get, unmount } = renderQuoteHook()
      expect(await quotedProtocols(get)).toEqual(['Thorchain', 'Chainflip'])
      unmount()
    }
  )

  it('THOR HALTTRADING = 1 + lastblock height stalled for 5 min: THOR is still not quoted', async () => {
    setStreams({ thorMimir: RD.success({ HALTTRADING: 1 }) })
    const { get, unmount } = renderQuoteHook()
    act(() => {
      vi.advanceTimersByTime(5 * MINUTE + 5000)
    })
    expect(await quotedProtocols(get)).toEqual(['Mayachain', 'Chainflip'])
    unmount()
  })

  it('a known halted chain in inbound_addresses next to an unknown mimir still drops that protocol', async () => {
    setStreams({ thorMimir: RD.failure(Error('mimir down')), thorInbound: RD.success(['ETH']) })
    const { get, unmount } = renderQuoteHook()
    expect(await quotedProtocols(get)).toEqual(['Mayachain', 'Chainflip'])
    unmount()
  })
})
