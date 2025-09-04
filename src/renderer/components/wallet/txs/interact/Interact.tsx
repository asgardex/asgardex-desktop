import React, { useMemo } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { Chain } from '@xchainjs/xchain-util'
import { ItemType } from 'antd/lib/menu/hooks/useItems'
import { array as A, function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { isLedgerWallet } from '../../../../../shared/utils/guard'
import { WalletType } from '../../../../../shared/wallet/types'
import { getChainAsset, isThorChain } from '../../../../helpers/chainHelper'
import { AssetIcon } from '../../../uielements/assets/assetIcon'
import { Label } from '../../../uielements/label'
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
      <div className="flex flex-col items-center justify-center mb-5 sm:justify-start sm:flex-row">
        <AssetIcon className="mr-0 mb-10px sm:mr-4 sm:mb-0" network={network} asset={asset} size="big" />
        <div>
          <div className="flex items-center justify-center sm:justify-start">
            <Label className="w-auto text-center sm:text-left text-[24px]" textTransform="uppercase">
              {intl.formatMessage({ id: 'deposit.interact.title' })}
            </Label>
            {isLedgerWallet(walletType) && (
              <Styled.WalletTypeLabel>{intl.formatMessage({ id: 'ledger.title' })}</Styled.WalletTypeLabel>
            )}
          </div>
          <Label className="w-auto text-center sm:text-left" color="gray" size="big" textTransform="uppercase">
            {intl.formatMessage({ id: 'deposit.interact.subtitle' }, { chain: chain })}
          </Label>
        </div>
      </div>

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
