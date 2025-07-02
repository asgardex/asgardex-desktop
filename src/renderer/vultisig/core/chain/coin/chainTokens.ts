import { mergeRecordsOfArrays } from '../../../lib/utils/record/mergeRecordsOfArrays'
import { recordMap } from '../../../lib/utils/record/recordMap'
import { withoutUndefinedFields } from '../../../lib/utils/record/withoutUndefinedFields'
import { Chain, IbcEnabledCosmosChain } from '../../chain/Chain'

import { kujiraCoinsMigratedToThorChainMetadata } from '../chains/cosmos/thor/kujira-merge'
import { kujiraCoinsOnThorChain } from '../chains/cosmos/thor/kujira-merge/kujiraCoinsOnThorChain'
import { KnownCoin, KnownCoinMetadata } from './Coin'
import { ibcTransferrableTokensPerChain } from './ibc'
import { getMissingIBCTokens } from './utils/getMissingIbcTokens'
import { patchTokensWithIBCIds } from './utils/patchTokensWithIBCIds'

type LeanChainTokensRecord = Record<Chain, Record<string, KnownCoinMetadata>>

const leanChainNativeTokens: Partial<LeanChainTokensRecord> = {
  [Chain.MayaChain]: {
    maya: {
      ticker: 'MAYA',
      logo: 'maya',
      decimals: 4
    }
  },
  [Chain.TerraClassic]: {
    uusd: {
      ticker: 'USTC',
      logo: 'ustc.png',
      decimals: 6,
      priceProviderId: 'terrausd'
    }
  }
}

