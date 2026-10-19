import { Network } from '@xchainjs/xchain-client'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { hiddenString } from '../../../helpers/stringHelper'
import { OperatorFinderFeeVault } from '../../../services/runebond'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { BorderButton } from '../../uielements/button'
import { formatRuneAmount, isVaultDepleted } from './helpers'
import { VAULT_LEVEL_TEXT_CLASS } from './RunebondVaultTopUpModal'

type Props = {
  network: Network
  isPrivate: boolean
  vault: OperatorFinderFeeVault | undefined
  received: boolean
  onTopUp?: () => void
}

export const RunebondVaultOnBehalfDetails = ({ network, isPrivate, vault, received, onTopUp }: Props) => {
  const intl = useIntl()
  return (
    <>
      <div className="flex min-w-0 flex-1 basis-[260px] flex-col gap-1.5">
        <span className="font-main-semi-bold text-[11px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.runebond.vault.title' })}
        </span>
        {vault?.known && (
          <span
            className={clsx(
              'flex items-center gap-2 font-main-semi-bold text-[18px] leading-tight',
              VAULT_LEVEL_TEXT_CLASS.depleted
            )}>
            <AssetIcon asset={AssetRuneNative} size="xsmall" network={network} />
            {isPrivate ? hiddenString : formatRuneAmount(vault.balance)}
          </span>
        )}
        {!received && (
          <span className="mt-1 font-main text-[13px] leading-relaxed text-warning0 dark:text-warning0d">
            {intl.formatMessage({ id: 'bonds.runebond.vault.onBehalf.empty' })}
          </span>
        )}
      </div>
      {!received && onTopUp && isVaultDepleted(vault) && (
        <BorderButton size="normal" onClick={onTopUp}>
          {intl.formatMessage({ id: 'bonds.runebond.vault.onBehalf.topUp' })}
        </BorderButton>
      )}
    </>
  )
}
