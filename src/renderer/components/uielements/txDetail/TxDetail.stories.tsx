import { ArgTypes, Meta } from '@storybook/react'
import { Network } from '@xchainjs/xchain-client'
import { assetAmount, assetFromString, assetToBase, assetToString } from '@xchainjs/xchain-util'
import { array as A, function as FP, option as O } from 'fp-ts'

import { AssetBCH, AssetBTC, AssetRuneNative } from '../../../../shared/utils/asset'
import { TxDetail } from './TxDetail'

const getValues = (firstAsset: string, secondAsset: string, firstValue: number, secondValue: number) => {
  const first = FP.pipe(
    O.fromNullable(assetFromString(firstAsset)),
    O.map((asset) => ({ asset, amount: assetToBase(assetAmount(firstValue)) }))
  )
  const second = FP.pipe(
    O.fromNullable(assetFromString(secondAsset)),
    O.map((asset) => ({ asset, amount: assetToBase(assetAmount(secondValue)) }))
  )

  return FP.pipe([first, second], A.filterMap(FP.identity))
}

type TemplateArgs = {
  firstInValue: number
  secondInValue: number
  firstOutValue: number
  secondOutValue: number
  firstInAsset: string
  secondInAsset: string
  firstOutAsset: string
  secondOutAsset: string
  isDesktopView: boolean
}

const Template = ({
  firstInValue,
  secondInValue,
  firstOutValue,
  secondOutValue,
  firstInAsset,
  secondInAsset,
  firstOutAsset,
  secondOutAsset,
  isDesktopView
}: TemplateArgs) => {
  return (
    <TxDetail
      network={Network.Mainnet}
      type={'SWAP'}
      date={<>12-12-3 1231</>}
      incomes={getValues(firstInAsset, secondInAsset, firstInValue, secondInValue)}
      outgos={getValues(firstOutAsset, secondOutAsset, firstOutValue, secondOutValue)}
      slip={1.23}
      fees={[
        {
          asset: AssetRuneNative,
          amount: assetToBase(assetAmount(1))
        }
      ]}
      isDesktopView={isDesktopView}
    />
  )
}

const stringAssetsOrNone = [AssetRuneNative, AssetBCH, AssetBTC].map(assetToString)
stringAssetsOrNone.unshift('none')

const argTypes: ArgTypes<TemplateArgs> = {
  firstInAsset: {
    control: {
      type: 'select',
      options: stringAssetsOrNone
    }
  },
  firstInValue: {
    control: { type: 'number', min: 0, step: 0.0001 }
  },
  secondInAsset: {
    control: {
      type: 'select',
      options: stringAssetsOrNone
    }
  },
  secondInValue: {
    control: { type: 'number', min: 0, step: 0.0001 }
  },

  firstOutAsset: {
    control: {
      type: 'select',
      options: stringAssetsOrNone
    }
  },
  firstOutValue: {
    control: { type: 'number', min: 0, step: 0.0001 }
  },
  secondOutAsset: {
    control: {
      type: 'select',
      options: stringAssetsOrNone
    }
  },
  secondOutValue: {
    control: { type: 'number', min: 0, step: 0.0001 }
  },
  isDesktopView: {
    name: 'isDesktopView',
    control: {
      type: 'boolean'
    }
  }
}

export const Default = Template.bind({})

const meta: Meta<typeof Template> = {
  component: Template,
  title: 'Components/TxDetail',
  argTypes,
  args: {
    firstInValue: 1.23,
    secondInValue: 0,
    firstOutValue: 23.34,
    secondOutValue: 0,
    firstInAsset: stringAssetsOrNone[1],
    secondInAsset: stringAssetsOrNone[0],
    firstOutAsset: stringAssetsOrNone[2],
    secondOutAsset: stringAssetsOrNone[0],
    isDesktopView: true
  }
}

export default meta
