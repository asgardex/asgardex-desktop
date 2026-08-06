import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AssetBTC, BTCChain } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { AssetETH, ETHChain } from '@xchainjs/xchain-ethereum'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset, baseToAsset, Chain, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { DEFAULT_ETH_RPC_URLS } from '../../../shared/ethereum/const'
import { DEFAULT_THORNODE_RPC_URLS } from '../../../shared/thorchain/const'
import { getChainDerivationPath } from '../../../shared/utils/derivationPath'
import { validateDerivationPath, warnDerivationPath } from '../../../shared/utils/derivationPathValidation'
import { candidateKey, HdScanProfile } from '../../../shared/utils/keystoreHdScan'
import { DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS, WalletType } from '../../../shared/wallet/types'
import { useWalletContext } from '../../contexts/WalletContext'
import { ethRpc$, thornodeRpc$ } from '../../services/storage/common'
import {
  checkCustomPath,
  defaultRpcUrlForChain,
  KeystoreHdScanHit,
  scanKeystoreFunds$
} from '../../services/wallet/keystoreHdScan'
import { truncateAddress } from '../../helpers/addressHelper'
import { keystoreChainHDSettings$, setKeystoreChainHDSettings } from '../../services/wallet/keystoreHDSettings'
import { getPhrase } from '../../services/wallet/util'
import { FlatButton, TextButton } from '../uielements/button'
import { CopyLabel, Label } from '../uielements/label'
import { Modal } from '../uielements/modal'
import { Spin } from '../uielements/spin'

type Props = {
  open: boolean
  chain: Chain
  network: Network
  onClose: () => void
}

type Step = 'pick' | 'results' | 'custom'

type ProfileOption = Exclude<HdScanProfile, 'custom'>

type ProfileCard = { id: ProfileOption; titleId: string; hintId: string }

const EVM_PROFILES: ProfileCard[] = [
  {
    id: 'metamask',
    titleId: 'settings.wallet.hd.profile.metamask',
    hintId: 'settings.wallet.hd.profile.metamask.hint'
  },
  {
    id: 'ledgerlive',
    titleId: 'settings.wallet.hd.profile.ledgerlive',
    hintId: 'settings.wallet.hd.profile.ledgerlive.hint'
  },
  {
    id: 'legacy',
    titleId: 'settings.wallet.hd.profile.legacy',
    hintId: 'settings.wallet.hd.profile.legacy.hint'
  }
]

const THOR_PROFILES: ProfileCard[] = [
  {
    id: 'thor',
    titleId: 'settings.wallet.hd.profile.thor',
    hintId: 'settings.wallet.hd.profile.thor.hint'
  }
]

const BTC_PROFILES: ProfileCard[] = [
  {
    id: 'p2wpkh',
    titleId: 'settings.wallet.hd.profile.p2wpkh',
    hintId: 'settings.wallet.hd.profile.p2wpkh.hint'
  },
  {
    id: 'p2tr',
    titleId: 'settings.wallet.hd.profile.p2tr',
    hintId: 'settings.wallet.hd.profile.p2tr.hint'
  }
]

const profilesForChain = (chain: Chain): ProfileCard[] => {
  if (chain === ETHChain) return EVM_PROFILES
  if (chain === THORChain) return THOR_PROFILES
  if (chain === BTCChain) return BTC_PROFILES
  return []
}

const defaultProfileForChain = (chain: Chain): ProfileOption => {
  if (chain === THORChain) return 'thor'
  if (chain === BTCChain) return 'p2wpkh'
  return 'metamask'
}

const nativeAssetForChain = (chain: Chain): AnyAsset | undefined => {
  if (chain === ETHChain) return AssetETH
  if (chain === THORChain) return AssetRuneNative
  if (chain === BTCChain) return AssetBTC
  return undefined
}

/** Default full path for a chain (account 0 / index 0, standard formula). */
const defaultCustomPath = (chain: Chain, network: Network): string => {
  if (chain === THORChain) return getChainDerivationPath(chain, 0, 0, network).path
  if (chain === BTCChain) return getChainDerivationPath(chain, 0, 0, network, 'p2wpkh').path
  return getChainDerivationPath(chain, 0, 0, network, 'ledgerlive').path
}

/** Prefill editor with current locked path if any, else chain default. */
const initialCustomPath = (
  chain: Chain,
  network: Network,
  settings: { customPath?: string; account: number; index: number; hdMode: string }
): string => {
  if (settings.customPath?.trim()) return settings.customPath.trim()
  return getChainDerivationPath(
    chain,
    settings.account,
    settings.index,
    network,
    settings.hdMode as 'default' | 'p2wpkh' | 'p2tr' | 'ledgerlive' | 'metamask' | 'legacy'
  ).path
}

