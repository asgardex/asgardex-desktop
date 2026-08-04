import { useMemo, useState } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { getChainDerivationPath } from '../../../shared/utils/derivationPath'
import { DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS } from '../../../shared/wallet/types'
import { keystoreChainHDSettings$ } from '../../services/wallet/keystoreHDSettings'
import { TextButton } from '../uielements/button'
import { Label } from '../uielements/label'
import { KeystoreFindFundsModal } from './KeystoreFindFundsModal'

type Props = {
  chain: Chain
  network: Network
}

const profileLabelId = (
  chain: Chain,
  settings: { hdMode: string; customPath?: string; account: number; index: number }
) => {
  if (settings.customPath?.trim()) return 'settings.wallet.hd.profile.custom' as const
  if (chain === THORChain) return 'settings.wallet.hd.profile.thor' as const
  switch (settings.hdMode) {
    case 'metamask':
      return 'settings.wallet.hd.profile.metamask' as const
    case 'legacy':
      return 'settings.wallet.hd.profile.legacy' as const
    case 'ledgerlive':
    case 'default':
    default:
      return 'settings.wallet.hd.profile.ledgerlive' as const
  }
}

/** Account number shown to users (1-based). MetaMask/legacy use index; Ledger Live & THOR use account. */
const displayAccountNumber = (
  chain: Chain,
  settings: {
    hdMode: string
    customPath?: string
    account: number
    index: number
  }
): number | null => {
  if (settings.customPath?.trim()) return null
  if (chain !== THORChain && (settings.hdMode === 'metamask' || settings.hdMode === 'legacy')) {
    return settings.index + 1
  }
  return settings.account + 1
}

/**
 * Quiet keystore HD summary + "Find my funds" (profile scan or custom path).
 */
export const KeystoreHDSettingsPanel = ({ chain, network }: Props): JSX.Element => {
  const intl = useIntl()
  const settings = useObservableState(keystoreChainHDSettings$(chain), DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS)
  const [findOpen, setFindOpen] = useState(false)

  const summary = useMemo(() => {
    const path =
      settings.customPath?.trim() ||
      getChainDerivationPath(chain, settings.account, settings.index, network, settings.hdMode).path
    const accountNum = displayAccountNumber(chain, settings)
    return {
      profileId: profileLabelId(chain, settings),
      accountNum,
      path
    }
  }, [settings, chain, network])

  return (
    <div className="mt-10px flex flex-col gap-1 px-40px">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Label size="small" color="gray" className="!w-auto !p-0">
          {summary.accountNum != null && (
            <>
              {intl.formatMessage({ id: 'settings.wallet.account' })} {summary.accountNum}
              {' · '}
            </>
          )}
          {intl.formatMessage({ id: summary.profileId })}
        </Label>
        <TextButton className="!p-0 text-sm text-turquoise" onClick={() => setFindOpen(true)}>
          {intl.formatMessage({ id: 'settings.wallet.hd.find.action' })}
        </TextButton>
      </div>
      <Label size="small" color="gray" className="!w-auto !p-0 font-mono opacity-70">
        {summary.path}
      </Label>

      <KeystoreFindFundsModal open={findOpen} chain={chain} network={network} onClose={() => setFindOpen(false)} />
    </div>
  )
}
