import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, BaseAmount } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { IntlShape } from 'react-intl'

import { isAvaxChain, isBscChain, isEthChain } from '../../../../helpers/chainHelper'
import { SaverDepositState, SendTxState } from '../../../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../../services/clients'
import { TxModal } from '../../../modal/tx'
import { SendAsset } from '../../../modal/tx/extra/SendAsset'
import { ViewTxButton } from '../../../uielements/button'
import * as H from '../TxForm.helpers'

export const renderTxModal = ({
  asset,
  amountToSend,
  network,
  sendTxState,
  resetSendTxState,
  sendTxStartTime,
  openExplorerTxUrl,
  getExplorerTxUrl,
  intl
}: {
  asset: AnyAsset
  amountToSend: BaseAmount
  network: Network
  sendTxState: SendTxState
  resetSendTxState: FP.Lazy<void>
  sendTxStartTime: number
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  intl: IntlShape
}) => {
  const { status } = sendTxState

  // don't render TxModal in initial state
  if (RD.isInitial(status)) return <></>

  const oTxHash = RD.toOption(status)
  const txRD = FP.pipe(
    status,
    RD.map((txHash) => !!txHash)
  )

  return (
    <TxModal
      title={intl.formatMessage({ id: 'common.tx.sending' })}
      onClose={resetSendTxState}
      onFinish={resetSendTxState}
      startTime={sendTxStartTime}
      txRD={txRD}
      extraResult={
        <ViewTxButton
          txHash={oTxHash}
          onClick={openExplorerTxUrl}
          txUrl={FP.pipe(oTxHash, O.chain(getExplorerTxUrl))}
        />
      }
      timerValue={H.getSendTxTimerValue(status)}
      extra={
        <SendAsset
          asset={{ asset, amount: amountToSend }}
          description={H.getSendTxDescription({ status, asset, intl })}
          network={network}
        />
      }
    />
  )
}

export const renderDepositModal = ({
  asset,
  amountToSend,
  network,
  depositState,
  resetDepositState,
  sendTxStartTime,
  openExplorerTxUrl,
  getExplorerTxUrl,
  intl
}: {
  asset: AnyAsset
  amountToSend: BaseAmount
  network: Network
  depositState: SaverDepositState
  resetDepositState: FP.Lazy<void>
  sendTxStartTime: number
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  intl: IntlShape
}) => {
  const { deposit: depositRD, depositTx } = depositState

  // don't render TxModal in initial state
  if (RD.isInitial(depositRD)) return <></>

  // title
  const txModalTitle = FP.pipe(
    depositRD,
    RD.fold(
      () => 'deposit.add.state.pending',
      () => 'deposit.add.state.pending',
      () => 'deposit.add.state.error',
      () => 'deposit.add.state.success'
    ),
    (id) => intl.formatMessage({ id })
  )

  const oTxHash = FP.pipe(
    RD.toOption(depositTx),
    // Note: As long as we link to `viewblock` to open tx details in a browser,
    // `0x` needs to be removed from tx hash in case of ETH
    // @see https://github.com/thorchain/asgardex-electron/issues/1787#issuecomment-931934508
    O.map((txHash) =>
      isEthChain(asset.chain) || isAvaxChain(asset.chain) || isBscChain(asset.chain)
        ? txHash.replace(/0x/i, '')
        : txHash
    )
  )

  // Get timer value
  const timerValue = FP.pipe(
    depositRD,
    RD.fold(
      () => 0,
      FP.flow(
        O.map(({ loaded }) => loaded),
        O.getOrElse(() => 0)
      ),
      () => 0,
      () => 100
    )
  )
  const stepDescriptions = [
    intl.formatMessage({ id: 'common.tx.healthCheck' }),
    intl.formatMessage({ id: 'common.tx.sendingAsset' }, { assetTicker: asset.ticker }),
    intl.formatMessage({ id: 'common.tx.checkResult' })
  ]
  const stepDescription = FP.pipe(
    depositState.deposit,
    RD.fold(
      () => '',
      () =>
        `${intl.formatMessage(
          { id: 'common.step' },
          { current: depositState.step, total: depositState.stepsTotal }
        )}: ${stepDescriptions[depositState.step - 1]}`,
      () => '',
      () => `${intl.formatMessage({ id: 'common.done' })}!`
    )
  )

  return (
    <TxModal
      title={txModalTitle}
      onClose={resetDepositState}
      onFinish={resetDepositState}
      startTime={sendTxStartTime}
      txRD={depositRD}
      extraResult={
        <ViewTxButton
          txHash={oTxHash}
          onClick={openExplorerTxUrl}
          txUrl={FP.pipe(oTxHash, O.chain(getExplorerTxUrl))}
        />
      }
      timerValue={timerValue}
      extra={<SendAsset asset={{ asset, amount: amountToSend }} description={stepDescription} network={network} />}
    />
  )
}
