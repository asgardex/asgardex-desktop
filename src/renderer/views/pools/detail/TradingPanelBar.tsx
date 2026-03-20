import { useCallback } from 'react'

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, BaseAmount, assetToString, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { AssetIcon } from '../../../components/uielements/assets/assetIcon'
import { isUSDAsset } from '../../../helpers/assetHelper'
import { eqAsset } from '../../../helpers/fp/eq'

export type TradeMode = 'buy' | 'sell'

type Props = {
  sourceAsset: AnyAsset
  network: Network
  hasWallet: boolean
  tradeMode: TradeMode
  assetBalance: O.Option<BaseAmount>
  amountStr: string
  setAmountStr: (v: string) => void
  selectedTarget: AnyAsset | null
  setSelectedTarget: (v: AnyAsset) => void
  availableAssets: AnyAsset[]
  onTrade: (mode: TradeMode) => void
}

export const TradingPanelBar = ({
  sourceAsset,
  network,
  hasWallet,
  tradeMode,
  assetBalance,
  amountStr,
  setAmountStr,
  selectedTarget,
  setSelectedTarget,
  availableAssets,
  onTrade
}: Props) => {
  const intl = useIntl()

  const handleSetMax = useCallback(() => {
    FP.pipe(
      assetBalance,
      O.map((amount) => {
        setAmountStr(
          baseToAsset(amount)
            .amount()
            .toFixed(8)
            .replace(/\.?0+$/, '')
        )
      })
    )
  }, [assetBalance, setAmountStr])

  if (!hasWallet) {
    return (
      <div className="flex items-center justify-center border-t border-white/10 bg-white/5 px-4 py-3">
        <span className="text-12 font-main text-gray-500">
          {intl.formatMessage({ id: 'pools.chart.tradingPanel.noWallet' })}
        </span>
      </div>
    )
  }

  return (
    <div className="border-t border-white/10 bg-white/5 px-4 py-3">
      {/* Buy / Sell toggle */}
      <div className="mb-3 flex overflow-hidden rounded-lg bg-white/5">
        <button
          onClick={() => onTrade('buy')}
          className={clsx(
            'text-12 flex-1 py-2 font-main font-semibold transition-all',
            tradeMode === 'buy'
              ? 'bg-turquoise text-white shadow-[0_0_12px_rgba(80,227,194,0.3)]'
              : 'text-gray-400 hover:text-white'
          )}>
          {intl.formatMessage({ id: 'common.buy' })}
        </button>
        <button
          onClick={() => onTrade('sell')}
          className={clsx(
            'text-12 flex-1 py-2 font-main font-semibold transition-all',
            tradeMode === 'sell'
              ? 'bg-error0 text-white shadow-[0_0_12px_rgba(255,77,79,0.3)]'
              : 'text-gray-400 hover:text-white'
          )}>
          {intl.formatMessage({ id: 'common.sell' })}
        </button>
      </div>

      {/* Amount input row */}
      <div className="mb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => {
              const v = e.target.value
              if (v === '' || /^\d*\.?\d*$/.test(v)) setAmountStr(v)
            }}
            placeholder="0.00"
            className="w-full rounded-lg bg-white/10 px-3 py-2 pr-16 font-main text-14 text-white placeholder-gray-600 transition-colors outline-none focus:bg-white/15 focus:ring-1 focus:ring-white/20"
          />
          <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
            {O.isSome(assetBalance) && (
              <button
                onClick={handleSetMax}
                className="rounded bg-turquoise/20 px-1.5 py-0.5 font-main text-[10px] font-semibold text-turquoise transition-colors hover:bg-turquoise/30">
                {intl.formatMessage({ id: 'common.max' })}
              </button>
            )}
            <span className="font-main text-11 text-gray-500">{sourceAsset.ticker}</span>
          </div>
        </div>

        {/* Asset pair dropdown */}
        {selectedTarget && availableAssets.length > 0 && (
          <Listbox value={selectedTarget} onChange={setSelectedTarget}>
            <div className="relative">
              <ListboxButton className="text-12 flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 font-main text-white transition-colors hover:bg-white/15">
                {({ open }) => (
                  <>
                    <AssetIcon
                      asset={selectedTarget}
                      size="xsmall"
                      network={network}
                      className="pointer-events-none !h-5 !w-5"
                    />
                    <span className="font-semibold">{selectedTarget.ticker}</span>
                    <ChevronDownIcon
                      className={clsx('h-3.5 w-3.5 text-gray-400 transition-transform', { 'rotate-180': open })}
                    />
                  </>
                )}
              </ListboxButton>
              <ListboxOptions className="absolute right-0 bottom-full z-50 mb-1 max-h-[240px] w-[220px] overflow-y-auto rounded-lg border border-white/10 bg-[#1e222d] shadow-xl focus:outline-hidden">
                {availableAssets.map((asset) => {
                  const isSelected = eqAsset.equals(asset, selectedTarget)
                  return (
                    <ListboxOption
                      key={assetToString(asset)}
                      value={asset}
                      className={({ active }) =>
                        clsx(
                          'flex cursor-pointer items-center gap-2 px-3 py-2',
                          active && 'bg-white/10',
                          isSelected && 'bg-white/5'
                        )
                      }>
                      <AssetIcon
                        asset={asset}
                        size="xsmall"
                        network={network}
                        className="pointer-events-none !h-5 !w-5"
                      />
                      <span className="text-12 font-main text-white">{asset.ticker}</span>
                      <span className="font-main text-11 text-gray-500">{asset.chain}</span>
                      {isUSDAsset(asset) && (
                        <span className="ml-auto rounded bg-turquoise/20 px-1.5 py-0.5 font-main text-[9px] font-semibold text-turquoise">
                          USD
                        </span>
                      )}
                    </ListboxOption>
                  )
                })}
              </ListboxOptions>
            </div>
          </Listbox>
        )}
      </div>

      {/* Balance */}
      <div className="font-main text-11 text-gray-500">
        {FP.pipe(
          assetBalance,
          O.fold(
            () => `${intl.formatMessage({ id: 'common.balance' })}: 0`,
            (amount) =>
              `${intl.formatMessage({ id: 'common.balance' })}: ${formatAssetAmountCurrency({
                amount: baseToAsset(amount),
                asset: sourceAsset,
                trimZeros: true
              })}`
          )
        )}
      </div>
    </div>
  )
}
