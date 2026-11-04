import * as RD from '@devexperts/remote-data-ts'
import { baseAmount } from '@xchainjs/xchain-util'
import { renderToStaticMarkup } from 'react-dom/server'
import { IntlProvider } from 'react-intl'

import { THORChain } from '../../../shared/utils/chainIds'
import { IncentivePendulum as IncentivePendulumData } from '../../hooks/useIncentivePendulum'
import { IncentivePendulum } from './IncentivePendulum'

const messages = {
  'pools.incentivependulum.info': 'Incentive Pendulum: {percentage}%',
  'pools.incentivependulum.tooltip': '{pooled} {bonded}',
  'pools.incentivependulum.error': 'Error'
}

const data: IncentivePendulumData = {
  incentivePendulum: 118,
  incentivePendulumLight: 'green',
  totalActiveBondAmount: baseAmount(100),
  totalPooledRuneAmount: baseAmount(100)
}

const render = (rd: RD.RemoteData<Error, IncentivePendulumData>) =>
  renderToStaticMarkup(
    <IntlProvider locale="en" messages={messages}>
      <IncentivePendulum incentivePendulum={rd} protocol={THORChain} />
    </IntlProvider>
  )

// All states have to share the same box (min height + 20px icon) to avoid layout shifts while reloading
const WRAPPER = 'flex min-h-5 w-full items-center justify-center pb-1'

describe('components/pool/IncentivePendulum', () => {
  it('renders the same wrapper and icon size for pending, error and success state', () => {
    const pending = render(RD.pending)
    const error = render(RD.failure(new Error('fail')))
    const success = render(RD.success(data))

    expect(pending).toContain(WRAPPER)
    expect(error).toContain(WRAPPER)
    expect(success).toContain(WRAPPER)
    expect(pending).toContain('width="20"')
    expect(success).toContain('width="20"')
    expect(pending).toContain('...%')
    expect(success).toContain('118%')
  })
})
