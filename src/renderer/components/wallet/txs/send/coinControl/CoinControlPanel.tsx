import { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Address, AnyAsset, Chain } from '@xchainjs/xchain-util'
import type { UTXO } from '@xchainjs/xchain-utxo-providers'
import { useIntl } from 'react-intl'

import { isKeystoreWallet } from '../../../../../../shared/utils/guard'
import { WalletType } from '../../../../../../shared/wallet/types'
import { utxosByChain$, UTXOsRD } from '../../../../../services/utxo/coinControl'
import {
  CoinControlStrategy,
  CoinControlState,
  INITIAL_COIN_CONTROL_STATE
} from '../../../../../services/utxo/coinControl.types'
import { Collapse } from '../../../../uielements/collapse/Collapse'
import { Label } from '../../../../uielements/label'
import { CoinControlSummary } from './CoinControlSummary'
import { StrategySelector } from './StrategySelector'
import { UTXOList } from './UTXOList'

type Props = {
  chain: Chain
  asset: AnyAsset
  address: Address
  walletType: WalletType
  disabled: boolean
  targetAmount?: number
  onChange: (state: CoinControlState) => void
}

export const CoinControlPanel = ({
  chain,
  asset,
  address,
  walletType,
  disabled,
  targetAmount,
  onChange
}: Props): JSX.Element => {
  const intl = useIntl()

  const [isOpen, setIsOpen] = useState(false)
  const [strategy, setStrategy] = useState<CoinControlStrategy>(CoinControlStrategy.AUTO)
  const [selectedUtxos, setSelectedUtxos] = useState<UTXO[]>([])
  const [utxosRD, setUtxosRD] = useState<UTXOsRD>(RD.initial)

  const isManual = strategy === CoinControlStrategy.MANUAL
  const manualDisabled = !isKeystoreWallet(walletType)

  // Fetch UTXOs when panel is opened
  useEffect(() => {
    if (!isOpen || !address) return

    const subscription = utxosByChain$(chain, address).subscribe(setUtxosRD)
    return () => subscription.unsubscribe()
  }, [isOpen, chain, address])

  // Notify parent of state changes
  useEffect(() => {
    if (!isOpen) {
      onChange(INITIAL_COIN_CONTROL_STATE)
      return
    }

    onChange({
      strategy,
      selectedUtxos: isManual ? selectedUtxos : [],
      isEnabled: true
    })

    // We intentionally don't include onChange in deps to avoid re-render loop.
    // The parent sets onChange via useCallback and it stays stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, strategy, selectedUtxos, isManual])

  const handleStrategyChange = useCallback((newStrategy: CoinControlStrategy) => {
    setStrategy(newStrategy)
    if (newStrategy !== CoinControlStrategy.MANUAL) {
      setSelectedUtxos([])
    }
  }, [])

  const handleUtxoToggle = useCallback((utxo: UTXO) => {
    setSelectedUtxos((prev) => {
      const exists = prev.some((s) => s.hash === utxo.hash && s.index === utxo.index)
      return exists ? prev.filter((s) => !(s.hash === utxo.hash && s.index === utxo.index)) : [...prev, utxo]
    })
  }, [])

  const utxoCount = useMemo(
    () =>
      RD.fold(
        () => 0,
        () => 0,
        () => 0,
        (utxos: UTXO[]) => utxos.length
      )(utxosRD),
    [utxosRD]
  )

  const header = (
    <Label size="big" color="gray" textTransform="uppercase">
      {intl.formatMessage({ id: 'wallet.send.coinControl' })}
      {isOpen && utxoCount > 0 ? ` (${utxoCount})` : ''}
    </Label>
  )

  return (
    <div className="mt-2">
      <Collapse header={header} isOpen={isOpen} onToggle={() => setIsOpen((prev) => !prev)}>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <StrategySelector
            strategy={strategy}
            onChange={handleStrategyChange}
            manualDisabled={manualDisabled}
            disabled={disabled}
          />

          {isManual && (
            <UTXOList
              utxosRD={utxosRD}
              asset={asset}
              selectedUtxos={selectedUtxos}
              disabled={disabled}
              onToggle={handleUtxoToggle}
            />
          )}

          {isManual && selectedUtxos.length > 0 && (
            <CoinControlSummary selectedUtxos={selectedUtxos} asset={asset} targetAmount={targetAmount} />
          )}
        </div>
      </Collapse>
    </div>
  )
}
