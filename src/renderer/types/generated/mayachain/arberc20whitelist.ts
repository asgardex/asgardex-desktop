/**
 * ARB_TOKEN_WHITELIST
 *
 * This file has been generated and then edited.
 * Only add token that iether are pending or active. Too many requests otherwise
 * For synths copy token and flip synth: true
 *
 */

import * as O from "fp-ts/lib/Option";
import { Asset } from "@xchainjs/xchain-util";
import { ARBChain } from "@xchainjs/xchain-arbitrum";

export const ARB_TOKEN_WHITELIST: {
  asset: Asset;
  iconUrl: O.Option<string>;
}[] = [
  {
    asset: {
      chain: ARBChain,
      symbol: "GMX-0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a",
      ticker: "GMX",
      synth: false,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/18323/thumb/arbit.png?1696517814"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "ARB-0x912ce59144191c1204e64559fe8253a0e49e6548",
      ticker: "ARB",
      synth: false,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/16547/thumb/photo_2023-03-29_21.47.00.jpeg?1696516109"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "ARB-0x912ce59144191c1204e64559fe8253a0e49e6548",
      ticker: "ARB",
      synth: true,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/16547/thumb/photo_2023-03-29_21.47.00.jpeg?1696516109"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "GMX-0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a",
      ticker: "GMX",
      synth: true,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/18323/thumb/arbit.png?1696517814"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "USDT-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
      ticker: "USDT",
      synth: false,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/35073/thumb/logo.png?1707292836"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "USDT-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
      ticker: "USDT",
      synth: true,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/35073/thumb/logo.png?1707292836"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "PEPE-0x25d887ce7a35172c62febfd67a1856f20faebb00",
      ticker: "PEPE",
      synth: false,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/29850/thumb/pepe-token.jpeg?1696528776"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "PEPE-0x25d887ce7a35172c62febfd67a1856f20faebb00",
      ticker: "PEPE",
      synth: true,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/29850/thumb/pepe-token.jpeg?1696528776"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "WSTETH-0x5979d7b546e38e414f7e9822514be443a4800529",
      ticker: "WSTETH",
      synth: false,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/18834/thumb/wstETH.png?1696518295"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "WSTETH-0x5979d7b546e38e414f7e9822514be443a4800529",
      ticker: "WSTETH",
      synth: true,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/18834/thumb/wstETH.png?1696518295"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "GNS-0x18c11fd286c5ec11c3b683caa813b77f5163a122",
      ticker: "GNS",
      synth: false,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/19737/thumb/logo.png?1696519161"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "GNS-0x18c11fd286c5ec11c3b683caa813b77f5163a122",
      ticker: "GNS",
      synth: true,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/19737/thumb/logo.png?1696519161"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "DAI-0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
      ticker: "DAI",
      synth: false,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/9956/thumb/Badge_Dai.png?1696509996"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "DAI-0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
      ticker: "DAI",
      synth: true,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/9956/thumb/Badge_Dai.png?1696509996"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "SUSHI-0xd4d42f0b6def4ce0383636770ef773390d85c61a",
      ticker: "SUSHI",
      synth: false,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/12271/thumb/512x512_Logo_no_chop.png?1696512101"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "SUSHI-0xd4d42f0b6def4ce0383636770ef773390d85c61a",
      ticker: "SUSHI",
      synth: true,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/12271/thumb/512x512_Logo_no_chop.png?1696512101"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "LINK-0xf97f4df75117a78c1a5a0dbb814af92458539fb4",
      ticker: "LINK",
      synth: false,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/877/thumb/chainlink-new-logo.png?1696502009"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "LINK-0xf97f4df75117a78c1a5a0dbb814af92458539fb4",
      ticker: "LINK",
      synth: true,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/877/thumb/chainlink-new-logo.png?1696502009"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "UNI-0xfa7f8980b0f1e64a2062791cc3b0871572f1f7f0",
      ticker: "UNI",
      synth: false,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/12504/thumb/uni.jpg?1696512319"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "UNI-0xfa7f8980b0f1e64a2062791cc3b0871572f1f7f0",
      ticker: "UNI",
      synth: true,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/12504/thumb/uni.jpg?1696512319"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "USDC-0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      ticker: "USDC",
      synth: false,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/6319/thumb/usdc.png?1696506694"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "USDC-0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      ticker: "USDC",
      synth: true,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/6319/thumb/usdc.png?1696506694"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "TGT-0x429fEd88f10285E61b12BDF00848315fbDfCC341",
      ticker: "TGT",
      synth: false,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/21843/small/tgt_logo.png"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "TGT-0x429fEd88f10285E61b12BDF00848315fbDfCC341",
      ticker: "TGT",
      synth: true,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/21843/small/tgt_logo.png"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "GLD-0xaFD091f140C21770f4e5d53d26B2859Ae97555Aa",
      ticker: "GLD",
      synth: false,
    },
    iconUrl: O.some(
      "https://mayaswap.s3.eu-central-1.amazonaws.com/tokens/id459693155083483.png"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "GLD-0xaFD091f140C21770f4e5d53d26B2859Ae97555Aa",
      ticker: "GLD",
      synth: true,
    },
    iconUrl: O.some(
      "https://mayaswap.s3.eu-central-1.amazonaws.com/tokens/id459693155083483.png"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "WBTC-0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f",
      ticker: "WBTC",
      synth: false,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/7598/thumb/wrapped_bitcoin_wbtc.png?1696507857"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "WBTC-0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f",
      ticker: "WBTC",
      synth: true,
    },
    iconUrl: O.some(
      "https://assets.coingecko.com/coins/images/7598/thumb/wrapped_bitcoin_wbtc.png?1696507857"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "LEO-0x93864d81175095DD93360FFA2A529b8642F76A6E",
      ticker: "LEO",
      synth: false,
    },
    iconUrl: O.some(
      "https://img.inleo.io/DQmZhBmRaQx5tozZLZai579SjktJDigtmoXNP73jHmh6nWK/leoLogo.png"
    ),
  },
  {
    asset: {
      chain: ARBChain,
      symbol: "LEO-0x93864d81175095DD93360FFA2A529b8642F76A6E",
      ticker: "LEO",
      synth: true,
    },
    iconUrl: O.some(
      "https://img.inleo.io/DQmZhBmRaQx5tozZLZai579SjktJDigtmoXNP73jHmh6nWK/leoLogo.png"
    ),
  }
];
