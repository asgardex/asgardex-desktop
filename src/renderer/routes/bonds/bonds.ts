import { Route } from '../types'

type RedirectUrl = string

export const base: Route<RedirectUrl | void> = {
  template: '/bonds',
  path(redirectUrl) {
    return redirectUrl ? `${this.template}?redirectUrl=${redirectUrl}` : this.template
  }
}

export type NodeDetailParams = { nodeAddress: string }

export const node: Route<NodeDetailParams> = {
  template: `${base.template}/node/:nodeAddress`,
  path({ nodeAddress }) {
    if (nodeAddress) {
      return `${base.template}/node/${nodeAddress}`
    }
    return base.path()
  }
}

export const rewards: Route<void> = {
  template: `${base.template}/rewards`,
  path() {
    return this.template
  }
}

export enum BondsTab {
  BondProvider = 'bondProvider',
  NodeOperator = 'nodeOperator'
}

export const TAB_QUERY_PARAM = 'tab'

export const isBondsTab = (value: unknown): value is BondsTab =>
  value === BondsTab.BondProvider || value === BondsTab.NodeOperator

export const basePathWithTab = (tab: BondsTab): string =>
  tab === BondsTab.BondProvider ? base.path() : `${base.path()}?${TAB_QUERY_PARAM}=${tab}`
