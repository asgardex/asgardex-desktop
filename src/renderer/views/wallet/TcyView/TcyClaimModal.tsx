import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

import { AssetData } from '../../../components/uielements/assets/assetData'
import { BaseButton, FlatButton } from '../../../components/uielements/button'
import { useNetwork } from '../../../hooks/useNetwork'
import { TcyInfo } from './types'

export type Props = {
  isVisible: boolean
  tcyInfo: TcyInfo
  onClose: () => void
}

export const TcyClaimModal = (props: Props) => {
  const { isVisible, tcyInfo, onClose } = props
  const { network } = useNetwork()

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
              <span className="text-14 text-text2 dark:text-text2d">{(Math.random() / 100).toFixed(6)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-14 text-text2 dark:text-text2d">Claimable Amount:</span>
              <span className="text-14 text-text2 dark:text-text2d">{tcyInfo.amount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-14 text-text2 dark:text-text2d">Memo:</span>
              <span className="text-14 text-text2 dark:text-text2d">TCY:THORxxxxxxxxxxxxxxx</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-14 text-text2 dark:text-text2d">Gas:</span>
              <span className="text-14 text-text2 dark:text-text2d">
                {(Math.random() / 1000).toFixed(6)} {tcyInfo.asset.ticker}
              </span>
            </div>
          </div>
          <div className="h-[1px] w-full bg-gray1 dark:bg-gray0d" />
          <div className="flex w-full items-center justify-end px-4">
            <FlatButton size="large">Claim</FlatButton>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
