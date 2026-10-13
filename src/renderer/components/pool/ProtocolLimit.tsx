import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { baseToAsset, Chain, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { AssetCacao, AssetRuneNative, THORChain } from '../../../shared/utils/chainIds'
import { LimitRD } from '../../hooks/useProtocolLimit'
import { Alert } from '../uielements/alert'

type Props = {
  limit: LimitRD
  protocol: Chain
}

export const ProtocolLimit = ({ limit: limitRD, protocol }: Props) => {
  const intl = useIntl()
  const asset = protocol === THORChain ? AssetRuneNative : AssetCacao

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
                asset,
                decimal: 0
              }),
              bonded: formatAssetAmountCurrency({
                amount: baseToAsset(totalActiveBondAmount),
                asset,
                decimal: 0
              })
            }
          )

          return reached ? <Alert className="mb-[10px] lg:mb-5" type="error" description={msg} /> : empty
        }
      )
    )
  }, [asset, limitRD, intl])

  return render
}
