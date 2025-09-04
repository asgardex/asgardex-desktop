import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { WalletAddress, WalletType } from '../../../shared/wallet/types'
import { eqAddress, eqOAddress } from '../../helpers/fp/eq'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { PoolDetailRD as PoolDetailMayaRD } from '../../services/midgard/mayaMigard/types'
import { PoolDetailRD, PoolShareRD, PoolSharesRD } from '../../services/midgard/midgardTypes'
import { getSharesByAssetAndType } from '../../services/midgard/thorMidgard/utils'
import { MimirHalt } from '../../services/thorchain/types'
import { KeystoreState } from '../../services/wallet/types'
import { hasImportedKeystore, isLocked } from '../../services/wallet/util'
import { AssetWithDecimal } from '../../types/asgardex'
import { Props as SymDepositContentProps } from '../../views/deposit/add/SymDepositView.types'
import { ShareViewProps } from '../../views/deposit/share/ShareView'
import { Props as WidthdrawContentProps } from '../../views/deposit/withdraw/WithdrawDepositView.types'
import { Tabs } from '../tabs'
import { AddWallet } from '../wallet/add'

type TabKey = 'deposit-sym' | 'deposit-saver' | 'withdraw-sym' | 'withdraw-saver-asset'

type Tab = {
  key: TabKey
  label: string
  disabled: boolean
  content: JSX.Element
}

export type Props = {
  haltedChains: Chain[]
  mimirHalt: MimirHalt
  protocol: Chain
  asset: AssetWithDecimal
  shares: PoolSharesRD
  poolDetail: PoolDetailRD | PoolDetailMayaRD
  ShareContent: React.ComponentType<ShareViewProps>
  SymDepositContent: React.ComponentType<SymDepositContentProps>
  WidthdrawContent: React.ComponentType<WidthdrawContentProps>
  keystoreState: KeystoreState
  dexWalletAddress: WalletAddress
  assetWalletAddress: WalletAddress
  assetWalletType: WalletType
  dexWalletType: WalletType
}

export const Deposit = (props: Props) => {
  const {
    protocol,
    asset: assetWD,
    ShareContent,
    haltedChains,
    mimirHalt,
    SymDepositContent,
    WidthdrawContent,
    keystoreState,
    shares: poolSharesRD,
    poolDetail: poolDetailRD,
    dexWalletAddress,
    assetWalletAddress,
    assetWalletType,
    dexWalletType
  } = props

  const { asset } = assetWD
  const intl = useIntl()

  const isDesktopView = useBreakpoint()?.md ?? false

  const walletIsImported = useMemo(() => hasImportedKeystore(keystoreState), [keystoreState])
  const walletIsLocked = useMemo(() => isLocked(keystoreState), [keystoreState])

  const symPoolShare: PoolShareRD = useMemo(
    () =>
      FP.pipe(
        poolSharesRD,
        RD.map((shares) => getSharesByAssetAndType({ shares, asset, type: 'sym' })),
        RD.map((oPoolShare) =>
          FP.pipe(
            oPoolShare,
            O.filter(({ runeAddress, assetAddress: oAssetAddress }) => {
              // use shares of current selected addresses only
              return (
                eqOAddress.equals(runeAddress, O.some(dexWalletAddress.address)) &&
                FP.pipe(
                  oAssetAddress,
                  O.map((assetAddress) =>
                    // Midgard returns addresses in lowercase - it might be changed in the future
                    eqAddress.equals(assetAddress.toLowerCase(), assetWalletAddress.address.toLowerCase())
                  ),
                  O.getOrElse<boolean>(() => false)
                )
              )
            })
          )
        )
      ),
    [asset, assetWalletAddress, poolSharesRD, dexWalletAddress]
  )

  const hasPoolShare = (poolShare: PoolShareRD): boolean => FP.pipe(poolShare, RD.toOption, O.flatten, O.isSome)
  const hasSymPoolShare: boolean = useMemo(() => hasPoolShare(symPoolShare), [symPoolShare])

  const tabs = useMemo(
    (): Tab[] => [
      {
        key: 'deposit-sym',
        disabled: false,
        label: intl.formatMessage({ id: 'deposit.add.sym' }),
        content: (
          <SymDepositContent
            poolDetail={poolDetailRD}
            asset={assetWD}
            dexWalletAddress={dexWalletAddress}
            assetWalletAddress={assetWalletAddress}
            haltedChains={haltedChains}
            mimirHalt={mimirHalt}
            assetWalletType={assetWalletType}
            dexWalletType={dexWalletType}
          />
        )
      },
      {
        key: 'withdraw-sym',
        disabled: !hasSymPoolShare,
        label: intl.formatMessage({ id: 'deposit.withdraw.sym' }),
        content: (
          <WidthdrawContent
            poolDetail={poolDetailRD}
            protocol={protocol}
            asset={assetWD}
            dexWalletAddress={dexWalletAddress}
            assetWalletAddress={assetWalletAddress}
            poolShare={symPoolShare}
            haltedChains={haltedChains}
            mimirHalt={mimirHalt}
          />
        )
      }
    ],
    [
      intl,
      SymDepositContent,
      poolDetailRD,
      protocol,
      assetWD,
      dexWalletAddress,
      assetWalletAddress,
      haltedChains,
      mimirHalt,
      assetWalletType,
      dexWalletType,
      hasSymPoolShare,
      WidthdrawContent,
      symPoolShare
    ]
  )

  return (
    <div className="flex flex-col flex-1 w-full">
      <div className="flex flex-wrap w-full min-h-full">
        {walletIsImported && !walletIsLocked ? (
          <div className="w-full grid grid-cols-8 gap-4">
            <div className="col-span-8 xl:col-span-5 bg-bg1 dark:bg-bg1d">
              <Tabs className="flex items-center justify-center" tabs={tabs} hasPadding defaultIndex={0} />
            </div>
            <div className="col-span-8 xl:col-span-3">
              <div className="flex justify-center bg-bg0 dark:bg-bg0d min-h-[300px] xl:min-h-full">
                <ShareContent
                  protocol={protocol}
                  poolDetail={poolDetailRD}
                  asset={assetWD}
                  poolShare={symPoolShare}
                  smallWidth={!isDesktopView}
                />
              </div>
            </div>
          </div>
        ) : (
          <AddWallet isLocked={walletIsImported && walletIsLocked} />
        )}
      </div>
    </div>
  )
}
