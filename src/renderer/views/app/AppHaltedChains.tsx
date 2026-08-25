import { useState, useEffect, useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import { function as FP, array as A, option as O } from 'fp-ts'
import { useIntl, IntlShape } from 'react-intl'
import { matchPath, useLocation } from 'react-router-dom'

import { chainToString, DEFAULT_ENABLED_CHAINS, isChainOfMaya, isChainOfThor } from '../../../shared/utils/chain'
import { NewsTicker } from '../../components/uielements/newsTicker'
import { getAssetFromNullableString } from '../../helpers/assetHelper'
import { unionChains } from '../../helpers/fp/array'
import * as poolsRoutes from '../../routes/pools'
import { MimirHalt } from '../../services/thorchain/types'

const CHAINFLIP_LABEL = 'Chainflip'

export type HaltedProtocol = {
  haltedChainsRD: RD.RemoteData<Error, Chain[]>
  mimirHaltRD: RD.RemoteData<Error, MimirHalt>
  protocol: Chain
  midgardStatusRD: RD.RemoteData<Error, boolean>
}

type HaltedChainsWarningProps = {
  protocols: HaltedProtocol[]
}

type HaltedChainsState = {
  chain: Chain
  haltedChain: boolean
  haltedTrading: boolean
  pausedLP: boolean
  pausedLPDeposit: boolean
}

export type PageContext = {
  isSwapPage: boolean
  isPoolPage: boolean
  isDepositPage: boolean
  // Chains the user is actively engaging with on the current page.
  // When undefined the page is not asset-scoped (e.g. pools list) and all halts surface.
  // When defined the alerts are filtered down to messages about these chains only.
  selectedChains?: Chain[]
}

type ResolvedProtocolData = {
  protocol: Chain
  inboundHaltedChains: Chain[]
  mimirHalt: MimirHalt
  midgard: boolean
}

const EMPTY_MIMIR: MimirHalt = {
  HALTTHORCHAIN: false,
  haltGlobalTrading: false,
  pauseGlobalLp: false
} as MimirHalt

const isProtocolGloballyHalted = ({ protocol, mimirHalt }: ResolvedProtocolData): boolean =>
  mimirHalt.haltGlobalTrading || (protocol === THORChain && mimirHalt.HALTTHORCHAIN)

// Reverse the asset-string transform the swap route applies (handles synth + raw form)
// so we can recover a Chain to filter halt messages against.
const chainFromRouteAssetString = (raw?: string): O.Option<Chain> => {
  if (!raw) return O.none
  const decoded = decodeURIComponent(raw).replace('_synth_', '/')
  return FP.pipe(
    getAssetFromNullableString(decoded),
    O.map((asset) => asset.chain)
  )
}

/**
 * Classify the current route for halt / Midgard banners.
 *
 * Swap lives under `/pools/swap/...`, so a naive `includes('/pools')` check would
 * treat Swap as a pool/LP page and surface liquidity-only warnings there.
 */
export const getHaltPageContext = (pathname: string): PageContext => {
  const isPoolDetailPage = pathname.includes('/pools/detail')
  const isSwapPage = pathname.includes('/swap')
  const isDepositPage = pathname.includes('/deposit') || pathname.includes('/liquidity')
  // Pool overview only — never Swap, deposit, or pool-detail trading.
  const isPoolPage = pathname.includes('/pools') && !isPoolDetailPage && !isSwapPage && !isDepositPage

  // Pull chains out of the URL where the page has a concrete asset selection
  // so alerts can be filtered to the swap pair / pool asset instead of dumping
  // every halt every time.
  let selectedChains: Chain[] | undefined
  if (isSwapPage) {
    const swapMatch = matchPath(poolsRoutes.swap.template, pathname)
    const params = swapMatch?.params as { source?: string; target?: string } | undefined
    const chains = FP.pipe(
      [chainFromRouteAssetString(params?.source), chainFromRouteAssetString(params?.target)],
      A.compact
    )
    selectedChains = chains.length > 0 ? Array.from(new Set(chains)) : undefined
  } else if (isDepositPage) {
    const depositMatch = matchPath(poolsRoutes.deposit.template, pathname)
    const params = depositMatch?.params as { asset?: string } | undefined
    const chain = FP.pipe(chainFromRouteAssetString(params?.asset), O.toNullable)
    selectedChains = chain ? [chain] : undefined
  }

  return { isSwapPage, isPoolPage, isDepositPage, selectedChains }
}

// A globally halted protocol is only relevant to the user if at least one of their
// selected chains actually routes through that protocol. e.g. a ZEC→DASH swap on
// MAYA shouldn't surface a THOR-halt banner since THOR has no role in that pair.
const isProtocolRelevant = (protocol: Chain, selectedChains?: Chain[]): boolean => {
  if (!selectedChains || selectedChains.length === 0) return true
  if (protocol === THORChain) return selectedChains.some(isChainOfThor)
  return selectedChains.some(isChainOfMaya)
}

const buildGlobalHaltMessage = (
  resolvedProtocols: ResolvedProtocolData[],
  selectedChains: Chain[] | undefined,
  intl: IntlShape
): string | undefined => {
  const halted = resolvedProtocols
    .filter(isProtocolGloballyHalted)
    .filter((p) => isProtocolRelevant(p.protocol, selectedChains))
  if (halted.length === 0) return undefined

  const haltedNames = halted.map((p) => p.protocol)
  const availableProtocolNames = resolvedProtocols.filter((p) => !isProtocolGloballyHalted(p)).map((p) => p.protocol)
  const alternativesList = intl.formatList([CHAINFLIP_LABEL, ...availableProtocolNames], { type: 'disjunction' })

  // Use the THORChain-specific message only if THORChain is the only halted protocol and the full-chain halt is set
  const onlyThorchainFullyHalted =
    halted.length === 1 && halted[0].protocol === THORChain && halted[0].mimirHalt.HALTTHORCHAIN
  if (onlyThorchainFullyHalted) {
    return intl.formatMessage({ id: 'halt.thorchain' }, { alternatives: alternativesList })
  }

  return intl.formatMessage(
    { id: 'halt.trading' },
    { protocols: intl.formatList(haltedNames, { type: 'conjunction' }), alternatives: alternativesList }
  )
}

const buildPerProtocolMessages = (
  { protocol, inboundHaltedChains, mimirHalt }: ResolvedProtocolData,
  { isSwapPage, isPoolPage, isDepositPage, selectedChains }: PageContext,
  intl: IntlShape
): string[] => {
  // Skip per-chain messages when the protocol is fully halted globally — covered by the global halt message
  if (isProtocolGloballyHalted({ protocol, inboundHaltedChains, mimirHalt, midgard: true })) return []

  const messages: string[] = []
  // When the page tells us which chains the user has selected, restrict messages
  // to those chains so the user only sees halts that affect their current swap/deposit.
  const isRelevant = (chain: Chain): boolean => !selectedChains || selectedChains.includes(chain)
  const haltedChainsState: HaltedChainsState[] = Object.keys(DEFAULT_ENABLED_CHAINS)
    .filter(isRelevant)
    .map((chain) => ({
      chain,
      haltedChain: mimirHalt[`HALT${chain}CHAIN`] || false,
      haltedTrading: mimirHalt[`HALT${chain}TRADING`] || false,
      pausedLP: mimirHalt[`PAUSELP${chain}`] || false,
      pausedLPDeposit: mimirHalt[`PAUSELPDEPOSIT-${chain}-${chain}`] || false
    }))

  // A full chain halt strictly implies a trading halt — keep these in one variable
  // so the trading-only message can exclude chains already mentioned in the broader
  // chain-halt message and avoid the redundant duplicate warning.
  const fullyHaltedChains = FP.pipe(
    haltedChainsState,
    A.filter(({ haltedChain }) => haltedChain),
    A.map(({ chain }) => chain),
    unionChains(inboundHaltedChains.filter(isRelevant))
  )

  if (isSwapPage || isPoolPage) {
    if (fullyHaltedChains.length === 1) {
      messages.push(intl.formatMessage({ id: 'halt.chain' }, { chain: fullyHaltedChains[0], dex: protocol }))
    } else if (fullyHaltedChains.length > 1) {
      messages.push(intl.formatMessage({ id: 'halt.chains' }, { chains: fullyHaltedChains.join(', '), protocol }))
    }
  }

  if (isSwapPage) {
    const haltedTradingChains = haltedChainsState
      .filter(({ haltedTrading }) => haltedTrading)
      .map(({ chain }) => chain)
      .filter((chain) => !fullyHaltedChains.includes(chain))
    if (haltedTradingChains.length > 0) {
      messages.push(intl.formatMessage({ id: 'halt.chain.trading' }, { chains: haltedTradingChains.join(', ') }))
    }
  }

  if (isPoolPage || isDepositPage) {
    const pausedLPs = haltedChainsState.filter(({ pausedLP }) => pausedLP).map(({ chain }) => chain)
    const pausedLPsDeposits = haltedChainsState
      .filter(({ pausedLPDeposit }) => pausedLPDeposit)
      .map(({ chain }) => chain)

    if (pausedLPs.length > 0) {
      messages.push(intl.formatMessage({ id: 'halt.chain.pause' }, { chains: pausedLPs.join(', ') }))
    } else if (mimirHalt.PAUSELP) {
      messages.push(intl.formatMessage({ id: 'halt.chain.pauseall' }))
    } else if (pausedLPsDeposits.length > 0) {
      messages.push(
        intl.formatMessage(
          { id: 'halt.chain.pauseDeposits' },
          { chains: pausedLPsDeposits.join(', '), protocol: chainToString(protocol) }
        )
      )
    }
  }

  return messages
}

const HaltedChainsWarning = ({ protocols }: HaltedChainsWarningProps) => {
  const intl = useIntl()
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [hasRendered, setHasRendered] = useState(false)

  const pageContext: PageContext = useMemo(() => getHaltPageContext(location.pathname), [location.pathname])

  const RENDER_DELAY_MS = 200
  useEffect(() => {
    const timer = setTimeout(() => setHasRendered(true), RENDER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  // Keep last successful values per protocol so refetch pending states don't clear warnings
  const lastSuccessRefs = useRef(
    new Map<Chain, { inboundHaltedChains: Chain[]; mimirHalt: MimirHalt; midgard: boolean }>()
  )

  const { resolvedProtocols, hasAnyData } = useMemo(() => {
    let hasData = false
    const resolved: ResolvedProtocolData[] = protocols.map(
      ({ protocol, haltedChainsRD, mimirHaltRD, midgardStatusRD }) => {
        if (!RD.isInitial(haltedChainsRD) || !RD.isInitial(mimirHaltRD) || !RD.isInitial(midgardStatusRD)) {
          hasData = true
        }

        const prev = lastSuccessRefs.current.get(protocol) ?? {
          inboundHaltedChains: [] as Chain[],
          mimirHalt: EMPTY_MIMIR,
          midgard: false
        }

        if (RD.isSuccess(haltedChainsRD)) prev.inboundHaltedChains = haltedChainsRD.value
        if (RD.isSuccess(mimirHaltRD)) prev.mimirHalt = mimirHaltRD.value
        if (RD.isSuccess(midgardStatusRD)) prev.midgard = midgardStatusRD.value
        lastSuccessRefs.current.set(protocol, prev)

        return {
          protocol,
          inboundHaltedChains:
            RD.isSuccess(haltedChainsRD) || RD.isPending(haltedChainsRD) ? prev.inboundHaltedChains : [],
          mimirHalt: RD.isSuccess(mimirHaltRD) || RD.isPending(mimirHaltRD) ? prev.mimirHalt : EMPTY_MIMIR,
          midgard: RD.isSuccess(midgardStatusRD) || RD.isPending(midgardStatusRD) ? prev.midgard : false
        }
      }
    )

    return { resolvedProtocols: resolved, hasAnyData: hasData }
  }, [protocols])

  const uniqueMessages = useMemo(() => {
    const seen = new Set<string>()
    const ordered: string[] = []
    const push = (msg: string) => {
      if (!seen.has(msg)) {
        seen.add(msg)
        ordered.push(msg)
      }
    }

    // One combined global-halt message (cross-protocol, with alternatives)
    if (pageContext.isSwapPage || pageContext.isPoolPage) {
      const globalMsg = buildGlobalHaltMessage(resolvedProtocols, pageContext.selectedChains, intl)
      if (globalMsg) push(globalMsg)
    }

    // Per-protocol chain/trading/LP messages (skipped for protocols already covered globally)
    for (const data of resolvedProtocols) {
      for (const msg of buildPerProtocolMessages(data, pageContext, intl)) push(msg)
    }

    // Midgard offline (per-protocol — protocol name is embedded so no dedup collision).
    // LP shares / add-liquidity depend on Midgard; Swap quotes still work via aggregator
    // fallbacks, so do not surface this on the Swap screen.
    // Filter to the protocol that actually serves one of the selected chains so a Maya
    // outage doesn't pop up while the user is depositing on a THOR-only pool (and vice versa).
    if (pageContext.isDepositPage || pageContext.isPoolPage) {
      for (const { protocol, midgard } of resolvedProtocols) {
        if (!midgard && isProtocolRelevant(protocol, pageContext.selectedChains)) {
          push(intl.formatMessage({ id: 'midgard.status.offline' }, { protocol }))
        }
      }
    }

    return ordered
  }, [resolvedProtocols, pageContext, intl])

  if (!hasRendered || !hasAnyData || uniqueMessages.length === 0) {
    return <div className="h-0" />
  }

  if (isCollapsed) {
    return (
      <div
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-warning0 bg-warning0/10 hover:bg-warning0/20"
        onClick={() => setIsCollapsed(false)}
        title="Warning - Click to expand">
        <ExclamationTriangleIcon className="h-6 w-6 text-warning0" />
      </div>
    )
  }

  return <NewsTicker messages={uniqueMessages} onDismiss={() => setIsCollapsed(true)} badgeLabel="NETWORK" />
}

export default HaltedChainsWarning
