import React from 'react'

import { StopOutlined } from '@ant-design/icons'
import { Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { Col } from 'antd'
import { useIntl } from 'react-intl'

import { AssetCacao, AssetRuneNative } from '../../../../shared/utils/asset'
import { NodeInfo, Providers, NodeStatusEnum } from '../../../services/thorchain/types'
import * as Styled from './BondsTable.styles'

export const NodeAddress: React.FC<{ address: Address; network: Network }> = ({ address, network }) => (
  <Col xs={18} lg={20} xl={24}>
    <Styled.AddressEllipsis
      address={address}
      chain={address.startsWith('thor') ? THORChain : MAYAChain}
      network={network}
    />
  </Col>
)

export const BondValue: React.FC<{ data: NodeInfo }> = ({ data }) => (
  <Col>
    <Styled.TextLabel align="right" nowrap>
      {formatAssetAmountCurrency({
        asset: data.address.startsWith('thor') ? AssetRuneNative : AssetCacao,
        amount: baseToAsset(data.bond),
        trimZeros: true,
        decimal: 0
      })}
    </Styled.TextLabel>
  </Col>
)

export const BondProviderValue: React.FC<{ providers: Providers }> = ({ providers }) => (
  <Col>
    <Styled.TextLabel align="right" nowrap>
      {formatAssetAmountCurrency({
        asset: providers.bondAddress.startsWith('thor') ? AssetRuneNative : AssetCacao,
        amount: baseToAsset(providers.bond),
        trimZeros: true,
        decimal: 0
      })}
    </Styled.TextLabel>
  </Col>
)

export const AwardValue: React.FC<{ data: NodeInfo }> = ({ data }) => (
  <Col>
    <Styled.TextLabel align="right" nowrap>
      {formatAssetAmountCurrency({
        asset: data.address.startsWith('thor') ? AssetRuneNative : AssetCacao,
        amount: baseToAsset(data.award),
        trimZeros: true,
        decimal: 0
      })}
    </Styled.TextLabel>
  </Col>
)

export const Status: React.FC<{ data: NodeInfo }> = ({ data }) => {
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

  return (
    <Styled.TextLabel align="center">{intl.formatMessage({ id: getStatusMessageId(data.status) })}</Styled.TextLabel>
  )
}

export const Delete: React.FC<{ deleteNode: () => void }> = ({ deleteNode }) => (
  <Styled.DeleteButton onClick={deleteNode}>
    <StopOutlined />
  </Styled.DeleteButton>
)
