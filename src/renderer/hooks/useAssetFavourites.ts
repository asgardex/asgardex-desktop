import { AnyAsset } from '@xchainjs/xchain-util'
import { useObservableState } from 'observable-hooks'

import { favourites$, toggleFavourite } from '../services/storage/assetFavourites'

const EMPTY_FAVOURITES: AnyAsset[] = []

export const useAssetFavourites = () => {
  const favourites = useObservableState(favourites$, EMPTY_FAVOURITES)
  return { favourites, toggleFavourite }
}
