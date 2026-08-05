import { useEffect, useMemo, useState } from 'react'

import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { getChainDerivationPath } from '../../../shared/utils/derivationPath'
import { validateDerivationPath, warnDerivationPath } from '../../../shared/utils/derivationPathValidation'
import { settingsFromCustomPath } from '../../../shared/utils/keystoreHdScan'
import { DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS, KeystoreChainHDSettings, WalletType } from '../../../shared/wallet/types'
import { useWalletContext } from '../../contexts/WalletContext'
import { keystoreChainHDSettings$, setKeystoreChainHDSettings } from '../../services/wallet/keystoreHDSettings'
import { TextButton } from '../uielements/button'
import { Label } from '../uielements/label'
import { KeystoreFindFundsModal } from './KeystoreFindFundsModal'

type Props = {
  chain: Chain
  network: Network
}

const profileLabelId = (chain: Chain, settings: KeystoreChainHDSettings) => {
  if (settings.customPath?.trim()) return 'settings.wallet.hd.profile.custom' as const
  if (chain === THORChain) return 'settings.wallet.hd.profile.thor' as const
  if (chain === BTCChain) {
    return settings.hdMode === 'p2tr'
      ? ('settings.wallet.hd.profile.p2tr' as const)
      : ('settings.wallet.hd.profile.p2wpkh' as const)
  }
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

/** Always show address index (never BIP44 “account”) for the quiet summary. */
const displayIndex = (settings: KeystoreChainHDSettings): number | null => {
  if (settings.customPath?.trim()) return null
  return settings.index
}

const resolvedPathFor = (chain: Chain, network: Network, settings: KeystoreChainHDSettings): string =>
  settings.customPath?.trim() ||
  getChainDerivationPath(chain, settings.account, settings.index, network, settings.hdMode).path

/**
 * Quiet keystore HD summary: edit path + Save, or open "Find my funds" for discovery.
 */
export const KeystoreHDSettingsPanel = ({ chain, network }: Props): JSX.Element => {
  const intl = useIntl()
  const { reloadBalancesByChain } = useWalletContext()
  const settings = useObservableState(keystoreChainHDSettings$(chain), DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS)
  const [findOpen, setFindOpen] = useState(false)
  const [draftPath, setDraftPath] = useState(() => resolvedPathFor(chain, network, settings))
  const [saving, setSaving] = useState(false)

  const lockedPath = useMemo(() => resolvedPathFor(chain, network, settings), [settings, chain, network])

  // Keep the editor in sync when Find my funds (or another chain) updates settings
  useEffect(() => {
    setDraftPath(lockedPath)
  }, [lockedPath])

  const summary = useMemo(
    () => ({
      profileId: profileLabelId(chain, settings),
      index: displayIndex(settings)
    }),
    [settings, chain]
  )

  const trimmed = draftPath.trim()
  const pathValid = trimmed.length > 0 && validateDerivationPath(trimmed).valid
  const dirty = trimmed !== lockedPath
  const canSave = pathValid && dirty && !saving
  const pathWarn = pathValid && trimmed.length > 0 ? warnDerivationPath(trimmed, chain, network) : undefined

  const savePath = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const next = settingsFromCustomPath(trimmed)
      // BTC dual clients need a matching hdMode tag
      if (chain === BTCChain) {
        next.hdMode = trimmed.includes("86'") ? 'p2tr' : 'p2wpkh'
      }
      await setKeystoreChainHDSettings(chain, next)
      reloadBalancesByChain(chain, WalletType.Keystore)()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-10px flex flex-col gap-1 px-40px">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Label size="small" color="gray" className="!w-auto !p-0">
          {summary.index != null && (
            <>
              {intl.formatMessage({ id: 'settings.wallet.index' })} {summary.index}
              {' · '}
            </>
          )}
          {intl.formatMessage({ id: summary.profileId })}
        </Label>
        <TextButton className="!p-0 text-sm text-turquoise" onClick={() => setFindOpen(true)}>
          {intl.formatMessage({ id: 'settings.wallet.hd.find.action' })}
        </TextButton>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={draftPath}
          onChange={(e) => setDraftPath(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSave) {
              e.preventDefault()
              void savePath()
            }
          }}
          spellCheck={false}
          autoComplete="off"
          aria-label={intl.formatMessage({ id: 'settings.wallet.hd.customPath' })}
          aria-invalid={trimmed.length > 0 && !pathValid}
          aria-describedby={trimmed.length > 0 && !pathValid ? 'hd-inline-path-error' : undefined}
          className={clsx(
            'min-w-0 flex-1 rounded border bg-bg0 px-2 py-1 font-mono text-[11px] tracking-[0.42px] text-text2 focus:outline-hidden dark:bg-bg0d dark:text-text2d',
            trimmed.length > 0 && !pathValid ? 'border-error0 dark:border-error0d' : 'border-gray0 dark:border-gray0d'
          )}
        />
        <TextButton
          className="!shrink-0 !p-0 text-sm text-turquoise disabled:opacity-40"
          disabled={!canSave}
          onClick={() => void savePath()}>
          {intl.formatMessage({ id: 'settings.wallet.hd.path.save' })}
        </TextButton>
      </div>

      {trimmed.length > 0 && !pathValid && (
        <p id="hd-inline-path-error" className="text-[11px] tracking-[0.42px] text-error0 dark:text-error0d">
          {intl.formatMessage({ id: 'settings.wallet.hd.customPath.invalid' })}
        </p>
      )}
      {pathWarn && (
        <Label size="small" color="warning" className="!w-auto !p-0">
          {pathWarn}
        </Label>
      )}

      <KeystoreFindFundsModal open={findOpen} chain={chain} network={network} onClose={() => setFindOpen(false)} />
    </div>
  )
}
