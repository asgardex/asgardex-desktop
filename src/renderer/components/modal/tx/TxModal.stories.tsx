import * as RD from '@devexperts/remote-data-ts'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Meta, StoryFn } from '@storybook/react'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { assetAmount, assetToBase } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'

import { AssetBTC, AssetRuneNative } from '../../../../shared/utils/asset'
import { ErrorId } from '../../../services/wallet/types'
import { Button, ViewTxButton } from '../../uielements/button'
import { Label } from '../../uielements/label'
import { TxModal, UnifiedTxModal } from './TxModal'
import { TxConfig } from './TxModal.types'

const onClose = () => console.log('onClose')
const onFinish = () => console.log('onFinish')
const _onViewTxClick = (txHash: TxHash) => console.log('txHash', txHash)
const noopExplorer = (_txHash: string) => O.some(`https://explorer.example/tx/${_txHash}`)
const noopOpenExplorer = (_txHash: string) => Promise.resolve(true)

// ── Legacy TxModal stories ──────────────────────────────────────────

export const StoryInitial: StoryFn = () => (
  <TxModal title="initial" txRD={RD.initial} onClose={onClose} onFinish={onFinish} />
)
StoryInitial.storyName = 'legacy/initial'

export const StoryPending: StoryFn = () => (
  <TxModal title="pending" startTime={Date.now()} txRD={RD.pending} onClose={onClose} onFinish={onFinish} />
)
StoryPending.storyName = 'legacy/pending'

export const StorySuccess: StoryFn = () => (
  <TxModal title="success" txRD={RD.success(true)} onClose={onClose} onFinish={onFinish} />
)
StorySuccess.storyName = 'legacy/success'

export const StoryFailure: StoryFn = () => (
  <TxModal
    title="error"
    startTime={Date.now()}
    txRD={RD.failure({ errorId: ErrorId.SEND_TX, msg: 'something went wrong' })}
    onClose={onClose}
    onFinish={onFinish}
  />
)
StoryFailure.storyName = 'legacy/failure'

const extraContent = (): JSX.Element => (
  <div className="flex flex-col items-center justify-center gap-2">
    <Label align="center" color="warning" textTransform="uppercase">
      Extra Content
    </Label>
    <Button onClick={() => console.log('extra button clicked')} typevalue="outline" color="warning">
      <ArrowPathIcon />
      Extra Button
    </Button>
  </div>
)

const extraResult = (): JSX.Element => (
  <ViewTxButton
    txHash={O.some('hash')}
    onClick={(txHash: TxHash) => console.log('txHash', txHash)}
    txUrl={O.some(`http://txurl.example`)}
  />
)

export const StoryExtraResult: StoryFn = () => (
  <TxModal
    title="success"
    txRD={RD.success(true)}
    onClose={onClose}
    onFinish={onFinish}
    extra={extraContent()}
    extraResult={extraResult()}
  />
)
StoryExtraResult.storyName = 'legacy/success + extra'

// ── UnifiedTxModal stories ──────────────────────────────────────────

const btcAmount = assetToBase(assetAmount(0.5))
const runeAmount = assetToBase(assetAmount(1000))

const swapConfig: TxConfig = {
  type: 'swap',
  source: { asset: AssetBTC, amount: btcAmount },
  target: { asset: AssetRuneNative, amount: runeAmount },
  protocol: O.some('Thorchain')
}

export const UnifiedSwapPending: StoryFn = () => (
  <UnifiedTxModal
    title="Swap Pending"
    txRD={RD.pending}
    timerValue={45}
    startTime={Date.now()}
    txConfig={swapConfig}
    txHash={O.none}
    getExplorerTxUrl={noopExplorer}
    openExplorerTxUrl={noopOpenExplorer}
    network={Network.Mainnet}
    trackable={true}
    onClose={onClose}
    onFinish={onFinish}
  />
)
UnifiedSwapPending.storyName = 'unified/swap pending'

export const UnifiedSwapSuccess: StoryFn = () => (
  <UnifiedTxModal
    title="Swap Complete"
    txRD={RD.success(true)}
    txConfig={swapConfig}
    txHash={O.some('ABC123DEF456')}
    getExplorerTxUrl={noopExplorer}
    openExplorerTxUrl={noopOpenExplorer}
    network={Network.Mainnet}
    trackable={true}
    onClose={onClose}
    onFinish={onFinish}
  />
)
UnifiedSwapSuccess.storyName = 'unified/swap success'

const sendConfig: TxConfig = {
  type: 'send',
  asset: { asset: AssetBTC, amount: btcAmount }
}

export const UnifiedSend: StoryFn = () => (
  <UnifiedTxModal
    title="Sending..."
    txRD={RD.pending}
    timerValue={30}
    startTime={Date.now()}
    txConfig={sendConfig}
    txHash={O.none}
    getExplorerTxUrl={noopExplorer}
    openExplorerTxUrl={noopOpenExplorer}
    network={Network.Mainnet}
    onClose={onClose}
    onFinish={onFinish}
  />
)
UnifiedSend.storyName = 'unified/send pending'

const depositConfig: TxConfig = {
  type: 'deposit',
  asset: { asset: AssetBTC, amount: btcAmount },
  steps: { current: 2, total: 3 },
  stepDescriptions: ['Health Check', 'Sending BTC', 'Check Result']
}

export const UnifiedDeposit: StoryFn = () => (
  <UnifiedTxModal
    title="Deposit Pending"
    txRD={RD.pending}
    timerValue={60}
    startTime={Date.now()}
    txConfig={depositConfig}
    txHash={O.none}
    getExplorerTxUrl={noopExplorer}
    openExplorerTxUrl={noopOpenExplorer}
    network={Network.Mainnet}
    onClose={onClose}
    onFinish={onFinish}
  />
)
UnifiedDeposit.storyName = 'unified/deposit with steps'

const withdrawConfig: TxConfig = {
  type: 'withdraw',
  source: O.some({ asset: AssetRuneNative, amount: runeAmount }),
  target: { asset: AssetBTC, amount: btcAmount }
}

export const UnifiedWithdraw: StoryFn = () => (
  <UnifiedTxModal
    title="Withdraw Success"
    txRD={RD.success(true)}
    txConfig={withdrawConfig}
    txHash={O.some('WITHDRAW_TX_HASH')}
    getExplorerTxUrl={noopExplorer}
    openExplorerTxUrl={noopOpenExplorer}
    network={Network.Mainnet}
    onClose={onClose}
    onFinish={onFinish}
  />
)
UnifiedWithdraw.storyName = 'unified/withdraw success'

export const UnifiedError: StoryFn = () => (
  <UnifiedTxModal
    title="Error"
    txRD={RD.failure({ errorId: ErrorId.SEND_TX, msg: 'Insufficient funds for transaction' })}
    txConfig={sendConfig}
    txHash={O.none}
    getExplorerTxUrl={noopExplorer}
    openExplorerTxUrl={noopOpenExplorer}
    network={Network.Mainnet}
    onClose={onClose}
    onFinish={onFinish}
  />
)
UnifiedError.storyName = 'unified/error'

const meta: Meta = {
  component: TxModal,
  title: 'Components/modal/TxModal',
  decorators: [
    (S) => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '300px'
        }}>
        <S />
      </div>
    )
  ]
}

export default meta
