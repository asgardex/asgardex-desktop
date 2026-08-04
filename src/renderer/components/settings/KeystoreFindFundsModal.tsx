import { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AssetETH } from '@xchainjs/xchain-ethereum'
import { baseToAsset, Chain, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as RxOp from 'rxjs/operators'

import { DEFAULT_ETH_RPC_URLS } from '../../../shared/ethereum/const'
import { candidateKey } from '../../../shared/utils/keystoreHdScan'
import { DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS, WalletType } from '../../../shared/wallet/types'
import { useWalletContext } from '../../contexts/WalletContext'
import { ethRpc$ } from '../../services/storage/common'
import { KeystoreHdScanHit, scanKeystoreFunds$ } from '../../services/wallet/keystoreHdScan'
import { keystoreChainHDSettings$, setKeystoreChainHDSettings } from '../../services/wallet/keystoreHDSettings'
import { getPhrase } from '../../services/wallet/util'
import { FlatButton, TextButton } from '../uielements/button'
import { Label } from '../uielements/label'
import { Modal } from '../uielements/modal'
import { Spin } from '../uielements/spin'

type Props = {
  open: boolean
  chain: Chain
  network: Network
  onClose: () => void
}

const modeMessageId = (modeLabel: KeystoreHdScanHit['modeLabel']) => {
  switch (modeLabel) {
    case 'standard':
      return 'settings.wallet.hd.mode.standard' as const
    case 'metamask':
      return 'settings.wallet.hd.mode.metamask' as const
    case 'legacy':
      return 'settings.wallet.hd.mode.legacy' as const
  }
}

/**
 * Scan common HD paths for native funds, then lock the selected path for this chain.
 */
export const KeystoreFindFundsModal = ({ open, chain, network, onClose }: Props): JSX.Element => {
  const intl = useIntl()
  const { keystoreService, reloadBalancesByChain } = useWalletContext()
  const keystoreState = useObservableState(keystoreService.keystoreState$, O.none)
  const currentSettings = useObservableState(keystoreChainHDSettings$(chain), DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS)
  const ethRpcUrls = useObservableState(ethRpc$, DEFAULT_ETH_RPC_URLS)

  const [scanRD, setScanRD] = useState<RD.RemoteData<Error, KeystoreHdScanHit[]>>(RD.initial)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const phrase = useMemo(() => FP.pipe(getPhrase(keystoreState), O.toNullable), [keystoreState])
  const rpcUrl = ethRpcUrls[network] || DEFAULT_ETH_RPC_URLS[network]

  const runScan = useCallback(() => {
    if (!phrase) {
      setScanRD(RD.failure(new Error(intl.formatMessage({ id: 'settings.wallet.hd.find.locked' }))))
      return
    }
    setScanRD(RD.pending)
    setSelectedKey(null)
    const sub = scanKeystoreFunds$(chain, phrase, network, rpcUrl)
      .pipe(RxOp.take(1))
      .subscribe({
        next: (hits) => {
          setScanRD(RD.success(hits))
          // Preselect current settings if present, else first funded, else first row
          const currentKey = candidateKey({ settings: currentSettings })
          const currentHit = hits.find((h) => h.key === currentKey && h.address)
          const funded = hits.find((h) => h.hasFunds && h.address)
          const firstOk = hits.find((h) => h.address)
          setSelectedKey(currentHit?.key ?? funded?.key ?? firstOk?.key ?? null)
        },
        error: (e: Error) => setScanRD(RD.failure(e))
      })
    return () => sub.unsubscribe()
  }, [phrase, chain, network, rpcUrl, intl, currentSettings])

  useEffect(() => {
    if (!open) {
      setScanRD(RD.initial)
      setSelectedKey(null)
      return
    }
    return runScan()
  }, [open, runScan])

  const hits = RD.isSuccess(scanRD) ? scanRD.value : []
  const selected = hits.find((h) => h.key === selectedKey)

  const applySelection = () => {
    if (!selected?.address) return
    setKeystoreChainHDSettings(chain, selected.settings)
    reloadBalancesByChain(chain, WalletType.Keystore)()
    onClose()
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
        <Label size="small" color="gray" className="!w-auto !p-0">
          {intl.formatMessage({ id: 'settings.wallet.hd.find.subtitle' })}
        </Label>
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
            <TextButton className="mt-2" onClick={runScan}>
              {intl.formatMessage({ id: 'common.reload' })}
            </TextButton>
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
                    <button
                      key={hit.key}
                      type="button"
                      onClick={() => setSelectedKey(hit.key)}
                      className={clsx(
                        'flex w-full flex-col gap-0.5 border-b border-gray0 px-3 py-2.5 text-left last:border-b-0 dark:border-gray0d',
                        selectedRow ? 'bg-turquoise/10 dark:bg-turquoise/15' : 'hover:bg-bg1 dark:hover:bg-bg1d'
                      )}>
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="truncate font-main text-sm text-text0 dark:text-text0d">{hit.address}</span>
                        <span
                          className={clsx(
                            'shrink-0 text-sm font-medium',
                            hit.hasFunds ? 'text-turquoise' : 'text-text2 dark:text-text2d'
                          )}>
                          {hit.hasFunds
                            ? formatAssetAmountCurrency({
                                amount: baseToAsset(hit.amount),
                                asset: AssetETH,
                                trimZeros: true,
                                decimal: 6
                              })
                            : intl.formatMessage({ id: 'settings.wallet.hd.find.empty' })}
                        </span>
                      </div>
                      <span className="text-xs text-text2 dark:text-text2d">
                        {intl.formatMessage({ id: 'settings.wallet.account' })} {hit.accountLabel}
                        {' · '}
                        {intl.formatMessage({ id: modeMessageId(hit.modeLabel) })}
                        {hit.error ? ` · ${hit.error}` : ''}
                      </span>
                    </button>
                  )
                })}
            </div>
          </>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <TextButton onClick={onClose}>{intl.formatMessage({ id: 'common.cancel' })}</TextButton>
          <FlatButton color="primary" disabled={!selected?.address || RD.isPending(scanRD)} onClick={applySelection}>
            {intl.formatMessage({ id: 'settings.wallet.hd.find.use' })}
          </FlatButton>
        </div>
      </div>
    </Modal>
  )
}
