import { useMemo } from 'react'
import * as RD from '@devexperts/remote-data-ts'
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { AssetTCY } from '@xchainjs/xchain-thorchain'
import { formatAssetAmountCurrency, baseToAsset } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'

import { AssetData } from '../../../components/uielements/assets/assetData'
import { BaseButton, FlatButton } from '../../../components/uielements/button'
import { Fees, UIFeesRD } from '../../../components/uielements/fees'
import { useNetwork } from '../../../hooks/useNetwork'
import { FeeRD } from '../../../services/chain/types'
import { TcyInfo } from './types'

export type Props = {
  isVisible: boolean
  tcyInfo: TcyInfo
  feeRd: FeeRD
  onClose: () => void
  onClaim: () => void
}

export const TcyClaimModal = (props: Props) => {
  const { isVisible, tcyInfo, onClose, feeRd, onClaim } = props
  const { network } = useNetwork()

  const uiFeesRD: UIFeesRD = useMemo(
    () =>
      FP.pipe(
        feeRd,
        RD.map((fee) => [
          {
            asset: tcyInfo.asset,
            amount: fee
          }
        ])
      ),
    [feeRd, tcyInfo.asset]
  )

  return (
    <Dialog as="div" className="relative z-10" open={isVisible} onClose={onClose}>
      <DialogBackdrop className="fixed inset-0 bg-bg0/40 dark:bg-bg0d/40" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          className={clsx(
            'mx-auto flex flex-col items-center py-5 gap-4',
            'w-full max-w-[360px] md:max-w-[480px]',
            'bg-bg0 dark:bg-bg0d',
            'rounded-lg border border-solid border-gray1 dark:border-gray0d'
          )}>
          <div className="flex w-full items-center justify-between px-5">
            <h1 className="my-0 text-center text-xl uppercase text-text2 dark:text-text2d">Claim</h1>
            <BaseButton
              className="!p-0 text-gray1 hover:text-gray2 dark:text-gray1d hover:dark:text-gray2d"
              onClick={onClose}>
              <XMarkIcon className="h-20px w-20px text-inherit" />
            </BaseButton>
          </div>
          <div className="h-[1px] w-full bg-gray1 dark:bg-gray0d" />
          <div className="w-full px-4 space-y-1">
            <div className="w-full flex items-center justify-between">
              <AssetData asset={tcyInfo.asset} network={network} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-14 text-text2 dark:text-text2d">Claimable Amount:</span>
              <span className="text-14 text-text2 dark:text-text2d">
                {formatAssetAmountCurrency({
                  asset: AssetTCY,
                  amount: baseToAsset(tcyInfo.amount),
                  trimZeros: true,
                  decimal: 2
                })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-14 text-text2 dark:text-text2d">Memo:</span>
              <span className="text-14 text-text2 dark:text-text2d">{tcyInfo.memo}</span>
            </div>
            <div className="flex items-center justify-between">
              <Fees fees={uiFeesRD} />
            </div>
          </div>
          <div className="h-[1px] w-full bg-gray1 dark:bg-gray0d" />
          <div className="flex w-full items-center justify-end px-4">
            <FlatButton className="mt-10px min-w-[200px]" type="submit" size="large" onClick={onClaim}>
              Claim
            </FlatButton>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
