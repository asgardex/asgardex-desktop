import { useEffect, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AssetCacao, AssetMaya, CACAO_DECIMAL } from '@xchainjs/xchain-mayachain'
import { BaseAmount, CryptoAmount, baseAmount } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'

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

export const useMayaScanPrice = () => {
  const [mayaScanPriceRD, setMayaScanPriceRD] = useState<MayaScanPriceRD>(RD.initial)

  useEffect(() => {
    setMayaScanPriceRD(RD.pending)
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
        setMayaScanPriceRD(
          RD.success({
            mayaPriceInCacao: { asset: AssetMaya, amount: mayaInCacao.baseAmount },
            mayaPriceInUsd: { asset: AssetUSDC, amount: mayaInUsd.baseAmount },
            cacaoPriceInUsd: { asset: AssetUSDC, amount: cacaoInUsd.baseAmount }
          })
        )
      } catch (error) {
        setMayaScanPriceRD(RD.failure(error as Error))
      }
    }

    fetchMayaPrice()
  }, [])

  return { mayaScanPriceRD }
}

export const calculateMayaValueInUSD = (
  mayaAmount: BaseAmount,
  mayaScanPriceRD: MayaScanPriceRD
): RD.RemoteData<Error, CryptoAmount> => {
  return FP.pipe(
    mayaScanPriceRD,
    RD.map((mayaScanPrice) => {
      const mayaPriceInUsd = new CryptoAmount(mayaScanPrice.mayaPriceInUsd.amount.times(mayaAmount), AssetUSDC)
      return mayaPriceInUsd
    })
  )
}
