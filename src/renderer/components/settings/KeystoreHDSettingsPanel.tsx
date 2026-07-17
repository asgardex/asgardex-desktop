import { useCallback, useState } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { Chain } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { EvmHDMode } from '../../../shared/evm/types'
import { getChainDerivationPath } from '../../../shared/utils/derivationPath'
import { validateDerivationPath, warnDerivationPath } from '../../../shared/utils/derivationPathValidation'
import { DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS, KeystoreChainHDSettings, WalletType } from '../../../shared/wallet/types'
import { useWalletContext } from '../../contexts/WalletContext'
import { Messages } from '../../i18n/types'
import { keystoreChainHDSettings$, setKeystoreChainHDSettings } from '../../services/wallet/keystoreHDSettings'
import { Label } from '../uielements/label'
import { WalletIndexInput } from './WalletIndexInput'

const ACCOUNTS_SHOWN = 5

// EVM script "standards", humanized. `ledgerlive` is the app's historical
// default so it's presented as "Standard".
const EVM_MODES: { mode: EvmHDMode; labelId: keyof Messages }[] = [
  { mode: 'ledgerlive', labelId: 'settings.wallet.hd.mode.standard' },
  { mode: 'legacy', labelId: 'settings.wallet.hd.mode.legacy' },
  { mode: 'metamask', labelId: 'settings.wallet.hd.mode.metamask' }
]

type Props = {
  chain: Chain
  network: Network
  /** Show the EVM script-standard selector under Advanced. */
  isEvm?: boolean
}

/**
 * Keystore HD address selector, framed around "Accounts" rather than raw
 * derivation jargon. Everyday users just pick an account; the derivation
 * standard + custom path live under "Advanced" (only needed to match an address
 * shown by another wallet). Writes are scoped to the active keystore and reload
 * the chain's balances so the address + balances update live.
 */
export const KeystoreHDSettingsPanel = ({ chain, network, isEvm = false }: Props) => {
  const intl = useIntl()
  const { reloadBalancesByChain } = useWalletContext()
  const settings = useObservableState(keystoreChainHDSettings$(chain), DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS)

  const [accountOpen, setAccountOpen] = useState(false)
  const [customDraft, setCustomDraft] = useState(settings.customPath ?? '')

  const update = useCallback(
    (patch: Partial<KeystoreChainHDSettings>) => {
      setKeystoreChainHDSettings(chain, { ...settings, ...patch })
      reloadBalancesByChain(chain, WalletType.Keystore)()
    },
    [settings, chain, reloadBalancesByChain]
  )

  const pickAccount = (account: number) => {
    update({ account, customPath: undefined })
    setCustomDraft('')
    setAccountOpen(false)
  }

  const applyCustomPath = () => {
    const p = customDraft.trim()
    if (p.length === 0) {
      update({ customPath: undefined })
      return
    }
    if (validateDerivationPath(p).valid) update({ customPath: p })
  }

  const usingCustom = !!settings.customPath
  const activeMode: EvmHDMode = settings.hdMode === 'default' ? 'ledgerlive' : (settings.hdMode as EvmHDMode)
  const accountLabel = usingCustom
    ? intl.formatMessage({ id: 'settings.wallet.hd.customPath' })
    : `${intl.formatMessage({ id: 'settings.wallet.account' })} ${settings.account + 1}`
  const effectivePath =
    settings.customPath ??
    getChainDerivationPath(chain, settings.account, settings.index, network, settings.hdMode).path

  const customTrimmed = customDraft.trim()
  const customValid = customTrimmed.length === 0 || validateDerivationPath(customTrimmed).valid
  const customWarn =
    customTrimmed.length > 0 && customValid ? warnDerivationPath(customTrimmed, chain, network) : undefined

  return (
    <div className="mt-10px flex flex-col gap-3 px-40px">
      {/* Accounts selector */}
      <div className="relative w-full max-w-[260px]">
        <button
          type="button"
          onClick={() => setAccountOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-lg border border-gray0 bg-bg1 px-3 py-2 text-text0 dark:border-gray0d dark:bg-bg1d dark:text-text0d">
          <span className="font-medium">{accountLabel}</span>
          <span className="text-text2 dark:text-text2d">▾</span>
        </button>
        {accountOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setAccountOpen(false)} />
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray0 bg-bg0 shadow-lg dark:border-gray0d dark:bg-bg0d">
              {Array.from({ length: ACCOUNTS_SHOWN }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickAccount(i)}
                  className={clsx(
                    'block w-full px-3 py-2 text-left hover:bg-gray0/20 dark:hover:bg-gray0d/20',
                    !usingCustom && settings.account === i ? 'text-turquoise' : 'text-text0 dark:text-text0d'
                  )}>
                  {intl.formatMessage({ id: 'settings.wallet.account' })} {i + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={() => pickAccount(settings.account + 1)}
                className="block w-full border-t border-gray0 px-3 py-2 text-left font-medium text-turquoise dark:border-gray0d">
                {intl.formatMessage({ id: 'settings.wallet.hd.addAccount' })}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Advanced — only needed to match another wallet */}
      <details className="text-sm">
        <summary className="cursor-pointer text-text2 select-none dark:text-text2d">
          {intl.formatMessage({ id: 'common.advanced' })}
        </summary>
        <div className="mt-2 flex flex-col gap-3 rounded-lg border border-gray0 p-3 dark:border-gray0d">
          {isEvm && (
            <div>
              <div className="mb-1 text-text1 dark:text-text1d">
                {intl.formatMessage({ id: 'settings.wallet.hd.standard' })}
                <span className="ml-1 text-text2 dark:text-text2d">
                  — {intl.formatMessage({ id: 'settings.wallet.hd.standardHint' })}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {EVM_MODES.map(({ mode, labelId }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => update({ hdMode: mode, customPath: undefined })}
                    className={clsx(
                      'rounded-lg border px-2 py-0.5',
                      !usingCustom && activeMode === mode
                        ? 'border-turquoise text-turquoise'
                        : 'border-gray0 text-text2 dark:border-gray0d dark:text-text2d'
                    )}>
                    {intl.formatMessage({ id: labelId })}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-text1 dark:text-text1d">{intl.formatMessage({ id: 'settings.wallet.index' })}</span>
            <WalletIndexInput
              className="w-16"
              value={settings.index}
              onChange={(v) => update({ index: Math.max(0, v ?? 0) })}
            />
          </div>

          <div>
            <div className="mb-1 text-text1 dark:text-text1d">
              {intl.formatMessage({ id: 'settings.wallet.hd.customPath' })}
            </div>
            <input
              value={customDraft}
              onChange={(e) => setCustomDraft(e.currentTarget.value)}
              onBlur={applyCustomPath}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyCustomPath()
              }}
              placeholder="m/44'/60'/0'/0/0"
              className={clsx(
                'w-[240px] rounded-lg border bg-bg1 px-2 py-1 font-mono text-text0 focus:outline-hidden dark:bg-bg1d dark:text-text0d',
                customValid ? 'border-gray0 dark:border-gray0d' : 'border-error0 dark:border-error0d'
              )}
            />
            {!customValid && (
              <div className="mt-1 text-error0 dark:text-error0d">
                {intl.formatMessage({ id: 'settings.wallet.hd.customPath.invalid' })}
              </div>
            )}
            {customWarn && <div className="mt-1 text-amber-600 dark:text-amber-400">{customWarn}</div>}
          </div>

          <Label className="!w-auto !p-0 font-mono text-text2 dark:text-text2d" size="small">
            {effectivePath}
          </Label>
        </div>
      </details>
    </div>
  )
}
