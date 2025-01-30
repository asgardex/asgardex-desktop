import { useEffect, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AssetCacao, AssetMaya, CACAO_DECIMAL } from '@xchainjs/xchain-mayachain'
import { BaseAmount, CryptoAmount, baseAmount } from '@xchainjs/xchain-util'
import { useObservableState } from 'observable-hooks'
import { BehaviorSubject } from 'rxjs'
import { startWith } from 'rxjs/operators'

import { AssetUSDC } from '../const'
import { AssetWithAmount } from '../types/asgardex'

export type MayaPriceResponse = {
  mayaPriceInCacao: number
  mayaPriceInUsd: number
  cacaoPriceInUsd: number
  info: string
}

export type MayaScanPrice = {
  mayaPriceInCacao: AssetWithAmount
  mayaPriceInUsd: AssetWithAmount
  cacaoPriceInUsd: AssetWithAmount
}

export type MayaScanPriceRD = RD.RemoteData<Error, MayaScanPrice>

// Create a BehaviorSubject to hold the observable state
const mayaScanPriceSubject = new BehaviorSubject<MayaScanPriceRD>(RD.initial)

// Function to fetch Maya price data
const fetchMayaPrice = async () => {
  try {
    const response = await fetch('https://www.mayascan.org/api/maya/price')
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`)
    }
    const data: MayaPriceResponse = await response.json()
    const mayaInCacao = new CryptoAmount(baseAmount(data.mayaPriceInCacao, CACAO_DECIMAL), AssetCacao)
    const mayaInUsd = new CryptoAmount(baseAmount(data.mayaPriceInUsd, 4), AssetUSDC)
    const cacaoInUsd = new CryptoAmount(baseAmount(data.cacaoPriceInUsd, 6), AssetUSDC)
    const newPriceState = RD.success({
      mayaPriceInCacao: { asset: AssetMaya, amount: mayaInCacao.baseAmount },
      mayaPriceInUsd: { asset: AssetUSDC, amount: mayaInUsd.baseAmount },
      cacaoPriceInUsd: { asset: AssetUSDC, amount: cacaoInUsd.baseAmount }
    })
    mayaScanPriceSubject.next(newPriceState)
  } catch (error) {
    console.error('Failed to fetch Maya price:', error)
    mayaScanPriceSubject.next(RD.failure(error as Error))
  }
}

// Function to calculate Maya value in USD
export const calculateMayaValueInUSD = (
  mayaAmount: BaseAmount,
  mayaScanPriceRD: MayaScanPriceRD
): RD.RemoteData<Error, CryptoAmount> => {
  return RD.map((mayaScanPrice: MayaScanPrice) => {
    const mayaPriceInUsd = new CryptoAmount(mayaScanPrice.mayaPriceInUsd.amount.times(mayaAmount), AssetUSDC)
    return mayaPriceInUsd
  })(mayaScanPriceRD)
}

// Hook to use the observable state in components
export const useObserveMayaScanPrice = () => {
  const refetch = () => fetchMayaPrice()

  // Trigger the fetch on mount
  useEffect(() => {
    refetch()
  }, [])

  // Use the observable state
  const mayaScanPriceRD = useObservableState(
    mayaScanPriceSubject.pipe(startWith(mayaScanPriceSubject.value)),
    mayaScanPriceSubject.value
  )

  // Memoize the result to avoid unnecessary re-renders
  const memoizedMayaScanPriceRD = useMemo(() => mayaScanPriceRD, [mayaScanPriceRD])

  return { mayaScanPriceRD: memoizedMayaScanPriceRD, refetch }
}

// Hook to use the observable state in components
export const useObserveMayaScanP = () => {
  // Trigger the fetch on mount
  useEffect(() => {
    fetchMayaPrice()
  }, [])

  // Return the observable stream
  return mayaScanPriceSubject.asObservable()
}
