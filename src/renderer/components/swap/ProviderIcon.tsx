import { useMemo } from 'react'

/* eslint-disable import/no-webpack-loader-syntax */
import ThorchainIcon from '!file-loader!../../assets/svg/asset-rune.svg'
import ChainflipIcon from '../../assets/png/asset-flip.png'
import MayaIcon from '../../assets/png/asset-maya.png'

type Props = {
  protocol: string
}

export const ProviderIcon = ({ protocol }: Props) => {
  const providerIcon = useMemo(() => {
    if (protocol === 'Thorchain') return ThorchainIcon
    if (protocol === 'Mayachain') return MayaIcon
    if (protocol === 'Chainflip') return ChainflipIcon

    return null
  }, [protocol])

  return providerIcon ? <img className="h-6 w-6 rounded-full" src={providerIcon} alt="provider" /> : <></>
}
