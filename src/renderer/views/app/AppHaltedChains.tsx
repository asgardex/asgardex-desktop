import { useState, useEffect, useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Chain } from '@xchainjs/xchain-util'
import { function as FP, array as A } from 'fp-ts'
import { useIntl } from 'react-intl'

import { chainToString, DEFAULT_ENABLED_CHAINS } from '../../../shared/utils/chain'
import { Alert } from '../../components/uielements/alert'
import { BorderButton } from '../../components/uielements/button'
import { unionChains } from '../../helpers/fp/array'
import { MimirHalt } from '../../services/thorchain/types'

type HaltedChainsWarningProps = {
  haltedChainsRD: RD.RemoteData<Error, Chain[]>
  mimirHaltRD: RD.RemoteData<Error, MimirHalt>
  protocol: Chain
  midgardStatusRD: RD.RemoteData<Error, boolean>
}

type HaltedChainsState = {
  chain: Chain
  haltedChain: boolean
  haltedTrading: boolean
  pausedLP: boolean
  pausedLPDeposit: boolean
}

const HaltedChainsWarning = ({ haltedChainsRD, mimirHaltRD, protocol, midgardStatusRD }: HaltedChainsWarningProps) => {
  const intl = useIntl()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [hasRendered, setHasRendered] = useState(false)

  // Small delay to prevent flashing on data updates
  const RENDER_DELAY_MS = 200
  useEffect(() => {
    const timer = setTimeout(() => setHasRendered(true), RENDER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  // Keep track of the last successful values to avoid flashing during refetch
  const lastSuccessfulMimirRef = useRef<MimirHalt>({
    HALTTHORCHAIN: false,
    haltGlobalTrading: false,
    pauseGlobalLp: false
  } as MimirHalt)

  const lastSuccessfulHaltedChainsRef = useRef<Chain[]>([])
  const lastSuccessfulMidgardRef = useRef<boolean>(false)

  // Memoize data extraction to prevent unnecessary re-calculations
  const { inboundHaltedChains, mimirHalt, midgard, hasAnyData } = useMemo(() => {
    const hasData = !RD.isInitial(haltedChainsRD) || !RD.isInitial(mimirHaltRD) || !RD.isInitial(midgardStatusRD)

    // Update refs with successful values and use them during pending states
    if (RD.isSuccess(haltedChainsRD)) {
      lastSuccessfulHaltedChainsRef.current = haltedChainsRD.value
    }
    if (RD.isSuccess(mimirHaltRD)) {
      lastSuccessfulMimirRef.current = mimirHaltRD.value
    }
    if (RD.isSuccess(midgardStatusRD)) {
      lastSuccessfulMidgardRef.current = midgardStatusRD.value
    }

    return {
      inboundHaltedChains:
        RD.isSuccess(haltedChainsRD) || RD.isPending(haltedChainsRD) ? lastSuccessfulHaltedChainsRef.current : [],
      mimirHalt:
        RD.isSuccess(mimirHaltRD) || RD.isPending(mimirHaltRD)
          ? lastSuccessfulMimirRef.current
          : ({
              HALTTHORCHAIN: false,
              haltGlobalTrading: false,
              pauseGlobalLp: false
            } as MimirHalt),
      midgard:
        RD.isSuccess(midgardStatusRD) || RD.isPending(midgardStatusRD) ? lastSuccessfulMidgardRef.current : false,
      hasAnyData: hasData
    }
  }, [haltedChainsRD, mimirHaltRD, midgardStatusRD])

  // Memoize warning message calculation to prevent flashing on lastblock updates
  const warningMessage = useMemo(() => {
    let msg = ''
    msg = mimirHalt.haltGlobalTrading ? intl.formatMessage({ id: 'halt.trading' }) : msg
    msg = mimirHalt.HALTTHORCHAIN ? intl.formatMessage({ id: 'halt.thorchain' }) : msg

    if (!mimirHalt.HALTTHORCHAIN && !mimirHalt.haltGlobalTrading) {
      const haltedChainsState: HaltedChainsState[] = Object.keys(DEFAULT_ENABLED_CHAINS).map((chain) => ({
        chain,
        haltedChain: mimirHalt[`HALT${chain}CHAIN`] || false,
        haltedTrading: mimirHalt[`HALT${chain}TRADING`] || false,
        pausedLP: mimirHalt[`PAUSELP${chain}`] || false,
        pausedLPDeposit: mimirHalt[`PAUSELPDEPOSIT-${chain}-${chain}`] || false
      }))

      const haltedChains = FP.pipe(
        haltedChainsState,
        A.filter(({ haltedChain }) => haltedChain),
        A.map(({ chain }) => chain),
        unionChains(inboundHaltedChains)
      )

      msg =
        haltedChains.length === 1
          ? `${msg} ${intl.formatMessage({ id: 'halt.chain' }, { chain: haltedChains[0], dex: protocol })}`
          : haltedChains.length > 1
          ? `${msg} ${intl.formatMessage(
              { id: 'halt.chains' },
              { chains: haltedChains.join(', '), protocol: protocol }
            )}`
          : msg

      const haltedTradingChains = haltedChainsState
        .filter(({ haltedTrading }) => haltedTrading)
        .map(({ chain }) => chain)
      msg =
        haltedTradingChains.length > 0
          ? `${msg} ${intl.formatMessage({ id: 'halt.chain.trading' }, { chains: haltedTradingChains.join(', ') })}`
          : msg

      const pausedLPs = haltedChainsState.filter(({ pausedLP }) => pausedLP).map(({ chain }) => chain)
      const pausedLPsDeposits = haltedChainsState
        .filter(({ pausedLPDeposit }) => pausedLPDeposit)
        .map(({ chain }) => chain)

      msg =
        pausedLPs.length > 0
          ? `${msg} ${intl.formatMessage({ id: 'halt.chain.pause' }, { chains: pausedLPs.join(', ') })}`
          : mimirHalt.PAUSELP
          ? `${msg} ${intl.formatMessage({ id: 'halt.chain.pauseall' })}`
          : pausedLPsDeposits.length > 0
          ? `${msg} ${intl.formatMessage(
              { id: 'halt.chain.pauseDeposits' },
              { chains: pausedLPsDeposits.join(', '), protocol: chainToString(protocol) }
            )}`
          : msg
    }

    // Append Midgard offline message if the endpoint is down
    msg = !midgard
      ? `${msg} ${intl.formatMessage({ id: 'midgard.status.offline' }, { protocol: protocol })}`.trim()
      : msg

    return msg.trim()
  }, [inboundHaltedChains, mimirHalt, midgard, intl, protocol])

  // Don't show warnings until we have actual data from at least one source
  if (!hasRendered || !hasAnyData) {
    return <div className="h-0" />
  }

  if (!warningMessage) {
    return <div className="h-0" />
  }

  if (isCollapsed) {
    // Just show the warning icon when collapsed
    return (
      <div
        className="inline-flex items-center justify-center w-8 h-8 bg-warning0/10 border border-warning0 rounded-lg cursor-pointer hover:bg-warning0/20"
        onClick={() => setIsCollapsed(false)}
        title={`${protocol} Warning - Click to expand`}>
        <ExclamationTriangleIcon className="w-6 h-6 text-warning0" />
      </div>
    )
  }

  return (
    <Alert
      key={`halted-warning-${protocol}`}
      type="warning"
      description={warningMessage}
      action={
        <BorderButton
          size="small"
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
          <XMarkIcon className="w-4 h-4" />
        </BorderButton>
      }
    />
  )
}

export default HaltedChainsWarning
