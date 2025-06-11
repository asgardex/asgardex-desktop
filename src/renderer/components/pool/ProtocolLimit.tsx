import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../shared/utils/asset'
import { LimitRD } from '../../hooks/useProtocolLimit'
import { Alert } from '../uielements/alert'

type Props = {
  limit: LimitRD
}

export const ProtocolLimit = ({ limit: limitRD }: Props) => {
  const intl = useIntl()

  const render = useMemo(() => {
    const empty = <></>
    return FP.pipe(
      limitRD,
      RD.fold(
        () => empty,
        () => empty,
        (_) => empty,
        ({ reached, totalActiveBondAmount, totalPooledRuneAmount }) => {
          const msg = intl.formatMessage(
            { id: 'pools.limit.info' },
            {
              pooled: formatAssetAmountCurrency({
                amount: baseToAsset(totalPooledRuneAmount),
                asset: AssetRuneNative,
                decimal: 0
              }),
              bonded: formatAssetAmountCurrency({
                amount: baseToAsset(totalActiveBondAmount),
                asset: AssetRuneNative,
                decimal: 0
              })
            }
          )

          return reached ? <Alert className="mb-[10px] lg:mb-5" type="error" message={msg} /> : empty
        }
      )
    )
  }, [limitRD, intl])

  return render
}
