import * as RD from '@devexperts/remote-data-ts'
import { TvIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address, BaseAmount, baseAmount, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { Col } from 'antd'
import { option as O } from 'fp-ts'
import { useIntl } from 'react-intl'
import { AssetCacao, AssetRuneNative } from '../../../../shared/utils/asset'
import RemoveIcon from '../../../assets/svg/icon-remove.svg?react'
import { getUSDValue } from '../../../helpers/poolHelperMaya'
import {
  LiquidityProviderForPool,
  LiquidityProviderForPoolRD,
  MayaLpUnits,
  NodeInfo as NodeInfoMaya
} from '../../../services/mayachain/types'
import { PoolDetails, PoolDetailsRD } from '../../../services/midgard/mayaMigard/types'
import { PricePool } from '../../../services/midgard/midgardTypes'
import { NodeInfo, NodeStatusEnum } from '../../../services/thorchain/types'
import { AddressEllipsis } from '../../uielements/addressEllipsis'
import { Color, Label } from '../../uielements/label'

export const NodeAddress = ({ address, network }: { address: Address; network: Network }) => (
  <Col xs={18} lg={20} xl={24}>
    <AddressEllipsis
      className="font-light text-[12px] tracking-[1px] text-text1 dark:text-text1d normal-case"
      address={address}
      chain={address.startsWith('thor') ? THORChain : MAYAChain}
      network={network}
    />
  </Col>
)

export const BondValue = ({ data }: { data: NodeInfo | NodeInfoMaya }) => (
  <Col>
    <Label align="right" nowrap textTransform="uppercase">
      {formatAssetAmountCurrency({
        asset: AssetRuneNative,
        amount: baseToAsset(data.bond),
        trimZeros: true,
        decimal: 0
      })}
    </Label>
  </Col>
)
export const BondValueMaya = ({ data }: { data: NodeInfo | NodeInfoMaya }) => (
  <Col>
    <Label align="right" nowrap textTransform="uppercase">
      {formatAssetAmountCurrency({
        asset: AssetCacao,
        amount: baseToAsset(data.bond),
        trimZeros: true,
        decimal: 0
      })}
    </Label>
  </Col>
)

export const AwardValue = ({ data }: { data: NodeInfo | NodeInfoMaya }) => (
  <Col>
    <Label align="right" nowrap textTransform="uppercase">
      {formatAssetAmountCurrency({
        asset: data.address.startsWith('thor') ? AssetRuneNative : AssetCacao,
        amount: baseToAsset(data.award),
        trimZeros: true,
        decimal: 0
      })}
    </Label>
  </Col>
)

export const Status = ({ data }: { data: NodeInfo | NodeInfoMaya }) => {
  const intl = useIntl()

  const getStatusMessageId = (status: NodeStatusEnum) => {
    switch (status) {
      case NodeStatusEnum.Active: {
        return 'bonds.status.active'
      }
      case NodeStatusEnum.Ready: {
        return 'bonds.status.ready'
      }
      case NodeStatusEnum.Standby: {
        return 'bonds.status.standby'
      }
      case NodeStatusEnum.Disabled: {
        return 'bonds.status.disabled'
      }
      case NodeStatusEnum.Whitelisted: {
        return 'bonds.status.whitelisted'
      }
      default: {
        return 'common.unknown'
      }
    }
  }

  const getColor = (status: NodeStatusEnum): Color => {
    switch (status) {
      case NodeStatusEnum.Active:
        return 'primary'
      case NodeStatusEnum.Standby:
        return 'warning'
      case NodeStatusEnum.Disabled:
        return 'error'
      default:
        return 'normal'
    }
  }

  return (
    <Label className="!w-auto" align="center" color={getColor(data.status)} textTransform="uppercase">
      {intl.formatMessage({ id: getStatusMessageId(data.status) })}
    </Label>
  )
}

export const Watchlist = ({ addWatchlist }: { addWatchlist: () => void }) => (
  <TvIcon className="cursor-pointer text-turquoise w-5 h-5" onClick={addWatchlist} />
)

export const Delete = ({ deleteNode }: { deleteNode: () => void }) => (
  <RemoveIcon className="cursor-pointer w-5 h-5" onClick={deleteNode} />
)

type CalculateBondedAmountParams = {
  lpData: LiquidityProviderForPoolRD
  assetWithLpUnits: MayaLpUnits
  nodeAddress: string
  poolDetails: PoolDetailsRD
  pricePool: PricePool
}

type BondedPosition = {
  bondedAmount: BaseAmount
  bondedAmountValue: BaseAmount
}

export const calculateBondedAmount = ({
  lpData,
  assetWithLpUnits,
  nodeAddress,
  poolDetails,
  pricePool
}: CalculateBondedAmountParams): BondedPosition => {
  const calculatePercentage = (totalUnits: number, bondedUnits: number): number => {
    return totalUnits > 0 ? (bondedUnits / totalUnits) * 100 : 0
  }

  const defaultBondedPosition: BondedPosition = {
    bondedAmount: baseAmount(0),
    bondedAmountValue: baseAmount(0)
  }

  return RD.fold(
    () => defaultBondedPosition, // Initial: return default
    () => defaultBondedPosition, // Pending: return default
    () => defaultBondedPosition, // Failure: return default
    (lp: LiquidityProviderForPool) => {
      const matchingNode = lp.bondedNodes.find((node) => node.node_address === nodeAddress)
      const bondedUnits = matchingNode ? Number(matchingNode.units) : 0
      const percentage = calculatePercentage(assetWithLpUnits.units, bondedUnits)

      const assetDepositPriceOption = RD.fold(
        () => O.none, // Initial: no value
        () => O.none, // Pending: no value
        () => O.none, // Failure: no value
        (details: PoolDetails) =>
          getUSDValue({
            balance: { asset: assetWithLpUnits.asset, amount: lp.assetRedeemValue }, // Convert string to BaseAmount
            poolDetails: details,
            pricePool
          })
      )(poolDetails)

      const assetDepositPrice = O.getOrElse(() => baseAmount(0))(assetDepositPriceOption)

      const bondedAmount = lp.assetRedeemValue.times(percentage / 100) // Convert to BaseAmount first
      const bondedAmountValueBigNumber = assetDepositPrice.amount().multipliedBy(percentage / 100) // BigNumber
      const bondedAmountValue = baseAmount(bondedAmountValueBigNumber, assetDepositPrice.decimal) // Wrap as BaseAmount

      return {
        bondedAmount,
        bondedAmountValue
      }
    }
  )(lpData)
}
