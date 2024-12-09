export type State = {
  isLoading: boolean
  geckoPriceMap: Record<string, { usd: number }>
  lastUpdatedAt: number | null
}
