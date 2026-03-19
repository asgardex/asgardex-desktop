import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { QuoteSwap as QuoteSwapProtocol } from '@xchainjs/xchain-aggregator'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { isEvmChain } from '../../helpers/evmHelper'
import { useNetwork } from '../../hooks/useNetwork'
import { SwapTxState } from '../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../services/clients'
import { UnifiedTxModal, getTxTimerValue, TxConfig } from '../modal/tx'
import type { AssetData } from '../modal/tx/extra/Common.types'

export type SwapTxModalProps = {
  swapState: SwapTxState
  swapStartTime: number
  sourceChain: string
  source: AssetData
  target: AssetData
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
  source,
  target,
  oQuoteProtocol,
  goToTransaction,
  getExplorerTxUrl,
  onCloseTxModal,
  onFinishTxModal
}: SwapTxModalProps) => {
  const intl = useIntl()
  const { network } = useNetwork()

  const timerValue = useMemo(() => getTxTimerValue(swapTx), [swapTx])

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

  const protocol: O.Option<string> = FP.pipe(
    oQuoteProtocol,
    O.map((qp) => qp.protocol as string)
  )

  const channelId: O.Option<string> = FP.pipe(
    oQuoteProtocol,
    O.chain((qp) => (qp.depositChannelId ? O.some(qp.depositChannelId) : O.none))
  )

  const oTxHash = useMemo(
    () =>
      FP.pipe(
        RD.toOption(swapTx),
        O.map((txHash) => {
          const protocolValue = FP.pipe(
            protocol,
            O.getOrElse(() => 'default')
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

  const txConfig: TxConfig = useMemo(
    () => ({
      type: 'swap',
      source,
      target,
      protocol,
      channelId
    }),
    [source, target, protocol, channelId]
  )

  // don't render TxModal in initial state
  if (RD.isInitial(swapTx)) return <></>

  return (
    <UnifiedTxModal
      title={txModalTitle}
      onClose={onCloseTxModal}
      onFinish={onFinishTxModal}
      startTime={swapStartTime}
      txRD={txRDasBoolean}
      timerValue={timerValue}
      txConfig={txConfig}
      txHash={oTxHash}
      getExplorerTxUrl={getExplorerTxUrl}
      openExplorerTxUrl={goToTransaction}
      network={network}
      trackable={true}
    />
  )
}
