import * as RD from '@devexperts/remote-data-ts'
import { Address, AnyAsset } from '@xchainjs/xchain-util'
import { FormInstance } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { IntlShape } from 'react-intl'

import { TrustedAddress } from '../../../../shared/api/types'
import { ASGARDEX_AFFILIATE_FEE, ASGARDEX_THORNAME } from '../../../../shared/const'
import { WalletType } from '../../../../shared/wallet/types'
import { emptyString } from '../../../helpers/stringHelper'
import { getWalletByAddress } from '../../../helpers/walletHelper'
import { WalletBalances } from '../../../services/clients'
import { TxHashRD } from '../../../services/wallet/types'
import { WalletTypeLabel } from '../../uielements/common/Common.styles'
import * as Styled from './TxForm.styles'

export const renderedWalletType = (oWalletType: O.Option<WalletType>, oTrustedAddresses: O.Option<TrustedAddress[]>) =>
  FP.pipe(
    oTrustedAddresses,
    O.fold(
      () => <></>, // Handle None case
      (trustedAddresses) =>
        trustedAddresses.length > 0 ? (
          <Styled.WalletTypeLabelWrapper>
            <WalletTypeLabel>{trustedAddresses[0].name}</WalletTypeLabel> {/* Display TrustedAddress name */}
          </Styled.WalletTypeLabelWrapper>
        ) : (
          FP.pipe(
            // If no trusted addresses, check wallet type
            oWalletType,
            O.fold(
              () => <></>,
              (walletType) => (
                <Styled.WalletTypeLabelWrapper>
                  <WalletTypeLabel>{walletType}</WalletTypeLabel> {/* Display WalletType */}
                </Styled.WalletTypeLabelWrapper>
              )
            )
          )
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
  asset: AnyAsset
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
export function checkMemo(memo: string | undefined): boolean {
  // Ensure memo is a valid string and not undefined or empty
  if (!memo || typeof memo !== 'string') {
    return false
  }

  // Check if the memo starts with '=', 'SWAP', 'swap', 's', or 'S'
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