/**
 * Narrow HD recovery: pick wallet profile (≤5 paths) or custom path → lock selection.
 * ETH / THOR / BTC keystore recovery.
 */
export const KeystoreFindFundsModal = ({ open, chain, network, onClose }: Props): JSX.Element => {
  const intl = useIntl()
  const { keystoreService, reloadBalancesByChain } = useWalletContext()
  const keystoreState = useObservableState(keystoreService.keystoreState$, O.none)
  const currentSettings = useObservableState(keystoreChainHDSettings$(chain), DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS)
  const ethRpcUrls = useObservableState(ethRpc$, DEFAULT_ETH_RPC_URLS)
  const thorRpcUrls = useObservableState(thornodeRpc$, DEFAULT_THORNODE_RPC_URLS)

  const profiles = useMemo(() => profilesForChain(chain), [chain])
  const [step, setStep] = useState<Step>('pick')
  const [profile, setProfile] = useState<ProfileOption>(() => defaultProfileForChain(chain))
  const [scanRD, setScanRD] = useState<RD.RemoteData<Error, KeystoreHdScanHit[]>>(RD.initial)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const [customPath, setCustomPath] = useState('')
  const [customRD, setCustomRD] = useState<RD.RemoteData<Error, KeystoreHdScanHit>>(RD.initial)

  const scanSubRef = useRef<Rx.Subscription | null>(null)
  const customRunIdRef = useRef(0)

  const phrase = useMemo(() => FP.pipe(getPhrase(keystoreState), O.toNullable), [keystoreState])
  const rpcUrl = defaultRpcUrlForChain(
    chain,
    network,
    ethRpcUrls[network] || DEFAULT_ETH_RPC_URLS[network],
    thorRpcUrls[network] || DEFAULT_THORNODE_RPC_URLS[network] || DEFAULT_THORNODE_RPC_URLS.mainnet
  )

  const openCustomStep = useCallback(() => {
    setCustomPath(initialCustomPath(chain, network, currentSettings))
    setCustomRD(RD.initial)
    setStep('custom')
  }, [chain, network, currentSettings])

  const reset = useCallback(() => {
    scanSubRef.current?.unsubscribe()
    scanSubRef.current = null
    customRunIdRef.current += 1
    setStep('pick')
    setProfile(defaultProfileForChain(chain))
    setScanRD(RD.initial)
    setSelectedKey(null)
    setCustomPath(defaultCustomPath(chain, network))
    setCustomRD(RD.initial)
  }, [chain, network])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  useEffect(
    () => () => {
      scanSubRef.current?.unsubscribe()
      customRunIdRef.current += 1
    },
    []
  )

  const runProfileScan = useCallback(
    (p: ProfileOption) => {
      if (!phrase) {
        setScanRD(RD.failure(new Error(intl.formatMessage({ id: 'settings.wallet.hd.find.locked' }))))
        return
      }
      setStep('results')
      setScanRD(RD.pending)
      setSelectedKey(null)
      scanSubRef.current?.unsubscribe()
      scanSubRef.current = scanKeystoreFunds$(chain, phrase, network, rpcUrl, p)
        .pipe(RxOp.take(1))
        .subscribe({
          next: (hits) => {
            setScanRD(RD.success(hits))
            const currentKey = candidateKey({ settings: currentSettings })
            const currentHit = hits.find((h) => h.key === currentKey && h.address)
            const funded = hits.find((h) => h.hasFunds && h.address)
            const firstOk = hits.find((h) => h.address)
            setSelectedKey(currentHit?.key ?? funded?.key ?? firstOk?.key ?? null)
          },
          error: (e: Error) => setScanRD(RD.failure(e))
        })
    },
    [phrase, chain, network, rpcUrl, intl, currentSettings]
  )

  const runCustomCheck = useCallback(() => {
    const path = customPath.trim()
    if (!phrase) {
      setCustomRD(RD.failure(new Error(intl.formatMessage({ id: 'settings.wallet.hd.find.locked' }))))
      return
    }
    if (!validateDerivationPath(path).valid) {
      setCustomRD(RD.failure(new Error(intl.formatMessage({ id: 'settings.wallet.hd.customPath.invalid' }))))
      return
    }
    setCustomRD(RD.pending)
    const runId = ++customRunIdRef.current
    checkCustomPath(chain, phrase, network, rpcUrl, path)
      .then((hit) => {
        if (runId === customRunIdRef.current) setCustomRD(RD.success(hit))
      })
      .catch((e: Error) => {
        if (runId === customRunIdRef.current) setCustomRD(RD.failure(e))
      })
  }, [customPath, phrase, chain, network, rpcUrl, intl])

  const applyHit = async (hit: KeystoreHdScanHit) => {
    if (!hit.address) return
    await setKeystoreChainHDSettings(chain, hit.settings)
    reloadBalancesByChain(chain, WalletType.Keystore)()
    onClose()
  }

  const hits = RD.isSuccess(scanRD) ? scanRD.value : []
  const selected = hits.find((h) => h.key === selectedKey)
  const customTrimmed = customPath.trim()
  const customValid = customTrimmed.length === 0 || validateDerivationPath(customTrimmed).valid
  const customWarn =
    customTrimmed.length > 0 && customValid ? warnDerivationPath(customTrimmed, chain, network) : undefined
  const displayAsset = nativeAssetForChain(chain)

  const formatHitBalance = (hit: KeystoreHdScanHit) => {
    if (!hit.hasFunds) return intl.formatMessage({ id: 'settings.wallet.hd.find.empty' })
    if (displayAsset) {
      return formatAssetAmountCurrency({
        amount: baseToAsset(hit.amount),
        asset: displayAsset,
        trimZeros: true,
        decimal: 6
      })
    }
    return `${hit.amount.amount().toString()} ${hit.assetTicker}`
  }

  return (
    <Modal
      visible={open}
      title={intl.formatMessage({ id: 'settings.wallet.hd.find.title' })}
      onCancel={onClose}
      footer={false}
      panelClassName="max-w-xl"
      closable>
      <div className="flex flex-col gap-3 px-4 pb-4">
        {step === 'pick' && (
          <>
            <Label size="small" color="gray" className="!w-auto !p-0">
              {intl.formatMessage({ id: 'settings.wallet.hd.find.pickSubtitle' })}
            </Label>
            <div className="flex flex-col gap-2">
              {profiles.map(({ id, titleId, hintId }) => {
                const active = profile === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setProfile(id)}
                    className={clsx(
                      'rounded-lg border px-3 py-2.5 text-left',
                      active
                        ? 'border-turquoise bg-turquoise/10 dark:bg-turquoise/15'
                        : 'border-gray0 hover:bg-bg1 dark:border-gray0d dark:hover:bg-bg1d'
                    )}>
                    <div className="font-medium text-text0 dark:text-text0d">
                      {intl.formatMessage({ id: titleId as 'settings.wallet.hd.profile.metamask' })}
                    </div>
                    <div className="text-xs text-text2 dark:text-text2d">
                      {intl.formatMessage({ id: hintId as 'settings.wallet.hd.profile.metamask.hint' })}
                    </div>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={openCustomStep}
                className="rounded-lg border border-gray0 px-3 py-2.5 text-left hover:bg-bg1 dark:border-gray0d dark:hover:bg-bg1d">
                <div className="font-medium text-text0 dark:text-text0d">
                  {intl.formatMessage({ id: 'settings.wallet.hd.profile.custom' })}
                </div>
                <div className="text-xs text-text2 dark:text-text2d">
                  {intl.formatMessage({ id: 'settings.wallet.hd.profile.custom.hint' })}
                </div>
              </button>
            </div>
            <div className="mt-1 flex justify-end gap-2">
              <TextButton onClick={onClose}>{intl.formatMessage({ id: 'common.cancel' })}</TextButton>
              <FlatButton color="primary" onClick={() => runProfileScan(profile)} disabled={profiles.length === 0}>
                {intl.formatMessage({ id: 'settings.wallet.hd.find.scan' })}
              </FlatButton>
            </div>
          </>
        )}

        {step === 'results' && (
          <>
            <Label size="small" color="gray" className="!w-auto !p-0">
              {intl.formatMessage({ id: 'settings.wallet.hd.find.nativeOnly' })}
            </Label>

            {RD.isPending(scanRD) && (
              <div className="flex flex-col items-center gap-2 py-8">
                <Spin />
                <Label size="small" className="!w-auto !p-0">
                  {intl.formatMessage({ id: 'settings.wallet.hd.find.scanning' })}
                </Label>
              </div>
            )}

            {RD.isFailure(scanRD) && (
              <div className="rounded-lg border border-error0 p-3 dark:border-error0d">
                <Label color="error" className="!w-auto !p-0">
                  {scanRD.error.message}
                </Label>
              </div>
            )}

            {RD.isSuccess(scanRD) && (
              <>
                {hits.filter((h) => h.hasFunds).length === 0 && (
                  <Label size="small" color="gray" className="!w-auto !p-0">
                    {intl.formatMessage({ id: 'settings.wallet.hd.find.noneFound' })}
                  </Label>
                )}
                <div className="max-h-80 overflow-y-auto rounded-lg border border-gray0 dark:border-gray0d">
                  {hits
                    .filter((h) => h.address)
                    .map((hit) => {
                      const selectedRow = hit.key === selectedKey
                      return (
                        <div
                          key={hit.key}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedKey(hit.key)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedKey(hit.key)
                            }
                          }}
                          className={clsx(
                            'flex w-full cursor-pointer flex-col gap-0.5 border-b border-gray0 px-3 py-2.5 text-left last:border-b-0 dark:border-gray0d',
                            selectedRow ? 'bg-turquoise/10 dark:bg-turquoise/15' : 'hover:bg-bg1 dark:hover:bg-bg1d'
                          )}>
                          <div className="flex w-full items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="font-main text-sm text-text0 dark:text-text0d" title={hit.address}>
                                {truncateAddress(hit.address, chain, network)}
                              </span>
                              <span
                                className="shrink-0"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}>
                                <CopyLabel iconClassName="!h-4 !w-4 text-turquoise" textToCopy={hit.address} />
                              </span>
                            </span>
                            <span
                              className={clsx(
                                'shrink-0 text-sm font-medium',
                                hit.hasFunds ? 'text-turquoise' : 'text-text2 dark:text-text2d'
                              )}>
                              {formatHitBalance(hit)}
                            </span>
                          </div>
                          <span className="text-xs text-text2 dark:text-text2d">
                            {intl.formatMessage({ id: 'settings.wallet.index' })} {hit.settings.index}
                            {' · '}
                            <span className="font-mono opacity-80">{hit.path}</span>
                          </span>
                        </div>
                      )
                    })}
                </div>
              </>
            )}

            <div className="mt-1 flex justify-end gap-2">
              <TextButton
                onClick={() => {
                  setStep('pick')
                  setScanRD(RD.initial)
                }}>
                {intl.formatMessage({ id: 'common.back' })}
              </TextButton>
              <FlatButton
                color="primary"
                disabled={!selected?.address || RD.isPending(scanRD)}
                onClick={() => selected && applyHit(selected)}>
                {intl.formatMessage({ id: 'settings.wallet.hd.find.use' })}
              </FlatButton>
            </div>
          </>
        )}

        {step === 'custom' && (
          <>
            <Label size="small" color="gray" className="!w-auto !p-0">
              {intl.formatMessage({ id: 'settings.wallet.hd.profile.custom.hint' })}
            </Label>
            <input
              aria-label={intl.formatMessage({ id: 'settings.wallet.hd.customPath' })}
              aria-invalid={!customValid}
              aria-describedby={!customValid ? 'hd-custom-path-error' : undefined}
              value={customPath}
              onChange={(e) => {
                setCustomPath(e.currentTarget.value)
                setCustomRD(RD.initial)
              }}
              onFocus={(e) => {
                // Select all so a quick edit is easy; path stays editable (not placeholder-only)
                e.currentTarget.select()
              }}
              spellCheck={false}
              autoComplete="off"
              className={clsx(
                'w-full rounded-lg border bg-bg1 px-3 py-2 font-mono text-sm text-text0 focus:outline-hidden dark:bg-bg1d dark:text-text0d',
                customValid ? 'border-gray0 dark:border-gray0d' : 'border-error0 dark:border-error0d'
              )}
            />
            {!customValid && (
              <p id="hd-custom-path-error" className="text-[11px] tracking-[0.42px] text-error0 dark:text-error0d">
                {intl.formatMessage({ id: 'settings.wallet.hd.customPath.invalid' })}
              </p>
            )}
            {customWarn && (
              <Label size="small" color="warning" className="!w-auto !p-0">
                {customWarn}
              </Label>
            )}

            {RD.isPending(customRD) && (
              <div className="flex justify-center py-4">
                <Spin />
              </div>
            )}
            {RD.isFailure(customRD) && (
              <Label size="small" color="error" className="!w-auto !p-0">
                {customRD.error.message}
              </Label>
            )}
            {RD.isSuccess(customRD) && customRD.value.address && (
              <div className="rounded-lg border border-turquoise/40 bg-turquoise/5 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-main text-sm text-text0 dark:text-text0d" title={customRD.value.address}>
                    {truncateAddress(customRD.value.address, chain, network)}
                  </span>
                  <CopyLabel iconClassName="!h-4 !w-4 text-turquoise" textToCopy={customRD.value.address} />
                </div>
                <div className="text-xs text-text2 dark:text-text2d">{formatHitBalance(customRD.value)}</div>
              </div>
            )}

            <div className="mt-1 flex justify-end gap-2">
              <TextButton
                onClick={() => {
                  setStep('pick')
                  setCustomRD(RD.initial)
                }}>
                {intl.formatMessage({ id: 'common.back' })}
              </TextButton>
              <TextButton onClick={runCustomCheck} disabled={!customTrimmed || !customValid}>
                {intl.formatMessage({ id: 'settings.wallet.hd.find.check' })}
              </TextButton>
              <FlatButton
                color="primary"
                disabled={!RD.isSuccess(customRD) || !customRD.value.address}
                onClick={() => RD.isSuccess(customRD) && applyHit(customRD.value)}>
                {intl.formatMessage({ id: 'settings.wallet.hd.find.use' })}
              </FlatButton>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
