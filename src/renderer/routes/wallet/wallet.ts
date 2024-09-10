import { InteractType } from '../../components/wallet/txs/interact/Interact.types'
import { Route } from '../types'

export * as imports from './imports'

export * as create from './create'

type RedirectUrl = string

export const base: Route<RedirectUrl | void> = {
  template: '/wallet',
  path(redirectUrl) {
    return redirectUrl ? `${this.template}?redirectUrl=${redirectUrl}` : this.template
  }
}

export const noWallet: Route<void> = {
  template: `${base.template}/noWallet`,
  path() {
    return this.template
  }
}

export const REDIRECT_PARAMETER_NAME = 'redirectUrl'

export const locked: Route<RedirectUrl | void> = {
  template: `${base.template}/locked`,
  path(redirectUrl) {
    return redirectUrl ? `${this.template}?${REDIRECT_PARAMETER_NAME}=${redirectUrl}` : this.template
  }
}

export const assets: Route<void> = {
  template: `${base.template}/assets`,
  path() {
    return this.template
  }
}
export const tradeAssets: Route<void> = {
  template: `${base.template}/tradeAssets`,
  path() {
    return this.template
  }
}

export const poolShares: Route<void> = {
  template: `${base.template}/poolshares`,
  path() {
    return this.template
  }
}
export const savers: Route<void> = {
  template: `${base.template}/savers`,
  path() {
    return this.template
  }
}
export const runepool: Route<void> = {
  template: `${base.template}/runepool`,
  path() {
    return this.template
  }
}

export type InteractParams = {
  interactType: InteractType
}
export const interact: Route<InteractParams> = {
  template: `${assets.template}/interact/:interactType`,
  path({ interactType }) {
    return `${assets.template}/interact/${interactType}`
  }
}

export type BondParams = {
  interactType: string
}
export const bondInteract: Route<BondParams> = {
  template: `${assets.template}/interact/:interactType`,
  path({ interactType }) {
    const basePath = `${assets.template}/interact/${interactType}`
    return `${basePath}`
  }
}

export const bonds: Route<void> = {
  template: `${base.template}/bonds`,
  path() {
    return this.template
  }
}

export const assetDetail: Route<void> = {
  template: `${assets.template}/detail`,
  path() {
    return this.template
  }
}

export const send: Route<void> = {
  template: `${assetDetail.template}/send`,
  path() {
    return this.template
  }
}

export const history: Route<void> = {
  template: `${base.template}/history`,
  path() {
    return this.template
  }
}
