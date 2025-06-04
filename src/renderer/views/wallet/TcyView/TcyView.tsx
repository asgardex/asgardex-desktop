import { useCallback, useState } from 'react'

import { InformationCircleIcon, RocketLaunchIcon } from '@heroicons/react/20/solid'
import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { AssetDOGE } from '@xchainjs/xchain-doge'
import { AssetETH } from '@xchainjs/xchain-ethereum'
import { AssetTCY } from '@xchainjs/xchain-thorchain'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { WalletPasswordConfirmationModal } from '../../../components/modal/confirmation'
import { AssetData } from '../../../components/uielements/assets/assetData'
import { FlatButton, RefreshButton } from '../../../components/uielements/button'
import { Tooltip } from '../../../components/uielements/common/Common.styles'
import { InputBigNumber } from '../../../components/uielements/input'
import { Slider } from '../../../components/uielements/slider'
import { AssetsNav } from '../../../components/wallet/assets'
import { useWalletContext } from '../../../contexts/WalletContext'
import { useNetwork } from '../../../hooks/useNetwork'
import { TcyClaimModal } from './TcyClaimModal'
import { TcyInfo, TcyOperation } from './types'

const tcyTabs = [TcyOperation.Claim, TcyOperation.Stake, TcyOperation.Unstake]

const tabTitle = {
  [TcyOperation.Claim]: 'tcy.claim',
  [TcyOperation.Stake]: 'tcy.stake',
  [TcyOperation.Unstake]: 'tcy.unstake'
}

const mockData: TcyInfo[] = [
  {
    asset: AssetBTC,
    amount: 0,
    isClaimed: false
  },
  {
    asset: AssetETH,
    amount: 0,
    isClaimed: false
  },
  {
    asset: AssetDOGE,
    amount: 0,
    isClaimed: false
  }
]

