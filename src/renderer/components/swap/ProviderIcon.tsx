import { useMemo } from 'react'

import clsx from 'clsx'
import ChainflipIcon from '../../assets/png/asset-flip.png'
import MayaIcon from '../../assets/png/asset-maya.png'
import ThorchainIcon from '../../assets/svg/asset-rune.svg?url'

type Props = {
  className?: string
  protocol: string
}

export const ProviderIcon = ({ className, protocol }: Props) => {
  const providerIcon = useMemo(() => {
    const uppercasedProtocol = protocol.toUpperCase()

    if (uppercasedProtocol === 'THORCHAIN' || uppercasedProtocol === 'THOR') return ThorchainIcon
    if (uppercasedProtocol === 'MAYACHAIN' || uppercasedProtocol === 'MAYA') return MayaIcon
    if (uppercasedProtocol === 'CHAINFLIP') return ChainflipIcon

    return null
  }, [protocol])

  return providerIcon ? (
    <img className={clsx('h-6 w-6 rounded-full', className)} src={providerIcon} alt={`${protocol} provider`} />
  ) : (
    <></>
  )
}
