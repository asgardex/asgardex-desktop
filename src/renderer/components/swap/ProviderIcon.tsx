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
    if (protocol === 'Thorchain') return ThorchainIcon
    if (protocol === 'Mayachain') return MayaIcon
    if (protocol === 'Chainflip') return ChainflipIcon

    return null
  }, [protocol])

  return providerIcon ? (
    <img className={clsx('h-6 w-6 rounded-full', className)} src={providerIcon} alt="provider" />
  ) : (
    <></>
  )
}
