import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, assetAmount, assetToBase, baseAmount } from '@xchainjs/xchain-util'
import { renderToStaticMarkup } from 'react-dom/server'
import { IntlProvider } from 'react-intl'

import { ASSETS_MAINNET } from '../../../shared/mock/assets'
import { THORChain } from '../../../shared/utils/chainIds'
import { IncentivePendulumRD } from '../../hooks/useIncentivePendulum'
import en from '../../i18n/en'
import { GetPoolsStatusEnum } from '../../services/midgard/midgardTypes'
import { PoolsSummary, Props } from './PoolsSummary'
import { PoolsTableRow } from './PoolsTable'

const row = (
  asset: AnyAsset,
  depth: number,
  volume: number,
  overrides: Partial<PoolsTableRow> = {}
): PoolsTableRow => ({
  asset,
  poolPrice: assetToBase(assetAmount(1)),
  depthAmount: assetToBase(assetAmount(0)),
  depthPrice: assetToBase(assetAmount(depth)),
  volumeAmount: assetToBase(assetAmount(0)),
  volumePrice: assetToBase(assetAmount(volume)),
  apy: 1,
  status: GetPoolsStatusEnum.Available,
  key: asset.ticker,
  network: Network.Mainnet,
  watched: false,
  ...overrides
})

const pendulum: IncentivePendulumRD = RD.success({
  incentivePendulum: 124,
  incentivePendulumLight: 'yellow',
  totalActiveBondAmount: baseAmount(100),
  totalPooledRuneAmount: baseAmount(100)
})

const render = (props: Partial<Props>) =>
  renderToStaticMarkup(
    <IntlProvider locale="en" messages={en}>
      <PoolsSummary
        variant="active"
        rows={[]}
        pricePoolAsset={ASSETS_MAINNET.USDT}
        protocol={THORChain}
        incentivePendulum={pendulum}
        {...props}
      />
    </IntlProvider>
  )

describe('views/pools/PoolsSummary', () => {
  it('sums liquidity and volume and counts limited pools', () => {
    const html = render({
      rows: [
        row(ASSETS_MAINNET.BTC, 1_000_000, 4_000_000, { poolStatus: { kind: 'deposit' } }),
        row(ASSETS_MAINNET.ETH, 1_000_000, 1_000_000)
      ]
    })
    expect(html).toContain('$2.00M')
    expect(html).toContain('2 pools')
    expect(html).toContain('$5.00M')
    expect(html).toContain('250.0% of liquidity')
    expect(html).toContain('124%')
    expect(html).toContain('1 limited')
  })

  it('shows all pools operational without limits', () => {
    expect(render({ rows: [row(ASSETS_MAINNET.BTC, 1, 1)] })).toContain('All operational')
  })

  it('shows an unknown status while halt data is not loaded', () => {
    const html = render({
      rows: [
        row(ASSETS_MAINNET.BTC, 1, 1, { poolStatus: { kind: 'unknown' } }),
        row(ASSETS_MAINNET.ETH, 1, 1, { poolStatus: { kind: 'unknown' } })
      ]
    })
    expect(html).toContain('Status unknown')
    expect(html).toContain('Swap and Add are disabled until it loads')
    expect(html).not.toContain('limited')
    expect(html).not.toContain('All operational')
  })

  it('shows placeholders while loading without rows', () => {
    const html = render({ rows: [], loading: true, incentivePendulum: RD.pending })
    expect(html).not.toContain('All operational')
    expect(html).toContain('--')
  })

  it('shows the next pool activation for pending pools', () => {
    const html = render({ variant: 'pending', nextPoolBlocksLeft: '1,234', rows: [row(ASSETS_MAINNET.BTC, 1, 0)] })
    expect(html).toContain('Next pool activation')
    expect(html).toContain('1,234')
    expect(html).not.toContain('24h volume')
  })
})
