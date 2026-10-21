import { useCallback, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowRightIcon } from '@heroicons/react/20/solid'
import { Network } from '@xchainjs/xchain-client'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { THORChain } from '../../../../shared/utils/chainIds'
import { truncateAddress } from '../../../helpers/addressHelper'
import { OperatorFinderFeeVaultEntry, useOperatorFinderFeeVaults } from '../../../hooks/useRunebondListing'
import { FeeRD, SendTxStateHandler } from '../../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../services/clients'
import { ValidatePasswordHandler } from '../../../services/wallet/types'
import { BondWalletInfo } from '../../../views/bonds/types'
import { BaseButton } from '../../uielements/button'
import {
  RUNEBOND_VAULT_DOCS_URL,
  RunebondVaultSettled,
  RunebondVaultTopUpModal,
  useRunebondVaultTopUp
} from './RunebondVaultTopUpModal'

type TxProps = {
  network: Network
  fee: FeeRD
  transfer$: SendTxStateHandler
  validatePassword$: ValidatePasswordHandler
  openExplorerTxUrl: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  balanceByAddress: (address: Address) => BaseAmount
}

type NoticeProps = TxProps & {
  entry: OperatorFinderFeeVaultEntry
  signer: BondWalletInfo | undefined
  showAddress: boolean
}

const RunebondVaultNotice = ({ entry, signer, showAddress, network, balanceByAddress, ...tx }: NoticeProps) => {
  const intl = useIntl()
  const { vault, received, finish } = useRunebondVaultTopUp(entry.vaultRD)
  const [open, setOpen] = useState(false)

  const onFinish = useCallback(
    (settled: RunebondVaultSettled) => {
      setOpen(false)
      finish(settled)
    },
    [finish]
  )

  if (!vault?.known || !(vault.depleted || received)) return null

  return (
    <div
      className={clsx(
        'mt-4 flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-solid px-4 py-3',
        received
          ? 'border-turquoise/60 bg-turquoise/10'
          : 'border-warning0/60 bg-warning0/10 dark:border-warning0d/60 dark:bg-warning0d/10'
      )}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={clsx(
            'h-[8px] w-[8px] shrink-0 rounded-full',
            received ? 'bg-turquoise' : 'bg-warning0 dark:bg-warning0d'
          )}
        />
        <span
          className={clsx('font-main text-[14px]', received ? 'text-turquoise' : 'text-warning0 dark:text-warning0d')}>
          {intl.formatMessage({
            id: received ? 'bonds.runebond.vault.received' : 'bonds.runebond.listing.headline.vaultDepleted'
          })}
        </span>
        {showAddress && (
          <span className="shrink-0 font-main text-[12px] text-gray2 dark:text-gray2d">
            {truncateAddress(entry.address, THORChain, network)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {signer && (
          <BaseButton
            className="group !p-0 font-main-semi-bold text-[12px] tracking-[1px] whitespace-nowrap text-turquoise uppercase"
            onClick={() => setOpen(true)}>
            {intl.formatMessage({ id: 'bonds.runebond.vault.topUp' })}
            <ArrowRightIcon className="ml-1 h-[14px] w-[14px] text-inherit transition-transform group-hover:translate-x-[2px]" />
          </BaseButton>
        )}
        <BaseButton
          className="!p-0 font-main text-[12px] whitespace-nowrap text-gray2 hover:text-turquoise dark:text-gray2d"
          onClick={() => window.apiUrl.openExternal(RUNEBOND_VAULT_DOCS_URL)}>
          {intl.formatMessage({ id: 'bonds.runebond.vault.docs' })}
        </BaseButton>
      </div>
      {open && signer && (
        <RunebondVaultTopUpModal
          {...tx}
          network={network}
          operatorAddress={entry.address}
          vault={vault}
          signer={signer}
          walletBalance={balanceByAddress(signer.address)}
          onClose={() => setOpen(false)}
          onFinish={onFinish}
        />
      )}
    </div>
  )
}

type Props = TxProps & {
  operatorAddresses: Address[]
  walletInfos: BondWalletInfo[]
}

export const RunebondVaultNotices = ({ operatorAddresses, walletInfos, ...props }: Props) => {
  const entries = useOperatorFinderFeeVaults(operatorAddresses)
  const depletedCount = entries.filter(
    ({ vaultRD }) => RD.isSuccess(vaultRD) && vaultRD.value.known && vaultRD.value.depleted
  ).length

  return (
    <>
      {entries.map((entry) => (
        <RunebondVaultNotice
          key={entry.address}
          {...props}
          entry={entry}
          signer={walletInfos.find(({ address }) => address.toLowerCase() === entry.address.toLowerCase())}
          showAddress={depletedCount > 1}
        />
      ))}
    </>
  )
}
