import { useCallback, useEffect } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { Address, Chain } from '@xchainjs/xchain-util'

import { truncateAddress } from '../../../helpers/addressHelper'
import { CopyLabel } from '../label'

export type Props = {
  address: Address
  chain: Chain
  network: Network
  className?: string
  enableCopy?: boolean
}

export const AddressEllipsis = (props: Props) => {
  const { address, chain, network, className, enableCopy = false } = props
  const prepEllipse = useCallback(
    (node: HTMLElement, txtToEllipse: HTMLElement, copyIcon: HTMLElement) => {
      const parent = node.parentElement
      if (parent) {
        if (txtToEllipse) {
          if (txtToEllipse.hasAttribute('data-original')) {
            txtToEllipse.textContent = txtToEllipse.getAttribute('data-original')
          }

          if (
            !(
              ellipse({
                parentNode: node.offsetWidth > parent.offsetWidth ? parent : node,
                txtNode: txtToEllipse,
                chain,
                network
              }) || enableCopy
            ) &&
            copyIcon
          ) {
            copyIcon.hidden = true
          } else {
            copyIcon.hidden = false
          }
        }
      }
    },
    [chain, network, enableCopy]
  )

  const prepareEllipse = () => {}

  const measuredParent = useCallback(
    (node: HTMLElement | null) => {
      if (node !== null) {
        const prepareEllipse = () =>
          prepEllipse(node, node.childNodes[0] as HTMLElement, node.childNodes[1] as HTMLElement)
        window.addEventListener('resize', prepareEllipse)
        prepareEllipse()
      }
    },
    [prepEllipse]
  )

  useEffect(() => {
    return () => window.removeEventListener('resize', prepareEllipse)
  }, [])

  return (
    <div className={className}>
      <div className="flex items-center break-keep break-normal space-x-1" ref={measuredParent}>
        <span className="text-text2 dark:text-text2d font-main">{address}</span>
        <CopyLabel iconClassName="!w-4 !h-4 text-turquoise" textToCopy={address} />
      </div>
    </div>
  )
}

const ellipse = ({
  parentNode,
  txtNode,
  chain,
  network
}: {
  parentNode: HTMLElement
  txtNode: HTMLElement
  chain: Chain
  network: Network
}): boolean => {
  const containerWidth = parentNode.offsetWidth
  const txtWidth = txtNode.offsetWidth

  if (txtWidth > containerWidth) {
    const str = txtNode.textContent
    if (str) {
      const txtChars = str.length
      const avgLetterSize = txtWidth / txtChars
      const canFit = containerWidth / avgLetterSize
      const delEachSide = (txtChars - canFit + 5) / 2

      if (txtNode.textContent) {
        txtNode.setAttribute('data-original', txtNode.textContent)
      }

      if (delEachSide) {
        txtNode.textContent = truncateAddress(str, chain, network)
        return true
      }
    }
  }

  return false
}
