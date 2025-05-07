import React, { useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Chain } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/function'
import * as A from 'fp-ts/lib/Array'
import * as O from 'fp-ts/Option'
import { useIntl } from 'react-intl'

import { chainToString, DEFAULT_ENABLED_CHAINS } from '../../../shared/utils/chain'
import { Alert } from '../../components/uielements/alert'
import { unionChains } from '../../helpers/fp/array'
import { rdAltOnPending } from '../../helpers/fpHelpers'
import { MimirHalt } from '../../services/thorchain/types'

type HaltedChainsWarningProps = {
  haltedChainsRD: RD.RemoteData<Error, Chain[]>
  mimirHaltRD: RD.RemoteData<Error, MimirHalt>
  protocol: Chain
}

type HaltedChainsState = {
  chain: Chain
  haltedChain: boolean
  haltedTrading: boolean
  pausedLP: boolean
  pausedLPDeposit: boolean
}

const HaltedChainsWarning = ({ haltedChainsRD, mimirHaltRD, protocol }: HaltedChainsWarningProps) => {
  const intl = useIntl()
  const prevHaltedChains = useRef<Chain[]>([])
  const prevMimirHalt = useRef<MimirHalt>({
    HALTTHORCHAIN: false,
    haltGlobalTrading: false,
    pauseGlobalLp: false
  })
  const renderWarning = FP.pipe(
    RD.combine(haltedChainsRD, mimirHaltRD),

    RD.map(([inboundHaltedChains, mimirHalt]) => {
      prevHaltedChains.current = inboundHaltedChains
      prevMimirHalt.current = mimirHalt
      return { inboundHaltedChains, mimirHalt }
    }),
    rdAltOnPending<Error, { inboundHaltedChains: Chain[]; mimirHalt: MimirHalt }>(() =>
      RD.success({
        inboundHaltedChains: prevHaltedChains.current,
        mimirHalt: prevMimirHalt.current
      })
    ),
    RD.toOption,
    O.map(({ inboundHaltedChains, mimirHalt }) => {
      let msg = ''
      msg = mimirHalt.haltGlobalTrading ? intl.formatMessage({ id: 'halt.trading' }) : msg
      msg = mimirHalt.HALTTHORCHAIN ? intl.formatMessage({ id: 'halt.thorchain' }) : msg

      if (!mimirHalt.HALTTHORCHAIN && !mimirHalt.haltGlobalTrading) {
        const haltedChainsState: HaltedChainsState[] = Object.keys(DEFAULT_ENABLED_CHAINS).map((chain) => {
          return {
            chain,
            haltedChain: mimirHalt[`HALT${chain}CHAIN`],
            haltedTrading: mimirHalt[`HALT${chain}TRADING`],
            pausedLP: mimirHalt[`PAUSELP${chain}`],
            pausedLPDeposit: mimirHalt[`PAUSELPDEPOSIT-${chain}-${chain}`]
          }
        })

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
            : `${msg}`

        const haltedTradingChains = haltedChainsState
          .filter(({ haltedTrading }) => haltedTrading)
          .map(({ chain }) => chain)
        msg =
          haltedTradingChains.length > 0
            ? `${msg} ${intl.formatMessage({ id: 'halt.chain.trading' }, { chains: haltedTradingChains.join(', ') })}`
            : `${msg}`

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
            : `${msg}`
      }
      return msg ? <Alert key={'halted warning'} type="warning" message={msg} /> : <></>
    }),
    O.getOrElse(() => <></>)
  )

  return <>{renderWarning}</>
}

export default HaltedChainsWarning
