export type State = {
  isLoading: boolean
  geckoPriceMap: Record<string, { usd: number }>
  lastUpdateInfo: {
    lastUpdatedAt: number | null
    lastCoinIds: string
  }
}
