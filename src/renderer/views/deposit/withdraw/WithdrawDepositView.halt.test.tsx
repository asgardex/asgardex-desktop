import { act, createElement, PropsWithChildren } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { baseAmount, bn } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import { createRoot } from 'react-dom/client'
import * as Rx from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AssetBTC, AssetCacao } from '../../../../shared/utils/asset'
import { MAYAChain, THORChain } from '../../../../shared/utils/chainIds'
import { WalletAddress, WalletType } from '../../../../shared/wallet/types'
import { Props as WithdrawProps } from '../../../components/deposit/withdraw/Withdraw'
import { useSymDepositAddresses } from '../../../hooks/useSymDepositAddresses'
import { getZeroWithdrawFees } from '../../../services/chain/fees'
import { PoolShare } from '../../../services/midgard/midgardTypes'
import { UNKNOWN_MIMIR_HALT } from '../../../services/thorchain/const'
import { WithdrawDepositView } from './WithdrawDepositView'

const fixture = vi.hoisted(() => ({
  contexts: {} as Record<string, unknown>,
  child: undefined as WithdrawProps | undefined
}))
vi.mock('../../../contexts/AppContext', () => ({ useAppContext: () => fixture.contexts.app }))
vi.mock('../../../contexts/ChainContext', () => ({ useChainContext: () => fixture.contexts.chain }))
vi.mock('../../../contexts/WalletContext', () => ({ useWalletContext: () => fixture.contexts.wallet }))
vi.mock('../../../contexts/MidgardContext', () => ({ useMidgardContext: () => fixture.contexts.midgard }))
vi.mock('../../../contexts/MidgardMayaContext', () => ({ useMidgardMayaContext: () => fixture.contexts.midgard }))
vi.mock('../../../contexts/ThorchainContext', () => ({ useThorchainContext: () => fixture.contexts.thor }))
vi.mock('../../../contexts/MayachainContext', () => ({ useMayachainContext: () => fixture.contexts.maya }))
vi.mock('../../../services/storage/userChains', () => ({ userChains$: Rx.of(['BTC', 'THOR', 'MAYA']) }))
vi.mock('../../../hooks/useOpenExplorerTxUrl', () => ({
  useOpenExplorerTxUrl: () => ({ openExplorerTxUrl: vi.fn(), getExplorerTxUrl: () => O.none })
}))
vi.mock('react-intl', () => ({ useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }) }))
vi.mock('../../../components/deposit/withdraw', async () => {
  const { Withdraw } = await import('../../../components/deposit/withdraw/Withdraw')
  return {
    Withdraw: (props: WithdrawProps) => {
      fixture.child = props
      return createElement(Withdraw, props)
    }
  }
})
// Keep the real address hook, halt streams, view, guard and form; stub presentation-only children.
vi.mock('../../../components/uielements/slider', () => ({
  Slider: ({ disabled }: { disabled?: boolean }) => <input aria-label="withdraw-percent" disabled={disabled} />
}))
vi.mock('../../../components/uielements/button', () => ({
  FlatButton: ({ children, disabled }: PropsWithChildren<{ disabled?: boolean }>) => (
    <button disabled={disabled}>{children}</button>
  )
}))
vi.mock('../../../components/uielements/label', () => ({
  Label: ({ children }: PropsWithChildren) => <span>{children}</span>,
  CopyLabel: () => null
}))
vi.mock('../../../components/uielements/common', () => ({
  WalletTypeLabel: ({ children }: PropsWithChildren) => <span>{children}</span>
}))
vi.mock('../../../components/uielements/tooltip', () => ({
  Tooltip: ({ children }: PropsWithChildren) => <>{children}</>
}))
vi.mock('../../../components/uielements/assets/assetIcon', () => ({ AssetIcon: () => null }))
vi.mock('../../../components/uielements/assets/assetLabel', () => ({ AssetLabel: () => null }))
vi.mock('../../../components/uielements/fees', () => ({ Fees: () => null }))
vi.mock('../../../components/modal/confirmation', () => ({
  LedgerConfirmationModal: () => null,
  WalletPasswordConfirmationModal: () => null
}))
vi.mock('../../../components/modal/tx', () => ({ UnifiedTxModal: () => null, getDepositTimerValue: () => 0 }))

