import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { QuoteSwap as QuoteSwapProtocol } from '@xchainjs/xchain-aggregator'
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

  const oTxHash = useMemo(
    () =>
      FP.pipe(
        RD.toOption(swapTx),
        // Note: As long as we link to `viewblock` to open tx details in a browser,
        // `0x` needs to be removed from tx hash in case of ETH
        // @see https://github.com/thorchain/asgardex-electron/issues/1787#issuecomment-931934508
        O.map((txHash) => (isEvmChain(sourceChain) ? txHash.replace(/0x/i, '') : txHash))
      ),
    [sourceChain, swapTx]
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
        />
      }
      timerValue={timerValue}
      extra={extraTxModalContent}
    />
  )
}
