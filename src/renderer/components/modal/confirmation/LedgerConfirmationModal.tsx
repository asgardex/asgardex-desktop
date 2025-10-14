import { useCallback, useState } from 'react'

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { isCashAddress, toCashAddress, toLegacyAddress } from '@xchainjs/xchain-bitcoincash'
import { Network } from '@xchainjs/xchain-client'
import { Address, Chain } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { chainToString } from '../../../../shared/utils/chain'
import { getChainAsset, isBchChain, isMayaChain } from '../../../helpers/chainHelper'
import { AddressEllipsis } from '../../uielements/addressEllipsis'
import { Button } from '../../uielements/button'
import { CopyLabel, Label } from '../../uielements/label'
import { ConfirmationModal } from './ConfirmationModal'
import * as Styled from './LedgerConfirmationModal.styles'

type Addresses = { sender: Address; recipient: Address }

type Props = {
  visible: boolean
  network: Network
  onSuccess: FP.Lazy<void>
  onClose: FP.Lazy<void>
  chain: Chain
  description1?: string
  description2?: string
  addresses: O.Option<Addresses>
}

export const LedgerConfirmationModal = ({
  visible,
  onClose,
  onSuccess,
  chain,
  network,
  description1,
  description2 = '',
  addresses: oAddresses
}: Props) => {
  const intl = useIntl()

  // Mayachain uses the THORChain ledger app
  const getLedgerAppName = (chain: Chain): string => {
    if (isMayaChain(chain)) {
      return chainToString('THOR')
    }
    return chainToString(chain)
  }

  const asset = getChainAsset(chain)

  const [showAddresses, setShowAddresses] = useState(false)

  const renderBchAddresses = useCallback(
    ({ sender, recipient }: Addresses) => {
      const textToCopy = `${intl.formatMessage({ id: 'common.sender' })} (CashAddr)\n${
        isCashAddress(sender) ? sender : toCashAddress(sender)
      }\n${intl.formatMessage({ id: 'common.sender' })} (Legacy)\n${toLegacyAddress(sender)}\n${intl.formatMessage({
        id: 'common.recipient'
      })} (CashAddr)\n${isCashAddress(recipient) ? recipient : toCashAddress(recipient)}\n${intl.formatMessage({
        id: 'common.recipient'
      })} (Legacy)\n${toLegacyAddress(recipient)}`

      return (
        <>
          {/* Sender */}
          <div className="flex flex-col pt-5">
            <div className="flex flex-col items-center normal-case">
              <Styled.AddressTitle>{intl.formatMessage({ id: 'common.sender' })} (CashAddr)</Styled.AddressTitle>
              <AddressEllipsis
                network={network}
                chain={chain}
                address={isCashAddress(sender) ? sender : toCashAddress(sender)}
                enableCopy
              />
            </div>
            <div className="flex flex-col items-center normal-case">
              <Styled.AddressTitle>{intl.formatMessage({ id: 'common.sender' })} (Legacy)</Styled.AddressTitle>
              <AddressEllipsis network={network} chain={chain} address={toLegacyAddress(sender)} enableCopy />
            </div>
          </div>
          {/* Recipient */}
          <div className="flex flex-col pt-5">
            <div className="flex flex-col items-center normal-case">
              <Styled.AddressTitle>{intl.formatMessage({ id: 'common.recipient' })} (CashAddr)</Styled.AddressTitle>
              <AddressEllipsis
                network={network}
                chain={chain}
                address={isCashAddress(recipient) ? recipient : toCashAddress(recipient)}
                enableCopy
              />
            </div>
            <div className="flex flex-col items-center normal-case">
              <Styled.AddressTitle>{intl.formatMessage({ id: 'common.recipient' })} (Legacy)</Styled.AddressTitle>
              <AddressEllipsis network={network} chain={chain} address={toLegacyAddress(recipient)} enableCopy />
            </div>
          </div>
          <div className="flex items-center justify-center pt-4">
            <CopyLabel label={'Copy all addresses'} textToCopy={textToCopy} />
          </div>
        </>
      )
    },
    [chain, intl, network]
  )

  return (
    <ConfirmationModal
      visible={visible}
      onClose={onClose}
      onSuccess={onSuccess}
      title={intl.formatMessage({ id: 'ledger.title.sign' })}
      okText={intl.formatMessage({ id: 'common.next' })}
      content={
        <div className="flex flex-col">
          <div className="relative flex flex-col items-center mb-5">
            <Styled.LedgerConnect />
            <Styled.AssetIcon asset={asset} network={network} size="small" />
          </div>
          <Label align="center" color="gray" size="big">
            {description1 || intl.formatMessage({ id: 'ledger.needsconnected' }, { chain: getLedgerAppName(chain) })}
          </Label>
          {description2 && (
            <Label align="center" color="gray" size="big">
              {description2}
            </Label>
          )}
          {isBchChain(chain) &&
            FP.pipe(
              oAddresses,
              O.fold(
                () => <></>,
                (bchAddresses) => (
                  <>
                    <div className="flex items-center space-x-2">
                      <ExclamationTriangleIcon className="w-8 h-8" />
                      <Label size="small">
                        {intl.formatMessage({ id: 'ledger.legacyformat.note' }, { url: 'url' })}
                      </Label>
                    </div>

                    <div className="flex items-center justify-center">
                      <Button
                        className="shadow-none"
                        typevalue="transparent"
                        onClick={() => setShowAddresses((current) => !current)}>
                        {intl.formatMessage({
                          id: showAddresses ? 'ledger.legacyformat.hide' : 'ledger.legacyformat.show'
                        })}
                        <Styled.ExpandIcon className={clsx('w-4 h-4', showAddresses ? '-rotate-90' : 'rotate-90')} />
                      </Button>
                    </div>

                    {showAddresses && renderBchAddresses(bchAddresses)}
                  </>
                )
              )
            )}
        </div>
      }
    />
  )
}