const address = (chain: string, type = WalletType.Keystore): WalletAddress => ({
  chain,
  type,
  address: 'fixture-address',
  walletAccount: 0,
  walletIndex: 0,
  hdMode: 'default'
})
const oAsset = O.some(AssetBTC)
const poolDetail = {
  asset: 'BTC.BTC',
  assetDepth: '10000000000',
  runeDepth: '1000000000000',
  units: '100',
  assetPrice: '1'
} as PoolDetail
const poolShare: PoolShare = {
  units: bn(10),
  asset: AssetBTC,
  assetAddress: O.some('fixture-address'),
  runeAddress: O.some('fixture-address'),
  assetAddedAmount: baseAmount(100000000),
  type: 'sym'
}

const setup = (mimir: Record<string, number>) => {
  fixture.contexts = {
    app: { network$: Rx.of(Network.Mainnet) },
    chain: {
      addressByChain$: (chain: string) => Rx.of(O.some(address(chain))),
      symWithdrawFee$: () => Rx.of(RD.success(getZeroWithdrawFees(AssetCacao))),
      reloadWithdrawFees: vi.fn(),
      symWithdraw$: vi.fn()
    },
    wallet: {
      getLedgerAddress$: (chain: string) => Rx.of(O.some(address(chain, WalletType.Ledger))),
      balancesState$: () => Rx.of({ balances: O.some([{ asset: AssetCacao, amount: baseAmount(1000000000000, 10) }]) }),
      keystoreService: { validatePassword$: vi.fn() },
      reloadBalances: vi.fn()
    },
    midgard: {
      service: {
        pools: {
          selectedPricePoolAsset$: Rx.of(O.some(AssetCacao)),
          priceRatio$: Rx.of(bn(1)),
          poolsState$: Rx.of(RD.success({ poolsData: {} }))
        },
        shares: { reloadShares: vi.fn() }
      }
    },
    thor: {
      mimir$: Rx.of(RD.success({})),
      thorchainLastblockState$: Rx.of(RD.success([{ chain: 'BTC', thorchain: 100 }]))
    },
    maya: {
      mimir$: Rx.of(RD.success(mimir)),
      mayachainLastblockState$: Rx.of(RD.success([{ chain: 'BTC', mayachain: 100 }]))
    }
  }
}

const Harness = ({ ready }: { ready: boolean }) => {
  const { addresses } = useSymDepositAddresses({
    asset: oAsset,
    protocol: MAYAChain,
    assetWalletType: WalletType.Keystore,
    dexWalletType: WalletType.Ledger
  })
  if (!O.isSome(addresses.dex) || !O.isSome(addresses.asset)) return null
  return (
    <WithdrawDepositView
      protocol={MAYAChain}
      dexWalletAddress={addresses.dex.value}
      assetWalletAddress={addresses.asset.value}
      asset={{ asset: AssetBTC, decimal: 8 }}
      poolShare={ready ? RD.success(O.some(poolShare)) : RD.initial}
      poolDetail={RD.success(poolDetail)}
      haltedChains={[]}
      mimirHalt={UNKNOWN_MIMIR_HALT}
    />
  )
}

describe('selected withdrawal protocol with a THOR Ledger address', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    fixture.child = undefined
  })
  afterEach(() => vi.unstubAllGlobals())
  const render = (ready = true) => {
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(<Harness ready={ready} />))
    return { container, unmount: () => act(() => root.unmount()) }
  }

  it.each(['HALTMAYACHAIN', 'SOLVENCYHALTMAYACHAIN'])(
    'blocks the real MAYA withdrawal form for proven %s despite THOR wallet metadata',
    (key) => {
      setup({ [key]: 1 })
      const { container, unmount } = render()
      try {
        expect(fixture.child?.dexWalletAddress.chain).toBe(THORChain)
        expect(fixture.child?.mimirHalt.HALTMAYACHAIN).toBe(true)
        expect(container.querySelector<HTMLInputElement>('input')?.disabled).toBe(true)
        expect(container.querySelector<HTMLButtonElement>('button')?.disabled).toBe(true)
        expect(fixture.child).toHaveProperty('protocol', MAYAChain)
      } finally {
        unmount()
      }
    }
  )
  it('leaves the amount control enabled without a proven halt despite synthetic deposit flags', () => {
    setup({})
    const { container, unmount } = render()
    try {
      expect(fixture.child?.dexWalletAddress.chain).toBe(THORChain)
      expect(container.querySelector<HTMLInputElement>('input')?.disabled).toBe(false)
    } finally {
      unmount()
    }
  })
  it('passes the selected protocol through the empty-form path too', () => {
    setup({ HALTMAYACHAIN: 1 })
    const { unmount } = render(false)
    try {
      expect(fixture.child?.dexWalletAddress.chain).toBe(THORChain)
      expect(fixture.child).toHaveProperty('protocol', MAYAChain)
    } finally {
      unmount()
    }
  })
})
