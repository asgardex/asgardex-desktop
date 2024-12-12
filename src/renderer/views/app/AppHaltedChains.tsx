import React, { useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Chain } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/function'
import * as A from 'fp-ts/lib/Array'
import * as O from 'fp-ts/Option'
import { useIntl } from 'react-intl'

import { DEFAULT_ENABLED_CHAINS } from '../../../shared/utils/chain'
import { unionChains } from '../../helpers/fp/array'
import { rdAltOnPending } from '../../helpers/fpHelpers'
import { MimirHalt } from '../../services/thorchain/types'
import * as Styled from './AppView.styles'

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
}

const HaltedChainsWarning = ({ haltedChainsRD, mimirHaltRD, protocol }: HaltedChainsWarningProps) => {
  const intl = useIntl()
  const prevHaltedChains = useRef<Chain[]>([])
  const prevMimirHalt = useRef<MimirHalt>({
    haltTrading: false,
    haltTHORChain: false,
    pauseLp: false
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
      msg = mimirHalt.haltTrading ? intl.formatMessage({ id: 'halt.trading' }) : msg
      msg = mimirHalt.haltTHORChain ? intl.formatMessage({ id: 'halt.thorchain' }) : msg

      if (!mimirHalt.haltTHORChain && !mimirHalt.haltTrading) {
        const haltedChainsState: HaltedChainsState[] = Object.keys(DEFAULT_ENABLED_CHAINS).map((chain) => {
          return {
            chain,
            haltedChain: mimirHalt[`halt${chain}Chain`],
            haltedTrading: mimirHalt[`halt${chain}Trading`],
            pausedLP: mimirHalt[`pauseLp${chain}`]
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
            ? `${msg} ${intl.formatMessage({ id: 'halt.chains' }, { chains: haltedChains.join(', ') })}`
            : `${msg}`

        const haltedTradingChains = haltedChainsState
          .filter(({ haltedTrading }) => haltedTrading)
          .map(({ chain }) => chain)
        msg =
          haltedTradingChains.length > 0
            ? `${msg} ${intl.formatMessage({ id: 'halt.chain.trading' }, { chains: haltedTradingChains.join(', ') })}`
            : `${msg}`

        const pausedLPs = haltedChainsState.filter(({ pausedLP }) => pausedLP).map(({ chain }) => chain)
        msg =
          pausedLPs.length > 0
            ? `${msg} ${intl.formatMessage({ id: 'halt.chain.pause' }, { chains: pausedLPs.join(', ') })}`
            : mimirHalt.pauseLp
            ? `${msg} ${intl.formatMessage({ id: 'halt.chain.pauseall' })}`
            : `${msg}`
      }
      return msg ? <Styled.Alert key={'halted warning'} type="warning" message={msg} /> : <></>
    }),
    O.getOrElse(() => <></>)
  )

  return <>{renderWarning}</>
}

export default HaltedChainsWarning
