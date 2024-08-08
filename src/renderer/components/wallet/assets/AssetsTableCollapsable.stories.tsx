import * as RD from '@devexperts/remote-data-ts'
import { Meta } from '@storybook/react'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { assetToString, baseAmount } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'

import { thorDetails } from '../../../../shared/api/types'
import { getMockRDValueFactory, RDStatus } from '../../../../shared/mock/rdByStatus'
import { AssetBTC, AssetETH, AssetLTC, AssetRuneNative, AssetMaya, AssetCacao } from '../../../../shared/utils/asset'
import { EnabledChain, isSupportedChain } from '../../../../shared/utils/chain'
import { WalletType } from '../../../../shared/wallet/types'
import { RUNE_PRICE_POOL } from '../../../helpers/poolHelper'
import { MAYA_PRICE_POOL } from '../../../helpers/poolHelperMaya'
import { WalletBalances } from '../../../services/clients'
import { ApiError, ChainBalances, ErrorId, SelectedWalletAsset } from '../../../services/wallet/types'
import { AssetsTableCollapsable } from './index'

const apiError: ApiError = { errorId: ErrorId.GET_BALANCES, msg: 'error message' }

const selectAssetHandler = ({ asset, walletType, walletAddress }: SelectedWalletAsset) =>
  console.log('selectAssetHandler params ', assetToString(asset), walletType, walletAddress)

const assetHandler = ({ asset, walletType, walletAddress }: SelectedWalletAsset) =>
  console.log('assetHandler params ', assetToString(asset), walletType, walletAddress)
const disableRefresh = false
const balances: Partial<Record<EnabledChain, ChainBalances>> = {
  [MAYAChain]: [
    {
      walletType: 'keystore',
      walletAddress: O.some('doge keystore'),

      chain: MAYAChain,
      balances: RD.success([
        {
          walletType: 'keystore',
          amount: baseAmount('1000000'),
          asset: AssetMaya,
          walletAddress: 'Maya wallet address',
          walletAccount: 0,
          walletIndex: 0,
          hdMode: 'default'
        },
        {
          walletType: 'keystore',
          amount: baseAmount('300000000'),
          asset: AssetCacao,
          walletAddress: 'Maya wallet address',
          walletAccount: 0,
          walletIndex: 0,
          hdMode: 'default'
        }
      ]),
      balancesType: 'all'
    }
  ],
  [BTCChain]: [
    {
      walletType: 'keystore',
      walletAddress: O.some('btc keystore'),
      chain: BTCChain,
      balances: RD.success([
        {
          walletType: 'keystore',
          amount: baseAmount('1000000'),
          asset: AssetBTC,
          walletAddress: 'DOGE wallet address',
          walletAccount: 0,
          walletIndex: 0,
          hdMode: 'default'
        }
      ]),
      balancesType: 'all'
    }
  ],
  [ETHChain]: [
    {
      walletType: 'keystore',
      walletAddress: O.some('eth keystore'),
      chain: ETHChain,
      balances: RD.success([
        {
          walletType: 'keystore',
          amount: baseAmount('300000000'),
          asset: AssetETH,
          walletAddress: 'ETH wallet address',
          walletAccount: 0,
          walletIndex: 0,
          hdMode: 'default'
        }
      ]),
      balancesType: 'all'
    }
  ],
  [THORChain]: [
    {
      walletType: 'keystore',
      walletAddress: O.some('thor keystore'),
      chain: THORChain,
      balances: RD.success([
        {
          walletType: 'keystore',
          amount: baseAmount('1000000'),
          asset: AssetRuneNative,
          walletAddress: 'DOGE wallet address',
          walletAccount: 0,
          walletIndex: 0,
          hdMode: 'default'
        }
      ]),
      balancesType: 'all'
    }
  ],
  [LTCChain]: [
    {
      walletType: 'keystore',
      walletAddress: O.some('ltc keystore'),
      chain: LTCChain,
      balances: RD.success([
        {
          walletType: 'keystore',
          amount: baseAmount('1000000'),
          asset: AssetLTC,
          walletAddress: 'LTC wallet address',
          walletAccount: 0,
          walletIndex: 0,
          hdMode: 'default'
        }
      ]),
      balancesType: 'all'
    }
  ]
}

const argTypes = Object.keys(balances).reduce(
  (acc, chain) => ({
    ...acc,
    [chain]: { control: { type: 'select', options: ['initial', 'pending', 'error', 'success'] } }
  }),
  {}
)

const getBalance = (chain: EnabledChain, status: RDStatus | undefined, walletType: WalletType) =>
  getMockRDValueFactory(
    () =>
      FP.pipe(
        balances[chain],
        O.fromNullable,
        O.chain(A.findFirst((chainBalance) => chainBalance.walletType === walletType)),
        O.map(({ balances }) => balances),
        O.chain(RD.toOption),
        O.getOrElse((): WalletBalances => [])
      ),
    () => ({ ...apiError, msg: `${chain} error` })
  )(status)

const Template = (args: Partial<Record<EnabledChain, RDStatus>>) => {
  return (
    <AssetsTableCollapsable
      disableRefresh={disableRefresh}
      selectAssetHandler={selectAssetHandler}
      assetHandler={assetHandler}
      chainBalances={FP.pipe(
        Object.entries(balances),
        A.map(([chain, chainBalances]) =>
          FP.pipe(
            chainBalances || [],
            A.map((chainBalance) => ({
              ...chainBalance,
              balances: isSupportedChain(chain)
                ? getBalance(chain, args[chain], chainBalance.walletType)
                : RD.failure<ApiError>({ errorId: ErrorId.GET_BALANCES, msg: `${chain} not supported` })
            }))
          )
        ),
        A.flatten
      )}
      poolDetails={[]}
      poolDetailsMaya={[]}
      pendingPoolDetails={[]}
      pendingPoolsDetailsMaya={[]}
      poolsData={{}}
      poolsDataMaya={{}}
      pricePool={RUNE_PRICE_POOL}
      mayaPricePool={MAYA_PRICE_POOL}
      network={Network.Testnet}
      mimirHalt={RD.initial}
      hidePrivateData={false}
      dex={thorDetails}
      mayaScanPrice={RD.initial}
      disabledChains={[]}
    />
  )
}
export const Default = Template.bind({})

const meta: Meta<typeof Template> = {
  component: Template,
  title: 'Wallet/AssetsTableCollapsable',
  argTypes,
  args: argTypes
}
export default meta