const leanChainNonNativeTokens: Partial<LeanChainTokensRecord> = {
  [Chain.THORChain]: {
    tcy: {
      ticker: 'TCY',
      logo: 'tcy.png',
      decimals: 8,
      priceProviderId: 'tcy'
    },
    ...kujiraCoinsOnThorChain
  },

  [Chain.Tron]: {
    TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t: {
      ticker: 'USDT',
      logo: 'usdt',
      decimals: 6,
      priceProviderId: 'tether'
    }
  },
  [Chain.Solana]: {
    JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: {
      ticker: 'JUP',
      logo: 'https://static.jup.ag/jup/icon.png',
      decimals: 6,
      priceProviderId: 'jupiter-exchange-solana'
    }
  },
  [Chain.Ethereum]: {
    '0xb788144DF611029C60b859DF47e79B7726C4DEBa': {
      ticker: 'VULT',
      logo: 'vult',
      decimals: 18
    },
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': {
      ticker: 'USDC',
      logo: 'usdc',
      decimals: 6,
      priceProviderId: 'usd-coin'
    },
    '0xdac17f958d2ee523a2206206994597c13d831ec7': {
      ticker: 'USDT',
      logo: 'usdt',
      decimals: 6,
      priceProviderId: 'tether'
    },
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': {
      ticker: 'UNI',
      logo: 'uni',
      decimals: 18,
      priceProviderId: 'uniswap'
    },
    '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': {
      ticker: 'MATIC',
      logo: 'matic',
      decimals: 18,
      priceProviderId: 'matic-network'
    },
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': {
      ticker: 'WBTC',
      logo: 'wbtc',
      decimals: 8,
      priceProviderId: 'wrapped-bitcoin'
    },
    '0x514910771af9ca656af840dff83e8264ecf986ca': {
      ticker: 'LINK',
      logo: 'link',
      decimals: 18
    },
    '0x826180541412d574cf1336d22c0c0a287822678a': {
      ticker: 'FLIP',
      logo: 'ChainFlip',
      decimals: 18,
      priceProviderId: 'chainflip'
    },
    '0x108a850856Db3f85d0269a2693D896B394C80325': {
      ticker: 'TGT',
      logo: 'tgt',
      decimals: 18,
      priceProviderId: 'thorwallet'
    },
    '0xc770eefad204b5180df6a14ee197d99d808ee52d': {
      ticker: 'FOX',
      logo: 'fox',
      decimals: 18,
      priceProviderId: 'shapeshift-fox-token'
    },
    '0x6b175474e89094c44da98b954eedeac495271d0f': {
      ticker: 'DAI',
      logo: 'dai',
      decimals: 18,
      priceProviderId: 'dai'
    },
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
      ticker: 'WETH',
      logo: 'weth',
      decimals: 18,
      priceProviderId: 'weth'
    },
    '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e': {
      ticker: 'YFI',
      logo: 'yfi',
      decimals: 18,
      priceProviderId: 'yearn-finance'
    },
    '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': {
      ticker: 'AAVE',
      logo: 'aave',
      decimals: 18,
      priceProviderId: 'aave'
    },
    '0xc00e94cb662c3520282e6f5717214004a7f26888': {
      ticker: 'COMP',
      logo: 'comp',
      decimals: 18,
      priceProviderId: 'compound-governance-token'
    },
    '0x0d8775f648430679a709e98d2b0cb6250d2887ef': {
      ticker: 'BAT',
      logo: 'bat',
      decimals: 18,
      priceProviderId: 'basic-attention-token'
    },
    '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f': {
      ticker: 'SNX',
      logo: 'snx',
      decimals: 18,
      priceProviderId: 'havven'
    },
    '0xba100000625a3754423978a60c9317c58a424e3d': {
      ticker: 'BAL',
      logo: 'bal',
      decimals: 18,
      priceProviderId: 'balancer'
    },
    '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2': {
      ticker: 'SUSHI',
      logo: 'sushi',
      decimals: 18,
      priceProviderId: 'sushi'
    },
    '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': {
      ticker: 'MKR',
      logo: 'mkr',
      decimals: 18,
      priceProviderId: 'maker'
    },
    '0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202': {
      ticker: 'KNC',
      logo: 'knc',
      decimals: 18,
      priceProviderId: 'kyber-network-crystal'
    },
    '0xc944e90c64b2c07662a292be6244bdf05cda44a7': {
      ticker: 'GRT',
      logo: 'grt',
      decimals: 18,
      priceProviderId: 'the-graph'
    },
    '0x6982508145454ce325ddbe47a25d4ec3d2311933': {
      ticker: 'PEPE',
      logo: 'pepe',
      decimals: 18,
      priceProviderId: 'pepe'
    }
  },
  [Chain.Avalanche]: {
    '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e': {
      ticker: 'USDC',
      logo: 'usdc',
      decimals: 6
    },
    '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7': {
      ticker: 'USDT',
      logo: 'usdt',
      decimals: 6
    },
    '0x152b9d0FdC40C096757F570A51E494bd4b943E50': {
      ticker: 'BTC.b',
      logo: 'btc',
      decimals: 8
    },
    '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE': {
      ticker: 'sAVAX',
      logo: 'savax',
      decimals: 18
    },
    '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd': {
      ticker: 'JOE',
      logo: 'joe',
      decimals: 18
    },
    '0x60781C2586D68229fde47564546784ab3fACA982': {
      ticker: 'PNG',
      logo: 'png',
      decimals: 18
    },
    '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7': {
      ticker: 'WAVAX',
      logo: 'avax',
      decimals: 18
    },
    '0x625E7708f30cA75bfd92586e17077590C60eb4cD': {
      ticker: 'aAvaUSDC',
      logo: 'aave',
      decimals: 6
    },
    '0x46B9144771Cb3195D66e4EDA643a7493fADCAF9D': {
      ticker: 'BLS',
      logo: 'bls',
      decimals: 18
    }
  },
  [Chain.BSC]: {
    '0x55d398326f99059fF775485246999027B3197955': {
      ticker: 'USDT',
      logo: 'usdt',
      decimals: 18
    },
    '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d': {
      ticker: 'USDC',
      logo: 'usdc',
      decimals: 18
    },
    '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3': {
      ticker: 'DAI',
      logo: 'dai',
      decimals: 18
    },
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
      ticker: 'WETH',
      logo: 'weth',
      decimals: 18
    },
    '0xfb6115445bff7b52feb98650c87f44907e58f802': {
      ticker: 'AAVE',
      logo: 'aave',
      decimals: 18
    },
    '0x52ce071bd9b1c4b00a0b92d298c512478cad67e8': {
      ticker: 'COMP',
      logo: 'comp',
      decimals: 18
    },
    '0x947950bcc74888a40ffa2593c5798f11fc9124c4': {
      ticker: 'SUSHI',
      logo: 'sushi',
      decimals: 18
    },
    '0xfe56d5892bdffc7bf58f2e84be1b2c32d21c308b': {
      ticker: 'KNC',
      logo: 'knc',
      decimals: 18
    },
    '0x25d887ce7a35172c62febfd67a1856f20faebb00': {
      ticker: 'PEPE',
      logo: 'pepe',
      decimals: 18
    }
  },
  [Chain.Base]: {
    '0x6b9bb36519538e0C073894E964E90172E1c0B41F': {
      ticker: 'WEWE',
      logo: 'wewe',
      decimals: 18
    },
    '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb': {
      ticker: 'DAI',
      logo: 'dai',
      decimals: 18,
      priceProviderId: 'dai'
    },
    '0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c': {
      ticker: 'rETH',
      logo: 'reth',
      decimals: 18,
      priceProviderId: 'reth'
    },
    '0x2416092f143378750bb29b79eD961ab195CcEea5': {
      ticker: 'ezETH',
      logo: 'ezeth',
      decimals: 18,
      priceProviderId: 'ezeth'
    },
    '0x4c5d8A75F3762c1561D96f177694f67378705E98': {
      ticker: 'PYTH',
      logo: 'pyth',
      decimals: 18,
      priceProviderId: 'pyth'
    },
    '0xB0fFa8000886e57F86dd5264b9582b2Ad87b2b91': {
      ticker: 'W',
      logo: 'w',
      decimals: 18,
      priceProviderId: 'w'
    },
    '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22': {
      ticker: 'cbETH',
      logo: 'cbeth',
      decimals: 18,
      priceProviderId: 'cbETH'
    },
    '0x22e6966B799c4D5B13BE962E1D117b56327FDa66': {
      ticker: 'SNX',
      logo: 'snx',
      decimals: 18,
      priceProviderId: 'SNX'
    }
  },
  [Chain.Arbitrum]: {
    '0x912ce59144191c1204e64559fe8253a0e49e6548': {
      ticker: 'ARB',
      logo: 'arb',
      decimals: 18,
      priceProviderId: 'arbitrum'
    },
    '0x429fEd88f10285E61b12BDF00848315fbDfCC341': {
      ticker: 'TGT',
      logo: 'tgt',
      decimals: 18,
      priceProviderId: 'thorwallet'
    },
    '0xf929de51D91C77E42f5090069E0AD7A09e513c73': {
      ticker: 'FOX',
      logo: 'fox',
      decimals: 18,
      priceProviderId: 'shapeshift-fox-token'
    },
    '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9': {
      ticker: 'USDT',
      logo: 'usdt',
      decimals: 6,
      priceProviderId: 'USDT'
    },
    '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8': {
      ticker: 'USDC.e',
      logo: 'usdc',
      decimals: 6,
      priceProviderId: 'USDC.e'
    },
    '0xaf88d065e77c8cC2239327C5EDb3A432268e5831': {
      ticker: 'USDC',
      logo: 'usdc',
      decimals: 6,
      priceProviderId: 'USDC'
    },
    '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f': {
      ticker: 'WBTC',
      logo: 'wbtc',
      decimals: 8,
      priceProviderId: 'WBTC'
    },
    '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4': {
      ticker: 'LINK',
      logo: 'link',
      decimals: 18,
      priceProviderId: 'LINK'
    },
    '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1': {
      ticker: 'DAI',
      logo: 'dai',
      decimals: 18,
      priceProviderId: 'DAI'
    },
    '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0': {
      ticker: 'UNI',
      logo: 'uni',
      decimals: 18,
      priceProviderId: 'UNI'
    },
    '0x25d887Ce7a35172C62FeBFD67a1856F20FaEbB00': {
      ticker: 'PEPE',
      logo: 'pepe',
      decimals: 18,
      priceProviderId: 'PEPE'
    },
    '0x9623063377AD1B27544C965cCd7342f7EA7e88C7': {
      ticker: 'GRT',
      logo: 'grt',
      decimals: 18,
      priceProviderId: 'GRT'
    },
    '0x2416092f143378750bb29b79eD961ab195CcEea5': {
      ticker: 'ezETH',
      logo: 'ezeth',
      decimals: 18,
      priceProviderId: 'ezETH'
    },
    '0xE4D5c6aE46ADFAF04313081e8C0052A30b6Dd724': {
      ticker: 'PYTH',
      logo: 'pyth',
      decimals: 6,
      priceProviderId: 'PYTH'
    },
    '0x13Ad51ed4F1B7e9Dc168d8a00cB3f4dDD85EfA60': {
      ticker: 'LDO',
      logo: 'ldo',
      decimals: 18,
      priceProviderId: 'LDO'
    }
  },
  [Chain.Optimism]: {
    '0x4200000000000000000000000000000000000042': {
      ticker: 'OP',
      logo: 'optimism',
      decimals: 18
    },
    '0xf1a0da3367bc7aa04f8d94ba57b862ff37ced174': {
      ticker: 'FOX',
      logo: 'fox',
      decimals: 18
    },
    '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58': {
      ticker: 'USDT',
      logo: 'usdt',
      decimals: 6
    },
    '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85': {
      ticker: 'USDC',
      logo: 'usdc',
      decimals: 6
    },
    '0x7F5c764cBc14f9669B88837ca1490cCa17c31607': {
      ticker: 'USDC.e',
      logo: 'usdc',
      decimals: 6
    },
    '0x68f180fcCe6836688e9084f035309E29Bf0A2095': {
      ticker: 'WBTC',
      logo: 'wbtc',
      decimals: 8
    },
    '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6': {
      ticker: 'LINK',
      logo: 'link',
      decimals: 18
    },
    '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1': {
      ticker: 'DAI',
      logo: 'dai',
      decimals: 18
    },
    '0x2416092f143378750bb29b79eD961ab195CcEea5': {
      ticker: 'ezETH',
      logo: 'ezeth',
      decimals: 18
    },
    '0x99C59ACeBFEF3BBFB7129DC90D1a11DB0E91187f': {
      ticker: 'PYTH',
      logo: 'pyth',
      decimals: 6
    },
    '0xFdb794692724153d1488CcdBE0C56c252596735F': {
      ticker: 'LDO',
      logo: 'ldo',
      decimals: 18
    }
  },
  [Chain.Polygon]: {
    '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619': {
      ticker: 'WETH',
      logo: 'weth',
      decimals: 18
    },
    '0x65a05db8322701724c197af82c9cae41195b0aa8': {
      ticker: 'FOX',
      logo: 'fox',
      decimals: 18
    },
    '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': {
      ticker: 'USDT',
      logo: 'usdt',
      decimals: 6
    },
    '0x3BA4c387f786bFEE076A58914F5Bd38d668B42c3': {
      ticker: 'BNB',
      logo: 'bsc',
      decimals: 18
    },
    '0xd93f7E271cB87c23AaA73edC008A79646d1F9912': {
      ticker: 'SOL',
      logo: 'solana',
      decimals: 9
    },
    '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359': {
      ticker: 'USDC',
      logo: 'usdc',
      decimals: 6
    },
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': {
      ticker: 'USDC.e',
      logo: 'usdc',
      decimals: 6
    },
    '0xdAb529f40E671A1D4bF91361c21bf9f0C9712ab7': {
      ticker: 'BUSD',
      logo: 'busd',
      decimals: 18
    },
    '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6': {
      ticker: 'WBTC',
      logo: 'wbtc',
      decimals: 8
    },
    '0x2C89bbc92BD86F8075d1DEcc58C7F4E0107f286b': {
      ticker: 'AVAX',
      logo: 'avax',
      decimals: 18
    },
    '0x6f8a06447Ff6FcF75d803135a7de15CE88C1d4ec': {
      ticker: 'SHIB',
      logo: 'shib',
      decimals: 18
    },
    '0xb0897686c545045aFc77CF20eC7A532E3120E0F1': {
      ticker: 'LINK',
      logo: 'link',
      decimals: 18
    }
  },
  [Chain.Blast]: {
    '0x4300000000000000000000000000000000000004': {
      ticker: 'WETH',
      logo: 'weth',
      decimals: 18,
      priceProviderId: 'ethereum'
    },
    '0xF7bc58b8D8f97ADC129cfC4c9f45Ce3C0E1D2692': {
      ticker: 'WBTC',
      logo: 'wbtc',
      decimals: 8
    },
    '0x4300000000000000000000000000000000000003': {
      ticker: 'USDB',
      logo: 'usdb',
      decimals: 18
    },
    '0xb1a5700fA2358173Fe465e6eA4Ff52E36e88E2ad': {
      ticker: 'BLAST',
      logo: 'blast',
      decimals: 18
    },
    '0x76DA31D7C9CbEAE102aff34D3398bC450c8374c1': {
      ticker: 'MIM',
      logo: 'mim',
      decimals: 18
    },
    '0x9e20461bc2c4c980f62f1B279D71734207a6A356': {
      ticker: 'OMNI',
      logo: 'omni',
      decimals: 18
    },
    '0x47C337Bd5b9344a6F3D6f58C474D9D8cd419D8cA': {
      ticker: 'DACKIE',
      logo: 'dackie',
      decimals: 18
    }
  },
  [Chain.Cosmos]: {
    'ibc/F663521BF1836B00F5F177680F74BFB9A8B5654A694D0D2BC249E03CF2509013': {
      ticker: 'USDC',
      logo: 'usdc',
      decimals: 6,
      priceProviderId: 'usd-coin'
    },
    'ibc/4363FD2EF60A7090E405B79A6C4337C5E9447062972028F5A99FB041B9571942': {
      ...kujiraCoinsMigratedToThorChainMetadata.wink,
      decimals: 6
    },
    'ibc/6C95083ADD352D5D47FB4BA427015796E5FEF17A829463AD05ECD392EB38D889': {
      ...kujiraCoinsMigratedToThorChainMetadata.lvn,
      decimals: 6
    },
    'ibc/0B99C4EFF1BD05E56DEDEE1D88286DB79680C893724E0E7573BC369D79B5DDF3': {
      ...kujiraCoinsMigratedToThorChainMetadata.nstk,
      decimals: 6
    },
    'ibc/A47E814B0E8AE12D044637BCB4576FCA675EF66300864873FA712E1B28492B78': {
      ticker: 'USK',
      logo: 'usk.png',
      decimals: 6,
      priceProviderId: 'usk'
    },
    'ibc/4622E82B845FFC6AA8B45C1EB2F507133A9E876A5FEA1BA64585D5F564405453': {
      ticker: 'NAMI',
      logo: 'nami.png',
      decimals: 6,
      priceProviderId: 'nami-protocol'
    },
    'ibc/6BBBB4B63C51648E9B8567F34505A9D5D8BAAC4C31D768971998BE8C18431C26': {
      ...kujiraCoinsMigratedToThorChainMetadata.fuzn,
      decimals: 6
    },
    'ibc/50A69DC508ACCADE2DAC4B8B09AA6D9C9062FCBFA72BB4C6334367DECD972B06': {
      ...kujiraCoinsMigratedToThorChainMetadata.rkuji,
      decimals: 6
    }
  },
  [Chain.Osmosis]: {
    uion: {
      ticker: 'ION',
      logo: 'ion',
      decimals: 6,
      priceProviderId: 'ion'
    },
    'factory/osmo1mlng7pz4pnyxtpq0akfwall37czyk9lukaucsrn30ameplhhshtqdvfm5c/ulvn': {
      ...kujiraCoinsMigratedToThorChainMetadata.lvn,
      decimals: 6
    }
  },
  [Chain.Kujira]: {
    'factory/kujira1qk00h5atutpsv900x202pxx42npjr9thg58dnqpa72f2p7m2luase444a7/uusk': {
      ticker: 'USK',
      logo: 'usk.png',
      decimals: 6,
      priceProviderId: 'usk'
    },
    'factory/kujira12cjjeytrqcj25uv349thltcygnp9k0kukpct0e/uwink': {
      ...kujiraCoinsMigratedToThorChainMetadata.wink,
      decimals: 6
    },
    'factory/kujira1aaudpfr9y23lt9d45hrmskphpdfaq9ajxd3ukh/unstk': {
      ...kujiraCoinsMigratedToThorChainMetadata.nstk,
      decimals: 6
    },
    'factory/kujira1643jxg8wasy5cfcn7xm8rd742yeazcksqlg4d7/umnta': {
      ticker: 'MNTA',
      logo: 'mnta.png',
      decimals: 6,
      priceProviderId: 'mantadao'
    },
    'ibc/FE98AAD68F02F03565E9FA39A5E627946699B2B07115889ED812D8BA639576A9': {
      ticker: 'USDC',
      logo: 'usdc',
      decimals: 6,
      priceProviderId: 'usd-coin'
    },
    'ibc/640E1C3E28FD45F611971DF891AE3DC90C825DF759DF8FAA8F33F7F72B35AD56': {
      ticker: 'ASTRO',
      logo: 'terra-astroport.png',
      decimals: 6,
      priceProviderId: 'astroport-fi'
    },
    'ibc/119334C55720942481F458C9C462F5C0CD1F1E7EEAC4679D674AA67221916AEA': {
      ticker: 'LUNC',
      logo: 'lunc',
      decimals: 6,
      priceProviderId: 'terra-luna'
    },
    'factory/kujira1tsekaqv9vmem0zwskmf90gpf0twl6k57e8vdnq/urkuji': {
      ...kujiraCoinsMigratedToThorChainMetadata.rkuji,
      decimals: 6
    },
    'factory/kujira13x2l25mpkhwnwcwdzzd34cr8fyht9jlj7xu9g4uffe36g3fmln8qkvm3qn/unami': {
      ticker: 'NAMI',
      logo: 'NAMI.png',
      decimals: 6,
      priceProviderId: 'nami-protocol'
    },
    'factory/kujira1sc6a0347cc5q3k890jj0pf3ylx2s38rh4sza4t/ufuzn': {
      ...kujiraCoinsMigratedToThorChainMetadata.fuzn,
      decimals: 6
    }
  },
  [Chain.Terra]: {
    terra13j2k5rfkg0qhk58vz63cze0uze4hwswlrfnm0fa4rnyggjyfrcnqcrs5z2: {
      ticker: 'TPT',
      logo: 'terra-poker-token.png',
      decimals: 6,
      priceProviderId: 'tpt'
    },
    'ibc/8D8A7F7253615E5F76CB6252A1E1BD921D5EDB7BBAAF8913FB1C77FF125D9995': {
      ticker: 'ASTRO-IBC',
      logo: 'terra-astroport.png',
      decimals: 6,
      priceProviderId: 'astroport-fi'
    },
    terra1nsuqsk6kh58ulczatwev87ttq2z6r3pusulg9r24mfj2fvtzd4uq3exn26: {
      ticker: 'ASTRO',
      logo: 'terra-astroport.png',
      decimals: 6,
      priceProviderId: 'astroport-fi'
    }
  },
  [Chain.TerraClassic]: {
    terra1xj49zyqrwpv5k928jwfpfy2ha668nwdgkwlrg3: {
      ticker: 'ASTROC',
      logo: 'terra-astroport.png',
      decimals: 6,
      priceProviderId: 'astroport'
    }
  }
}

const [chainNativeTokens, chainNonNativeTokens] = [leanChainNativeTokens, leanChainNonNativeTokens].map((leanTokens) =>
  recordMap(withoutUndefinedFields(leanTokens), (tokens, chain) =>
    Object.entries(tokens).map(([id, token]) => ({
      ...token,
      chain,
      id
    }))
  )
)

export { chainNativeTokens }

export const chainTokens: Partial<Record<Chain, KnownCoin[]>> = (() => {
  const base = mergeRecordsOfArrays(chainNativeTokens, chainNonNativeTokens)

  Object.values(IbcEnabledCosmosChain).forEach((chain) => {
    const ibcMeta = ibcTransferrableTokensPerChain[chain] ?? []
    const current = base[chain] ?? []

    const patched = patchTokensWithIBCIds(current, ibcMeta)
    const additions = getMissingIBCTokens(patched, ibcMeta, chain)

    if (patched.length || additions.length) {
      base[chain] = [...patched, ...additions]
    }
  })

  return base
})()
