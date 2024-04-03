import * as RD from '@devexperts/remote-data-ts'
import { Address } from '@xchainjs/xchain-util'
import { Asset } from '@xchainjs/xchain-util'
import { FormInstance } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { IntlShape } from 'react-intl'

import { ASGARDEX_AFFILIATE_FEE, ASGARDEX_THORNAME } from '../../../../shared/const'
import { WalletType } from '../../../../shared/wallet/types'
import { emptyString } from '../../../helpers/stringHelper'
import { getWalletByAddress } from '../../../helpers/walletHelper'
import { WalletBalances } from '../../../services/clients'
import { TxHashRD } from '../../../services/wallet/types'
import { WalletTypeLabel } from '../../uielements/common/Common.styles'
import * as Styled from './TxForm.styles'

export const renderedWalletType = (oMatchedWalletType: O.Option<WalletType>) =>
  FP.pipe(
    oMatchedWalletType,
    O.fold(
      () => <></>,
      (matchedWalletType) => (
        <Styled.WalletTypeLabelWrapper>
          <WalletTypeLabel>{matchedWalletType}</WalletTypeLabel>
        </Styled.WalletTypeLabelWrapper>
      )
    )
  )

export const matchedWalletType = (balances: WalletBalances, recipientAddress: Address): O.Option<WalletType> =>
  FP.pipe(
    getWalletByAddress(balances, recipientAddress),
    O.map(({ walletType }) => walletType)
  )

export const getSendTxTimerValue = (status: TxHashRD) =>
  FP.pipe(
    status,
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

export const getSendTxDescription = ({
  status,
  asset,
  intl
}: {
  status: TxHashRD
  asset: Asset
  intl: IntlShape
}): string =>
  FP.pipe(
    status,
    RD.fold(
      () => emptyString,
      () =>
        `${intl.formatMessage({ id: 'common.step' }, { current: 1, total: 1 })}: ${intl.formatMessage(
          { id: 'common.tx.sendingAsset' },
          { assetTicker: asset.ticker }
        )}`,
      () => emptyString,
      () => intl.formatMessage({ id: 'common.tx.success' })
    )
  )

export const hasFormErrors = (form: FormInstance) =>
  !!form.getFieldsError().filter(({ errors }) => errors.length).length

// detecting a swap memo
export function checkMemo(memo: string): boolean {
  // Check if the memo is not empty and starts with '=' or 'SWAP'
  if (
    memo.startsWith('=') ||
    memo.startsWith('SWAP') ||
    memo.startsWith('swap') ||
    memo.startsWith('s') ||
    memo.startsWith('S')
  ) {
    return true
  }
  return false
}

export function memoCorrection(memo: string): string {
  // Split the memoValue by ':'
  let parts = memo.split(':')

  // Remove any existing 'dx' parts and anything after it
  const dxIndex = parts.findIndex((part) => part.startsWith(`${ASGARDEX_THORNAME}`))
  if (dxIndex !== -1) {
    parts = parts.slice(0, dxIndex)
  }

  // Remove empty trailing parts to handle cases like '::::'
  while (parts[parts.length - 1] === '') {
    parts.pop()
  }

  // Ensure that there are four parts before 'dx:5'
  while (parts.length < 4) {
    parts.push('')
  }

  // Append 'dx:10'
  parts.push(`${ASGARDEX_THORNAME}:${ASGARDEX_AFFILIATE_FEE}`)

  // Reassemble the memoValue
  const memocorrected = parts.join(':')
  return memocorrected
}
