import { useIntl } from 'react-intl'

import { CoinControlStrategy } from '../../../../../services/utxo/coinControl.types'
import { Label } from '../../../../uielements/label'
import { Radio, RadioGroup } from '../../../../uielements/radio'

type Props = {
  strategy: CoinControlStrategy
  onChange: (strategy: CoinControlStrategy) => void
  disabled: boolean
}

const STRATEGY_I18N: Record<CoinControlStrategy, string> = {
  [CoinControlStrategy.AUTO]: 'wallet.send.coinControl.auto',
  [CoinControlStrategy.MANUAL]: 'wallet.send.coinControl.manual',
  [CoinControlStrategy.MINIMIZE_FEE]: 'wallet.send.coinControl.minimizeFee',
  [CoinControlStrategy.LARGEST_FIRST]: 'wallet.send.coinControl.largestFirst',
  [CoinControlStrategy.SMALLEST_FIRST]: 'wallet.send.coinControl.smallestFirst'
}

export const StrategySelector = ({ strategy, onChange, disabled }: Props): JSX.Element => {
  const intl = useIntl()

  return (
    <div className="flex flex-col gap-2">
      <Label size="big" color="gray" textTransform="uppercase">
        {intl.formatMessage({ id: 'wallet.send.coinControl.strategy' })}
      </Label>
      <RadioGroup className="flex flex-row flex-wrap gap-2" value={strategy} onChange={onChange} disabled={disabled}>
        {Object.values(CoinControlStrategy).map((s) => (
          <Radio value={s} key={s}>
            <Label disabled={disabled} textTransform="uppercase">
              {intl.formatMessage({ id: STRATEGY_I18N[s] })}
            </Label>
          </Radio>
        ))}
      </RadioGroup>
    </div>
  )
}
