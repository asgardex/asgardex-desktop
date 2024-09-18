import React from 'react'

import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { AnyAsset } from '@xchainjs/xchain-util'
import { useIntl } from 'react-intl'

import { TooltipAddress } from '../common/Common.styles'

type CustomProps = {
  amountLabel: string
  recipient: string
  priceFeeLabel: string
  currentMemo: string
  expectedTxMined?: string
  feeRate?: number
  upperFeeBound?: number
  asset: AnyAsset
}

type Props = CustomProps

export const ShowDetails: React.FC<Props> = ({
  recipient,
  amountLabel,
  priceFeeLabel,
  upperFeeBound,
  feeRate,
  expectedTxMined,
  currentMemo,
  asset
}): JSX.Element => {
  const intl = useIntl()
  const denom: string = (() => {
    switch (asset.chain) {
      case BTCChain:
      case BCHChain:
        return 'sats/vB'
      case DOGEChain:
        return 'doge/Byte'
      case LTCChain:
        return 'ltc/Byte'
      case DASHChain:
        return 'DASH/kB'
      default:
        return ''
    }
  })()
  return (
    <>
      <div className="flex w-full items-center justify-between text-[14px] text-gray2 dark:text-gray2d">
        <div className="font-mainBold ">{intl.formatMessage({ id: 'common.recipient' })}</div>
        <div className="truncate text-[13px] normal-case leading-normal">{recipient}</div>
      </div>
      <div className="flex w-full justify-between">
        <div className="font-mainBold text-[14px]">{intl.formatMessage({ id: 'common.amount' })}</div>
        <div className="truncate pl-10px font-main text-[12px]">{amountLabel}</div>
      </div>
      <div className="flex w-full justify-between">
        <div className="font-mainBold text-[14px]">{intl.formatMessage({ id: 'common.fee' })}</div>
        <div>{priceFeeLabel}</div>
      </div>
      <div className="flex w-full justify-between">
        {feeRate && upperFeeBound && (
          <>
            <div className={`font-mainBold text-[14px]`}>{intl.formatMessage({ id: 'common.feeRate' })}</div>
            <div className={`${feeRate >= upperFeeBound ? 'text-warning0 dark:text-warning0d' : ''}`}>
              {`${feeRate} ${denom}`}
            </div>
          </>
        )}
      </div>
      {expectedTxMined && (
        <div className="flex w-full justify-between">
          <div className={`font-mainBold text-[14px]`}>{intl.formatMessage({ id: 'common.inbound.time' })}</div>
          <div>{expectedTxMined}</div>
        </div>
      )}

      <div className="flex w-full items-center justify-between font-mainBold text-[14px] text-gray2 dark:text-gray2d">
        {intl.formatMessage({ id: 'common.memo' })}
        <TooltipAddress title={currentMemo}>
          <div className="truncate pl-10px font-main text-[12px] leading-normal">{currentMemo}</div>
        </TooltipAddress>
      </div>
    </>
  )
}

export default ShowDetails
