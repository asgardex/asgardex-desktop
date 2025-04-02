import React, { useMemo } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { Chain } from '@xchainjs/xchain-util'
import { ItemType } from 'antd/lib/menu/hooks/useItems'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import { useIntl } from 'react-intl'

import { isLedgerWallet } from '../../../../../shared/utils/guard'
import { WalletType } from '../../../../../shared/wallet/types'
import { getChainAsset, isThorChain } from '../../../../helpers/chainHelper'
import * as Styled from './Interact.styles'
import { InteractType } from './Interact.types'

type Props = {
  children?: React.ReactNode
  interactType: InteractType
  interactTypeChanged: (type: InteractType) => void
  walletType: WalletType
  network: Network
  chain: Chain
}

export const Interact = ({ interactType, interactTypeChanged, network, walletType, chain, children }: Props) => {
  const intl = useIntl()
  const name = isThorChain(chain) ? InteractType.THORName : InteractType.MAYAName
  const tabs: Array<{ type: InteractType; label: string }> = useMemo(
    () => {
      const baseTabs = [
        { type: InteractType.Whitelist, label: intl.formatMessage({ id: 'deposit.interact.actions.whitelist' }) },
        { type: InteractType.Bond, label: intl.formatMessage({ id: 'deposit.interact.actions.bond' }) },
        { type: InteractType.Unbond, label: intl.formatMessage({ id: 'deposit.interact.actions.unbond' }) },
        { type: InteractType.Leave, label: intl.formatMessage({ id: 'deposit.interact.actions.leave' }) },
        { type: InteractType.Custom, label: intl.formatMessage({ id: 'common.custom' }) },
        { type: name, label: intl.formatMessage({ id: `common.${name}` }) }
      ]

      // Add RunePool tab only if the chain is not mayachain
      if (chain !== MAYAChain) {
        baseTabs.push({
          type: InteractType.RunePool,
          label: intl.formatMessage({ id: 'deposit.interact.actions.runePool' })
        })
      }

      return baseTabs
    },
    [intl, name, chain] // Add chain to the dependency array
  )
  const asset = getChainAsset(chain)

  return (
    <Styled.Container>
      <Styled.Header>
        <Styled.AssetIcon network={network} asset={asset} />
        <div>
          <Styled.HeaderTitleWrapper>
            <Styled.HeaderTitle>{intl.formatMessage({ id: 'deposit.interact.title' })}</Styled.HeaderTitle>
            {isLedgerWallet(walletType) && (
              <Styled.WalletTypeLabel>{intl.formatMessage({ id: 'ledger.title' })}</Styled.WalletTypeLabel>
            )}
          </Styled.HeaderTitleWrapper>
          <Styled.HeaderSubtitle>
            {intl.formatMessage({ id: 'deposit.interact.subtitle' }, { chain: chain })}
          </Styled.HeaderSubtitle>
        </div>
      </Styled.Header>

      <Styled.MenuDropdownGlobalStyles />
      <Styled.Menu
        mode="horizontal"
        selectedKeys={[interactType]}
        triggerSubMenuAction={'click'}
        items={FP.pipe(
          tabs,
          A.map<{ type: InteractType; label: string }, ItemType>(({ type, label }) => ({
            label: (
              <div className="interact-menu" key={type} onClick={() => interactTypeChanged(type)}>
                {label}
              </div>
            ),
            key: type
          }))
        )}
      />
      <div className="mt-4">{children}</div>
    </Styled.Container>
  )
}