export const TcyView = () => {
  const { network } = useNetwork()
  const [activeTab, setActiveTab] = useState(TcyOperation.Claim)
  const [selectedAsset, setSelectedAsset] = useState<TcyInfo>()
  const [isClaimModalVisible, setClaimModalVisible] = useState(false)
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false)
  const intl = useIntl()
  const {
    keystoreService: { validatePassword$ }
  } = useWalletContext()

  const refreshHandler = useCallback(async () => {}, [])

  const handleClaim = useCallback((tcyInfo: TcyInfo) => {
    setSelectedAsset(tcyInfo)
    setClaimModalVisible(true)
  }, [])

  const onSuccess = useCallback(() => {
    if (activeTab === TcyOperation.Stake) console.log('STAKE SUCCESS')
    else if (activeTab === TcyOperation.Unstake) console.log('Unstake Success')

    setPasswordModalVisible(false)
  }, [activeTab])

  return (
    <>
      <div className="flex w-full justify-end pb-20px">
        <RefreshButton onClick={refreshHandler} />
      </div>

      <AssetsNav />

      <div className="relative grid grid-cols-8 gap-2 bg-bg1 dark:bg-bg1d rounded-b-lg space-x-0 space-y-2 sm:space-x-2 sm:space-y-0 py-8 px-4 sm:px-8">
        <div className="absolute w-full h-full backdrop-blur z-20 flex flex-col items-center justify-center gap-y-2 p-8">
          <RocketLaunchIcon className="cursor-pointer text-text1 dark:text-text1d w-8 h-8" />
          <span className="text-lg text-text1 dark:text-text1d">Coming Soon</span>
        </div>
        <div className="col-span-8 md:col-span-5">
          <div className="flex flex-col py-4 w-full border border-solid border-gray0 dark:border-gray0d rounded-lg ">
            <div className="flex flex-row space-x-4 px-4 pb-4 mb-4 border-b border-solid border-gray0 dark:border-gray0d">
              {tcyTabs.map((tab) => (
                <div key={tab} className="cursor-pointer" onClick={() => setActiveTab(tab)}>
                  <span
                    className={clsx('text-16', activeTab === tab ? 'text-turquoise' : 'text-text2 dark:text-text2d')}>
                    {intl.formatMessage({ id: tabTitle[tab] })}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-col px-4">
              {activeTab === TcyOperation.Claim && (
                <div>
                  <span className="text-text2 dark:text-text2d text-16">
                    {intl.formatMessage({ id: 'tcy.claimNotice' })}
                  </span>
                  <div className="mt-4 border border-solid border-gray0 dark:border-gray0d rounded-lg">
                    {mockData.map((tcyData, index) => (
                      <div key={index} className="flex items-center justify-between px-4">
                        <div className="flex items-center space-x-2">
                          <div className="min-w-[120px]">
                            <AssetData asset={tcyData.asset} network={network} />
                          </div>
                          <span className="text-text2 dark:text-text2d">{tcyData.amount}</span>
                        </div>
                        {!tcyData.isClaimed && (
                          <FlatButton
                            className="p-2 bg-turquoise text-white cursor-pointer rounded-lg text-11 uppercase"
                            onClick={() => handleClaim(tcyData)}>
                            {intl.formatMessage({ id: 'tcy.claim' })}
                          </FlatButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === TcyOperation.Stake && (
                <div className="flex flex-col space-y-2">
                  <span className="text-text2 dark:text-text2d text-16">
                    {intl.formatMessage({ id: 'tcy.stakeNotice' })}
                  </span>
                  <div className="flex items-center justify-between rounded-lg py-2 px-4 border border-gray0 dark:border-gray0d">
                    <div className="flex flex-col">
                      <InputBigNumber
                        size="xlarge"
                        ghost
                        decimal={8}
                        // override text style of input for acting as label only
                        className={clsx('w-full !px-0 leading-none text-text0 !opacity-100 dark:text-text0d')}
                      />

                      <p className="mb-0 font-main text-[14px] leading-none text-gray1 dark:text-gray1d">
                        Balance: 10,000
                      </p>
                    </div>
                    <AssetData asset={AssetTCY} network={network} />
                  </div>
                  <FlatButton
                    className="my-30px min-w-[200px]"
                    size="large"
                    color="primary"
                    onClick={() => setPasswordModalVisible(true)}>
                    {intl.formatMessage({ id: 'tcy.stake' })}
                  </FlatButton>
                </div>
              )}
              {activeTab === TcyOperation.Unstake && (
                <div className="flex flex-col space-y-2">
                  <span className="text-text2 dark:text-text2d text-16">
                    {intl.formatMessage({ id: 'tcy.unstakeNotice' })}
                  </span>
                  <div className="flex items-center justify-between rounded-lg py-2 px-4 border border-gray0 dark:border-gray0d">
                    <div className="flex flex-col">
                      <InputBigNumber
                        size="xlarge"
                        ghost
                        decimal={8}
                        // override text style of input for acting as label only
                        className={clsx('w-full !px-0 leading-none text-text0 !opacity-100 dark:text-text0d')}
                      />

                      <p className="mb-0 font-main text-[14px] leading-none text-gray1 dark:text-gray1d">
                        Balance: 10,000
                      </p>
                    </div>
                    <AssetData asset={AssetTCY} network={network} />
                  </div>
                  <Slider included={false} max={100} tooltipVisible tooltipPlacement={'top'} />
                  <FlatButton
                    className="my-30px min-w-[200px]"
                    size="large"
                    color="primary"
                    onClick={() => setPasswordModalVisible(true)}>
                    {intl.formatMessage({ id: 'tcy.unstake' })}
                  </FlatButton>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-span-8 md:col-span-3">
          <div className="flex flex-col py-4 w-full border border-solid border-gray0 dark:border-gray0d rounded-lg">
            <div className="flex flex-row space-x-2 px-4 pb-4 mb-4 border-b border-solid border-gray0 dark:border-gray0d">
              <span className="text-16 text-text2 dark:text-text2d">{intl.formatMessage({ id: 'tcy.status' })}</span>
            </div>

            <div className="flex flex-col space-y-2 px-4">
              <div className="flex items-center space-x-2">
                <span className="text-16 text-text2 dark:text-text2d">
                  {intl.formatMessage({ id: 'tcy.stakedAmount' })}
                </span>
                <Tooltip title={intl.formatMessage({ id: 'tcy.stakedAmountTooltip' })}>
                  <InformationCircleIcon className="cursor-pointer text-turquoise w-4 h-4" />
                </Tooltip>
              </div>
              <span className="text-turquoise">0 TCY</span>.
            </div>

            <div className="flex flex-col space-y-2 px-4">
              <div className="flex items-center space-x-2">
                <span className="text-16 text-text2 dark:text-text2d">Wallet Balance</span>
                <Tooltip title={intl.formatMessage({ id: 'tcy.walletBalanceTooltip' })}>
                  <InformationCircleIcon className="cursor-pointer text-turquoise w-4 h-4" />
                </Tooltip>
              </div>
              <span className="text-turquoise">0 TCY</span>
            </div>
          </div>
        </div>
      </div>
      {selectedAsset && (
        <TcyClaimModal
          isVisible={isClaimModalVisible}
          tcyInfo={selectedAsset}
          onClose={() => setClaimModalVisible(false)}
        />
      )}
      {isPasswordModalVisible && (
        <WalletPasswordConfirmationModal
          onSuccess={onSuccess}
          onClose={() => {
            setPasswordModalVisible(false)
          }}
          validatePassword$={validatePassword$}
        />
      )}
    </>
  )
}
