import * as RD from '@devexperts/remote-data-ts'
import type { AnyAsset } from '@xchainjs/xchain-util'
import type { UTXO } from '@xchainjs/xchain-utxo-providers'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import type { UTXOsRD } from '../../../../../services/utxo/coinControl'
import { UTXOListItem } from './UTXOListItem'

type Props = {
  utxosRD: UTXOsRD
  asset: AnyAsset
  selectedUtxos: UTXO[]
  disabled: boolean
  onToggle: (utxo: UTXO) => void
}

export const UTXOList = ({ utxosRD, asset, selectedUtxos, disabled, onToggle }: Props): JSX.Element => {
  const intl = useIntl()

  const isSelected = (utxo: UTXO): boolean => selectedUtxos.some((s) => s.hash === utxo.hash && s.index === utxo.index)

  return FP.pipe(
    utxosRD,
    RD.fold(
      () => <></>,
      () => (
        <div className="flex items-center justify-center py-4">
          <span className="text-sm text-gray2 dark:text-gray2d">{intl.formatMessage({ id: 'common.loading' })}</span>
        </div>
      ),
      (error) => (
        <div className="flex items-center justify-center py-4">
          <span className="text-sm text-error0 dark:text-error0d">{error.message}</span>
        </div>
      ),
      (utxos) => {
        if (utxos.length === 0) {
          return (
            <div className="flex items-center justify-center py-4">
              <span className="text-sm text-gray2 dark:text-gray2d">{intl.formatMessage({ id: 'common.noData' })}</span>
            </div>
          )
        }

        return (
          <div className="flex max-h-[240px] flex-col gap-1.5 overflow-y-auto">
            {utxos.map((utxo) => (
              <UTXOListItem
                key={`${utxo.hash}:${utxo.index}`}
                utxo={utxo}
                asset={asset}
                selected={isSelected(utxo)}
                disabled={disabled}
                onToggle={onToggle}
              />
            ))}
          </div>
        )
      }
    )
  )
}
