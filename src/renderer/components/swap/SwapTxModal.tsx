import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { QuoteSwap as QuoteSwapProtocol } from '@xchainjs/xchain-aggregator'
import { Protocol } from '@xchainjs/xchain-aggregator/lib/types'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { useIntl } from 'react-intl'

import { isEvmChain } from '../../helpers/evmHelper'
import { useNetwork } from '../../hooks/useNetwork'
import { SwapTxState } from '../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../services/clients'
import { TxModal } from '../modal/tx'
import { ViewTxButton } from '../uielements/button'

export type SwapTxModalProps = {
  swapState: SwapTxState
  swapStartTime: number
  sourceChain: string
  extraTxModalContent: React.ReactNode
  oQuoteProtocol: O.Option<QuoteSwapProtocol>
  goToTransaction: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  onCloseTxModal: () => void
  onFinishTxModal: () => void
}

export const SwapTxModal = ({
  swapState: { swapTx },
  swapStartTime,
  sourceChain,
  extraTxModalContent,
  oQuoteProtocol,
  goToTransaction,
  getExplorerTxUrl,
  onCloseTxModal,
  onFinishTxModal
}: SwapTxModalProps) => {
  const intl = useIntl()
  const { network } = useNetwork()

  // Get timer value
  const timerValue = useMemo(
    () =>
      FP.pipe(
        swapTx,
        RD.fold(
          () => 0,
          FP.flow(
            O.map(({ loaded }) => loaded),
            O.getOrElse(() => 0)
          ),
          () => 0,
          () => 100
        )
      ),
    [swapTx]
  )

  // title
  const txModalTitle = useMemo(
    () =>
      FP.pipe(
        swapTx,
        RD.fold(
          () => 'swap.state.sending',
          () => 'swap.state.pending',
          () => 'swap.state.error',
          () => 'swap.state.success'
        ),
        (id) => intl.formatMessage({ id })
      ),
    [intl, swapTx]
  )

  const protocol: O.Option<Protocol> = FP.pipe(
    oQuoteProtocol,
    O.map((quoteProtocol) => quoteProtocol.protocol)
  )

  const oTxHash = useMemo(
    () =>
      FP.pipe(
        RD.toOption(swapTx),
        O.map((txHash) => {
          const protocolValue = FP.pipe(
            protocol,
            O.getOrElse(() => 'default' as Protocol)
          )
          return isEvmChain(sourceChain) && protocolValue !== 'Chainflip' ? txHash.replace(/0x/i, '') : txHash
        })
      ),
    [protocol, sourceChain, swapTx]
  )
  const txRDasBoolean = useMemo(
    () =>
      FP.pipe(
        swapTx,
        RD.map((txHash) => !!txHash)
      ),
    [swapTx]
  )

  // don't render TxModal in initial state
  if (RD.isInitial(swapTx)) return <></>

  return (
    <TxModal
      title={txModalTitle}
      onClose={onCloseTxModal}
      onFinish={onFinishTxModal}
      startTime={swapStartTime}
      txRD={txRDasBoolean}
      extraResult={
        <ViewTxButton
          txHash={oTxHash}
          onClick={goToTransaction}
          txUrl={FP.pipe(oTxHash, O.chain(getExplorerTxUrl))}
          network={network}
          trackable={true}
          protocol={FP.pipe(
            oQuoteProtocol,
            O.map((quoteProtocol) => quoteProtocol.protocol)
          )}
          channelId={FP.pipe(
            oQuoteProtocol,
            O.chain((quoteProtocol) =>
              quoteProtocol.depositChannelId ? O.some(quoteProtocol.depositChannelId) : O.none
            )
          )}
        />
      }
      timerValue={timerValue}
      extra={extraTxModalContent}
    />
  )
}
