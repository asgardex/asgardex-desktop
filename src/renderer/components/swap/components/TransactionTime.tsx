import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain, AnyAsset, AssetType } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { option as O } from 'fp-ts'
import { IntlShape } from 'react-intl'

import { DefaultChainAttributes } from '../../../../shared/utils/chain'
import { formatSwapTime } from '../../../helpers/timeHelper'
import { ExtendedQuoteSwap } from '../Swap.types'

type Props = {
  intl: IntlShape
  showDetails: boolean
  sourceChain: Chain
  targetAsset: AnyAsset
  oQuoteProtocol: O.Option<ExtendedQuoteSwap>
}

export const TransactionTime = ({ intl, showDetails, sourceChain, targetAsset, oQuoteProtocol }: Props) => {
  const transactionTime = O.isSome(oQuoteProtocol)
    ? (oQuoteProtocol.value.totalSwapSeconds ??
      DefaultChainAttributes[targetAsset.chain].avgBlockTimeInSecs +
        DefaultChainAttributes[sourceChain].avgBlockTimeInSecs)
    : DefaultChainAttributes[targetAsset.chain].avgBlockTimeInSecs +
      DefaultChainAttributes[sourceChain].avgBlockTimeInSecs

  const confirmationChain =
    targetAsset.type === AssetType.SYNTH
      ? MAYAChain
      : targetAsset.type === AssetType.SECURED
        ? THORChain
        : targetAsset.chain

  return (
    <>
      <div className={clsx('font-mainBold flex w-full justify-between text-[14px]', { 'pt-10px': showDetails })}>
        <div className="text-text2 dark:text-text2d">{intl.formatMessage({ id: 'common.time.title' })}</div>
        <div className="text-text2 dark:text-text2d">{formatSwapTime(transactionTime)}</div>
      </div>
      {showDetails && (
        <>
          <div className="flex w-full justify-between pl-10px text-[12px]">
            <div className="flex items-center text-text2 dark:text-text2d">
              {intl.formatMessage({ id: 'common.inbound.time' })}
            </div>
            <div className="text-text2 dark:text-text2d">
              {formatSwapTime(Number(DefaultChainAttributes[sourceChain].avgBlockTimeInSecs))}
            </div>
          </div>
          <div className="flex w-full justify-between pl-10px text-[12px]">
            <div className="flex items-center text-text2 dark:text-text2d">
              {intl.formatMessage({ id: 'common.confirmation.time' }, { chain: confirmationChain })}
            </div>
            <div className="text-text2 dark:text-text2d">
              {formatSwapTime(Number(DefaultChainAttributes[targetAsset.chain].avgBlockTimeInSecs))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
