import { ReactNode, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import {
  ArrowsRightLeftIcon,
  ArrowPathIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon
} from '@heroicons/react/24/outline'
import {
  Chain,
  AnyAsset,
  AssetType,
  Address,
  BaseAmount,
  CryptoAmount,
  baseToAsset,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import clsx from 'clsx'
import * as O from 'fp-ts/Option'
import { useIntl } from 'react-intl'

import { isUSDAsset } from '../../../helpers/assetHelper'
import { ChangeSlipToleranceHandler } from '../../../services/app/types'
import { SwapFeesRD, SwapTxParams } from '../../../services/chain/types'
import { SlipTolerance } from '../../../types/asgardex'
import { BaseButton } from '../../uielements/button'
import { Collapse } from '../../uielements/collapse'
import { InfoIcon } from '../../uielements/info'
import { Tooltip } from '../../uielements/tooltip'
import { SelectableSlipTolerance } from '../SelectableSlipTolerance'
import { ExtendedQuoteSwap } from '../Swap.types'
import { TransactionTime } from './TransactionTime'

type Props = {
  lockedWallet: boolean
  showDetails: boolean
  onToggleDetails: () => void
  rateLabel: string
  onToggleRateDirection: () => void
  swapFeesRD: SwapFeesRD
  onReloadFees: () => void
  priceSwapFeesLabel: string
  needApprovement: O.Option<boolean>
  priceApproveFeeLabel: string
  priceSwapInFeeLabel: string
  priceSwapOutFeeLabel: string
  priceAffiliateFeeLabel: string
  priceAmountToSwap: CryptoAmount
  swapSlippage: number
  slipTolerance: SlipTolerance
  changeSlipTolerance: ChangeSlipToleranceHandler
  swapMinResultLabel: string
  streamingInterval: number
  streamingQuantity: number
  isCausedSlippage: boolean
  sourceChain: Chain
  targetAsset: AnyAsset
  oQuoteProtocol: O.Option<ExtendedQuoteSwap>
  oSourceWalletAddress: O.Option<Address>
  effectiveRecipientAddress: O.Option<Address>
  hidePrivateData: boolean
  hiddenString: string
  noDataString: string
  oSwapParams: O.Option<SwapTxParams>
  walletBalancesLoading: boolean
  reloadBalances: () => void
  sourceAssetAmountNative: BaseAmount
  sourceAsset: AnyAsset
  memoTitle: ReactNode
  memoLabel: ReactNode
}

export const SwapDetailsPanel = ({
  lockedWallet,
  showDetails,
  onToggleDetails,
  rateLabel,
  onToggleRateDirection,
  swapFeesRD,
  onReloadFees,
  priceSwapFeesLabel,
  needApprovement,
  priceApproveFeeLabel,
  priceSwapInFeeLabel,
  priceSwapOutFeeLabel,
  priceAffiliateFeeLabel,
  priceAmountToSwap,
  swapSlippage,
  slipTolerance,
  changeSlipTolerance,
  swapMinResultLabel,
  streamingInterval,
  streamingQuantity,
  isCausedSlippage,
  sourceChain,
  targetAsset,
  oQuoteProtocol,
  oSourceWalletAddress,
  effectiveRecipientAddress,
  hidePrivateData,
  hiddenString,
  noDataString,
  oSwapParams,
  walletBalancesLoading,
  reloadBalances,
  sourceAssetAmountNative,
  sourceAsset,
  memoTitle,
  memoLabel
}: Props) => {
  const intl = useIntl()

  const slippageValue = useMemo(
    () =>
      formatAssetAmountCurrency({
        amount: priceAmountToSwap.assetAmount.times((swapSlippage > 0 ? swapSlippage : slipTolerance) / 100),
        asset: priceAmountToSwap.asset,
        decimal: isUSDAsset(priceAmountToSwap.asset) ? 2 : 6,
        trimZeros: !isUSDAsset(priceAmountToSwap.asset)
      }) + ` (${swapSlippage.toFixed(2)}%)`,
    [priceAmountToSwap.asset, priceAmountToSwap.assetAmount, slipTolerance, swapSlippage]
  )

  const transactionTimeNode = (
    <TransactionTime
      intl={intl}
      showDetails={showDetails}
      sourceChain={sourceChain}
      targetAsset={targetAsset}
      oQuoteProtocol={oQuoteProtocol}
    />
  )

  const senderAddressNode = O.match(
    () => <>{noDataString}</>,
    (address: Address) => {
      const displayedAddress = hidePrivateData ? hiddenString : address
      return (
        <Tooltip size="big" title={displayedAddress} key="tooltip-sender-addr">
          {displayedAddress}
        </Tooltip>
      )
    }
  )(oSourceWalletAddress)

  const recipientAddressNode = O.match(
    () => <>{noDataString}</>,
    (address: Address) => {
      const displayedAddress = hidePrivateData ? hiddenString : address
      return (
        <Tooltip size="big" title={displayedAddress} key="tooltip-target-addr">
          {displayedAddress}
        </Tooltip>
      )
    }
  )(effectiveRecipientAddress)

  const poolAddressNode = O.toNullable(
    O.map((params: SwapTxParams) => {
      const {
        poolAddress: { address },
        asset
      } = params
      return address && asset.type !== AssetType.SYNTH ? (
        <div className="flex w-full items-center justify-between pl-10px text-[12px]" key="pool-addr">
          <div>{intl.formatMessage({ id: 'common.pool.inbound' })}</div>
          <Tooltip size="big" title={address}>
            <div className="truncate pl-20px text-[13px] leading-normal normal-case">{address}</div>
          </Tooltip>
        </div>
      ) : null
    })(oSwapParams)
  )

  const senderBalance = walletBalancesLoading
    ? intl.formatMessage({ id: 'common.loading' })
    : hidePrivateData
      ? hiddenString
      : formatAssetAmountCurrency({
          amount: baseToAsset(sourceAssetAmountNative),
          asset: sourceAsset,
          decimal: 8,
          trimZeros: true
        })

  const memoSection = showDetails && (
    <>
      <div className="ml-[-2px] flex w-full items-start pt-10px font-main-bold text-[14px] text-text2 dark:text-text2d">
        {memoTitle}
      </div>
      <div className="truncate pl-10px font-main text-[12px] text-text2 dark:text-text2d">
        {hidePrivateData ? hiddenString : memoLabel}
      </div>
    </>
  )

  const addressSection = showDetails && (
    <>
      <div className="w-full pt-10px font-main-bold text-[14px] text-text2 dark:text-text2d">
        {intl.formatMessage({ id: 'common.addresses' })}
      </div>
      <div className="flex w-full items-center justify-between pl-10px text-[12px]">
        <div className="text-text2 dark:text-text2d">{intl.formatMessage({ id: 'common.sender' })}</div>
        <div className="truncate pl-20px text-[13px] leading-normal text-text2 normal-case dark:text-text2d">
          {senderAddressNode}
        </div>
      </div>
      <div className="flex w-full items-center justify-between pl-10px text-[12px]">
        <div className="text-text2 dark:text-text2d">{intl.formatMessage({ id: 'common.recipient' })}</div>
        <div className="truncate pl-20px text-[13px] leading-normal text-text2 normal-case dark:text-text2d">
          {recipientAddressNode}
        </div>
      </div>
      {poolAddressNode}
    </>
  )

  const balancesSection = showDetails && (
    <>
      <div className="w-full pt-10px text-[14px]">
        <BaseButton
          disabled={walletBalancesLoading}
          className="group !p-0 !font-main-bold !text-text2 dark:!text-text2d"
          onClick={reloadBalances}>
          {intl.formatMessage({ id: 'common.balances' })}
          <ArrowPathIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
        </BaseButton>
      </div>
      <div className="flex w-full items-center justify-between pl-10px text-[12px]">
        <div className="text-text2 dark:text-text2d">{intl.formatMessage({ id: 'common.sender' })}</div>
        <div className="truncate pl-20px text-[13px] leading-normal text-text2 normal-case dark:text-text2d">
          {senderBalance}
        </div>
      </div>
    </>
  )

  const renderSlippageSection = () => (
    <>
      <div
        className={clsx(
          'flex w-full justify-between font-main-bold text-[14px]',
          { 'pt-10px': showDetails },
          { 'text-error0 dark:text-error0d': isCausedSlippage }
        )}>
        <div className="text-text2 dark:text-text2d">{intl.formatMessage({ id: 'swap.slip.title' })}</div>
        <div className="text-text2 dark:text-text2d">{slippageValue}</div>
      </div>

      {showDetails && (
        <>
          <div className="flex w-full justify-between pl-10px text-[12px]">
            <div className="flex items-center">
              {intl.formatMessage({ id: 'swap.slip.tolerance' })}
              <InfoIcon
                className="ml-[3px] h-[15px] w-[15px] text-inherit"
                tooltip={intl.formatMessage({ id: 'swap.slip.tolerance.info' })}
              />
            </div>
            <div>
              <SelectableSlipTolerance value={slipTolerance} onChange={changeSlipTolerance} />
            </div>
          </div>
          <div className="flex w-full justify-between pl-10px text-[12px]">
            <div className="flex items-center">
              {intl.formatMessage({ id: 'swap.min.result.protected' })}
              <InfoIcon
                className="ml-[3px] h-[15px] w-[15px] text-inherit"
                tooltip={intl.formatMessage({ id: 'swap.min.result.info' }, { tolerance: slipTolerance })}
              />
            </div>
            <div>{swapMinResultLabel}</div>
          </div>
          <div className="flex w-full justify-between pl-10px text-[12px]">
            <div className="flex items-center text-text2 dark:text-text2d">
              {intl.formatMessage({ id: 'swap.streaming.interval' })}
              <InfoIcon
                className="ml-[3px] h-[15px] w-[15px] text-inherit"
                tooltip={intl.formatMessage({ id: 'swap.streaming.interval.info' })}
              />
            </div>
            <div className="text-text2 dark:text-text2d">{streamingInterval}</div>
          </div>
          <div className="flex w-full justify-between pl-10px text-[12px]">
            <div className="flex items-center text-text2 dark:text-text2d">
              {intl.formatMessage({ id: 'swap.streaming.quantity' })}
              <InfoIcon
                className="ml-[3px] h-[15px] w-[15px] text-inherit"
                tooltip={intl.formatMessage({ id: 'swap.streaming.quantity.info' })}
              />
            </div>
            <div className="text-text2 dark:text-text2d">{streamingQuantity}</div>
          </div>
        </>
      )}
    </>
  )

  const rateSection = (
    <div className="flex w-full justify-between font-main-bold text-[14px]">
      <BaseButton className="group !p-0 !font-main-bold !text-text2 dark:!text-text2d" onClick={onToggleRateDirection}>
        {intl.formatMessage({ id: 'common.rate' })}
        <ArrowsRightLeftIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
      </BaseButton>
      <div className="text-text2 dark:text-text2d">{rateLabel}</div>
    </div>
  )

  const feesSection = (
    <div className="flex w-full items-center justify-between font-main-bold">
      <BaseButton
        disabled={RD.isPending(swapFeesRD) || RD.isInitial(swapFeesRD)}
        className="group !p-0 !font-main-bold !text-text2 dark:!text-text2d"
        onClick={onReloadFees}>
        {intl.formatMessage({ id: 'common.fees.estimated' })}
        <ArrowPathIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
      </BaseButton>
      <div className="text-text2 dark:text-text2d">{priceSwapFeesLabel}</div>
    </div>
  )

  const unlockedContent = (
    <div className="w-full px-4 pb-4 font-main text-[12px] uppercase dark:border-gray1d">
      <BaseButton
        className="group flex w-full !justify-between !p-0 font-main-semi-bold text-[16px] text-text2 hover:text-turquoise dark:text-text2d dark:hover:text-turquoise"
        onClick={onToggleDetails}>
        {intl.formatMessage({ id: 'common.details' })}
        {showDetails ? (
          <MagnifyingGlassMinusIcon className="ease h-[20px] w-[20px] text-inherit group-hover:scale-125" />
        ) : (
          <MagnifyingGlassPlusIcon className="ease h-[20px] w-[20px] text-inherit group-hover:scale-125" />
        )}
      </BaseButton>

      <div className="pt-10px font-main text-[14px] text-gray2 dark:text-gray2d">
        {rateSection}
        {feesSection}

        {showDetails && (
          <>
            {O.isSome(needApprovement) && (
              <div className="flex w-full justify-between pl-10px text-[12px] text-text2 dark:text-text2d">
                <div>{intl.formatMessage({ id: 'common.approve' })}</div>
                <div>{priceApproveFeeLabel}</div>
              </div>
            )}
            <div className="flex w-full justify-between pl-10px text-[12px] text-text2 dark:text-text2d">
              <div>{intl.formatMessage({ id: 'common.fee.inbound' })}</div>
              <div>{priceSwapInFeeLabel}</div>
            </div>
            <div className="flex w-full justify-between pl-10px text-[12px] text-text2 dark:text-text2d">
              <div>{intl.formatMessage({ id: 'common.fee.outbound' })}</div>
              <div>{priceSwapOutFeeLabel}</div>
            </div>
            <div className="flex w-full justify-between pl-10px text-[12px] text-text2 dark:text-text2d">
              <div>{intl.formatMessage({ id: 'common.fee.affiliate' })}</div>
              <div className={clsx({ 'font-bold !text-turquoise': priceAffiliateFeeLabel === 'free' })}>
                {priceAffiliateFeeLabel}
              </div>
            </div>
          </>
        )}

        {renderSlippageSection()}
        {transactionTimeNode}
        {addressSection}
        {balancesSection}
        {memoSection}
      </div>
    </div>
  )

  const lockedContent = (
    <div className="w-full px-4 pb-4 font-main text-[12px] uppercase dark:border-gray1d">
      <div className="font-main text-[14px] text-gray2 dark:text-gray2d">
        {rateSection}
        {feesSection}
        <div className="flex w-full justify-between pl-10px text-[12px]">
          <div className="text-text2 dark:text-text2d">{intl.formatMessage({ id: 'common.fee.inbound' })}</div>
          <div className="text-text2 dark:text-text2d">{priceSwapInFeeLabel}</div>
        </div>
        <div className="flex w-full justify-between pl-10px text-[12px]">
          <div className="text-text2 dark:text-text2d">{intl.formatMessage({ id: 'swap.slip.title' })}</div>
          <div className="text-text2 dark:text-text2d">{slippageValue}</div>
        </div>
        <div className="flex w-full justify-between pl-10px text-[12px]">
          <div className="text-text2 dark:text-text2d">{intl.formatMessage({ id: 'common.fee.outbound' })}</div>
          <div className="text-text2 dark:text-text2d">{priceSwapOutFeeLabel}</div>
        </div>
        <div className="flex w-full justify-between pl-10px text-[12px]">
          <div className="text-text2 dark:text-text2d">{intl.formatMessage({ id: 'common.fee.affiliate' })}</div>
          <div className={clsx({ 'font-bold !text-turquoise': priceAffiliateFeeLabel === 'free' })}>
            {priceAffiliateFeeLabel}
          </div>
        </div>

        {transactionTimeNode}
      </div>
    </div>
  )

  return (
    <Collapse
      header={
        <div className="flex flex-row items-center justify-between">
          <span className="m-0 font-main text-[14px] text-text2 dark:text-text2d">
            {intl.formatMessage({ id: 'common.swap' })} {intl.formatMessage({ id: 'common.details' })}
          </span>
        </div>
      }>
      {!lockedWallet ? unlockedContent : lockedContent}
    </Collapse>
  )
}
