import React, { useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Chain } from '@xchainjs/xchain-util'
import { function as FP, array as A, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { chainToString, DEFAULT_ENABLED_CHAINS } from '../../../shared/utils/chain'
import { Alert } from '../../components/uielements/alert'
import { unionChains } from '../../helpers/fp/array'
import { OnlineStatus } from '../../services/app/types'
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
  const prevHaltedChains = useRef<Chain[]>([])
  const prevMimirHalt = useRef<MimirHalt>({
    HALTTHORCHAIN: false,
    haltGlobalTrading: false,
    pauseGlobalLp: false
  })

  const prevMidgardStatus = useRef<OnlineStatus>(OnlineStatus.OFF)

  const renderWarning = FP.pipe(
    RD.combine(haltedChainsRD, mimirHaltRD, midgardStatusRD),
    RD.map(([inboundHaltedChains, mimirHalt, midgard]) => {
      prevHaltedChains.current = inboundHaltedChains
      prevMimirHalt.current = mimirHalt
      prevMidgardStatus.current = midgard ? OnlineStatus.ON : OnlineStatus.OFF
      return { inboundHaltedChains, mimirHalt, midgard }
    }),
    RD.fold(
      () =>
        RD.success({
          inboundHaltedChains: prevHaltedChains.current,
          mimirHalt: prevMimirHalt.current,
          midgard: prevMidgardStatus.current === OnlineStatus.ON
        }),
      () =>
        RD.success({
          inboundHaltedChains: prevHaltedChains.current,
          mimirHalt: prevMimirHalt.current,
          midgard: prevMidgardStatus.current === OnlineStatus.ON
        }),
      () =>
        RD.success({ inboundHaltedChains: prevHaltedChains.current, mimirHalt: prevMimirHalt.current, midgard: false }),
      (data) => RD.success(data)
    ),
    RD.toOption,
    O.map(({ inboundHaltedChains, mimirHalt, midgard }) => {
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

      return msg ? <Alert key={`halted-warning-${protocol}`} type="warning" description={msg} /> : <></>
    }),
    O.getOrElse(() => <></>)
  )

  return renderWarning
}

export default HaltedChainsWarning
