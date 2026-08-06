import { useEffect, useMemo, useState } from 'react'

import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { getChainDerivationPath } from '../../../shared/utils/derivationPath'
import { isEvmHdScanChain, isUtxoStandardHdScanChain } from '../../../shared/utils/keystoreHdScan'
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
  if (isUtxoStandardHdScanChain(chain)) return 'settings.wallet.hd.profile.utxo' as const
  if (isEvmHdScanChain(chain)) {
    switch (settings.hdMode) {
      case 'metamask':
        return 'settings.wallet.hd.profile.metamask' as const
      case 'legacy':
        return 'settings.wallet.hd.profile.legacy' as const
      case 'ledgerlive':
      case 'default':
      default:
        return 'settings.wallet.hd.profile.metamask' as const
    }
  }
  return 'settings.wallet.hd.profile.custom' as const
}

const parseSlot = (raw: string, fallback: number): number => {
  if (raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return fallback
  return Math.min(n, 2_147_483_647)
}

/** Borderless numeric chip — hover / focus only. */
const slotInputClass =
  'w-11 rounded-md border-0 bg-transparent px-1 py-0.5 text-center font-mono text-[12px] tabular-nums text-text0 transition-colors hover:bg-bg2 focus:bg-turquoise/10 focus:outline-hidden focus:ring-1 focus:ring-turquoise/50 dark:text-text0d dark:hover:bg-bg2d dark:focus:bg-turquoise/15'

/**
 * Quiet keystore HD row: account + index only (path is a live preview).
 * Full custom BIP paths stay in Find my funds — not free-typed here.
 */
export const KeystoreHDSettingsPanel = ({ chain, network }: Props): JSX.Element => {
  const intl = useIntl()
  const { reloadBalancesByChain } = useWalletContext()
  const settings = useObservableState(keystoreChainHDSettings$(chain), DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS)
  const [findOpen, setFindOpen] = useState(false)
  const [draftAccount, setDraftAccount] = useState(String(settings.account))
  const [draftIndex, setDraftIndex] = useState(String(settings.index))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraftAccount(String(settings.account))
    setDraftIndex(String(settings.index))
  }, [settings.account, settings.index, settings.customPath, settings.hdMode])

  const account = parseSlot(draftAccount, settings.account)
  const index = parseSlot(draftIndex, settings.index)
  const hasCustom = !!settings.customPath?.trim()
  const slotsDirty = account !== settings.account || index !== settings.index
  // Save only when account/index changed — drops any custom path and uses the formula
  const saveEnabled = !saving && slotsDirty

  const previewPath = useMemo(() => {
    // Live formula from draft slots; if custom is locked and slots unchanged, show custom path
    if (hasCustom && !slotsDirty) return settings.customPath!.trim()
    return getChainDerivationPath(chain, account, index, network, settings.hdMode).path
  }, [hasCustom, slotsDirty, settings.customPath, settings.hdMode, chain, account, index, network])

  const saveSlots = async () => {
    if (!saveEnabled) return
    setSaving(true)
    try {
      await setKeystoreChainHDSettings(chain, {
        hdMode: settings.hdMode,
        account,
        index
        // customPath omitted — formula from account/index
      })
      reloadBalancesByChain(chain, WalletType.Keystore)()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-10px flex flex-col gap-1.5 px-40px">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Label size="small" color="gray" className="!w-auto !p-0">
          {intl.formatMessage({ id: profileLabelId(chain, settings) })}
        </Label>
        <TextButton className="!p-0 text-sm text-turquoise" onClick={() => setFindOpen(true)}>
          {intl.formatMessage({ id: 'settings.wallet.hd.find.action' })}
        </TextButton>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex items-center gap-1.5 text-[11px] tracking-[0.42px] text-text2 dark:text-text2d">
          {intl.formatMessage({ id: 'settings.wallet.account' })}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draftAccount}
            onChange={(e) => setDraftAccount(e.currentTarget.value.replace(/\D/g, ''))}
            onBlur={() => setDraftAccount(String(account))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && saveEnabled) {
                e.preventDefault()
                void saveSlots()
              }
            }}
            aria-label={intl.formatMessage({ id: 'settings.wallet.account' })}
            className={slotInputClass}
          />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] tracking-[0.42px] text-text2 dark:text-text2d">
          {intl.formatMessage({ id: 'settings.wallet.index' })}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draftIndex}
            onChange={(e) => setDraftIndex(e.currentTarget.value.replace(/\D/g, ''))}
            onBlur={() => setDraftIndex(String(index))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && saveEnabled) {
                e.preventDefault()
                void saveSlots()
              }
            }}
            aria-label={intl.formatMessage({ id: 'settings.wallet.index' })}
            className={slotInputClass}
          />
        </label>
        <TextButton
          className={clsx('!shrink-0 !p-0 text-sm text-turquoise', !saveEnabled && 'opacity-40')}
          disabled={!saveEnabled}
          onClick={() => void saveSlots()}>
          {intl.formatMessage({ id: 'settings.wallet.hd.path.save' })}
        </TextButton>
      </div>

      <Label size="small" color="gray" className="!w-auto !p-0 font-mono opacity-70">
        {previewPath}
      </Label>
      {hasCustom && !slotsDirty && (
        <Label size="small" color="gray" className="!w-auto !p-0 opacity-60">
          {intl.formatMessage({ id: 'settings.wallet.hd.path.customLocked' })}
        </Label>
      )}

      <KeystoreFindFundsModal open={findOpen} chain={chain} network={network} onClose={() => setFindOpen(false)} />
    </div>
  )
}
