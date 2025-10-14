import * as RD from '@devexperts/remote-data-ts'
import { Address, AnyAsset } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { IntlShape } from 'react-intl'

import { TrustedAddress } from '../../../../shared/api/types'
import { WalletType } from '../../../../shared/wallet/types'
import { emptyString } from '../../../helpers/stringHelper'
import { getWalletByAddress } from '../../../helpers/walletHelper'
import { SendTxState } from '../../../services/chain/types'
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
  sendTxState,
  asset,
  intl
}: {
  sendTxState: SendTxState
  asset: AnyAsset
  intl: IntlShape
}): string => {
  const stepDescriptions = [
    intl.formatMessage({ id: 'common.tx.healthCheck' }),
    intl.formatMessage({ id: 'common.tx.sendingAsset' }, { assetTicker: asset.ticker }),
    intl.formatMessage({ id: 'common.tx.checkResult' })
  ]

  return FP.pipe(
    sendTxState.status,
    RD.fold(
      () => emptyString,
      () =>
        `${intl.formatMessage(
          { id: 'common.step' },
          { current: sendTxState.steps.current, total: sendTxState.steps.total }
        )}: ${stepDescriptions[sendTxState.steps.current - 1] || ''}`,
      () => emptyString,
      () => intl.formatMessage({ id: 'common.tx.success' })
    )
  )
}
