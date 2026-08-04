import { useMemo, useState } from 'react'

import { Network } from '@xchainjs/xchain-client'
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

const modeLabelId = (hdMode: string) => {
  switch (hdMode) {
    case 'metamask':
      return 'settings.wallet.hd.mode.metamask' as const
    case 'legacy':
      return 'settings.wallet.hd.mode.legacy' as const
    case 'ledgerlive':
    case 'default':
    default:
      return 'settings.wallet.hd.mode.standard' as const
  }
}

/**
 * Quiet keystore HD summary + "Find my funds" entry point.
 * Path selection happens in the scan modal — no BIP jargon on the chain row.
 */
export const KeystoreHDSettingsPanel = ({ chain, network }: Props): JSX.Element => {
  const intl = useIntl()
  const settings = useObservableState(keystoreChainHDSettings$(chain), DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS)
  const [findOpen, setFindOpen] = useState(false)

  const summary = useMemo(() => {
    const accountLabel = settings.account + 1
    const modeId = modeLabelId(settings.hdMode)
    const path = getChainDerivationPath(chain, settings.account, settings.index, network, settings.hdMode).path
    return {
      accountLabel,
      modeId,
      path
    }
  }, [settings, chain, network])

  return (
    <div className="mt-10px flex flex-col gap-1 px-40px">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Label size="small" color="gray" className="!w-auto !p-0">
          {intl.formatMessage({ id: 'settings.wallet.account' })} {summary.accountLabel}
          {' · '}
          {intl.formatMessage({ id: summary.modeId })}
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
