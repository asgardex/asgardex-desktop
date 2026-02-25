import { useIntl } from 'react-intl'

import { CoinControlStrategy } from '../../../../../services/utxo/coinControl.types'
import { Label } from '../../../../uielements/label'
import { Radio, RadioGroup } from '../../../../uielements/radio'

type Props = {
  strategy: CoinControlStrategy
  onChange: (strategy: CoinControlStrategy) => void
  manualDisabled: boolean
  disabled: boolean
}

const STRATEGY_I18N: Record<CoinControlStrategy, string> = {
  [CoinControlStrategy.AUTO]: 'wallet.send.coinControl.auto',
  [CoinControlStrategy.MANUAL]: 'wallet.send.coinControl.manual',
  [CoinControlStrategy.MINIMIZE_FEE]: 'wallet.send.coinControl.minimizeFee',
  [CoinControlStrategy.LARGEST_FIRST]: 'wallet.send.coinControl.largestFirst',
  [CoinControlStrategy.SMALLEST_FIRST]: 'wallet.send.coinControl.smallestFirst'
}

export const StrategySelector = ({ strategy, onChange, manualDisabled, disabled }: Props): JSX.Element => {
  const intl = useIntl()

  return (
    <div className="flex flex-col gap-2">
      <Label size="big" color="gray" textTransform="uppercase">
        {intl.formatMessage({ id: 'wallet.send.coinControl.strategy' })}
      </Label>
      <RadioGroup className="flex flex-row flex-wrap gap-2" value={strategy} onChange={onChange} disabled={disabled}>
        {Object.values(CoinControlStrategy).map((s) => {
          const isManual = s === CoinControlStrategy.MANUAL
          const isDisabledOption = isManual && manualDisabled

          return (
            <Radio value={s} key={s} disabled={isDisabledOption}>
              <span
                title={
                  isDisabledOption
                    ? intl.formatMessage({ id: 'wallet.send.coinControl.manualKeystoreOnly' })
                    : undefined
                }>
                <Label disabled={disabled || isDisabledOption} textTransform="uppercase">
                  {intl.formatMessage({ id: STRATEGY_I18N[s] })}
                </Label>
              </span>
            </Radio>
          )
        })}
      </RadioGroup>
    </div>
  )
}
