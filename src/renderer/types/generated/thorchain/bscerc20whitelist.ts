/**
 * BSC_TOKEN_WHITELIST
 *
 * This file has been generated and then edited.
 * Only add token that iether are pending or active. Too many requests otherwise
 * For synths copy token and flip synth: true
 *
 */

import * as O from "fp-ts/lib/Option";
import { Asset } from "@xchainjs/xchain-util";
import { BSCChain } from "@xchainjs/xchain-bsc";

export const BSC_TOKEN_WHITELIST: {
  asset: Asset;
  iconUrl: O.Option<string>;
}[] = [
  {
    asset: {
      chain: BSCChain,
      symbol: "ATOM-0x0Eb3a705fc54725037CC9e008bDede697f62F335",
      ticker: "ATOM",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0x0Eb3a705fc54725037CC9e008bDede697f62F335.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "BCH-0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf",
      ticker: "BCH",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0x8fF795a6F4D97E7887C79beA79aba5cc76444aDf.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "BTCB-0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
      ticker: "BTCB",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "BUSD-0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
      ticker: "BUSD",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "DAI-0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
      ticker: "DAI",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "DOGE-0xbA2aE424d960c26247Dd6c32edC70B295c744C43",
      ticker: "DOGE",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0xbA2aE424d960c26247Dd6c32edC70B295c744C43.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "EGLD-0xbF7c81FFF98BbE61B40Ed186e4AfD6DDd01337fe",
      ticker: "EGLD",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0xbF7c81FFF98BbE61B40Ed186e4AfD6DDd01337fe.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "ETH-0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
      ticker: "ETH",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0x2170Ed0880ac9A755fd29B2688956BD959F933F8.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "SPARTA-0x3910db0600eA925F63C36DdB1351aB6E2c6eb102",
      ticker: "SPARTA",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0x3910db0600eA925F63C36DdB1351aB6E2c6eb102.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "SUSHI-0x947950BcC74888a40Ffa2593C5798F11Fc9124C4",
      ticker: "SUSHI",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0x947950BcC74888a40Ffa2593C5798F11Fc9124C4.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "TWT-0x4B0F1812e5Df2A09796481Ff14017e6005508003",
      ticker: "TWT",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0x4B0F1812e5Df2A09796481Ff14017e6005508003.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "UNI-0xBf5140A22578168FD562DCcF235E5D43A02ce9B1",
      ticker: "UNI",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0xBf5140A22578168FD562DCcF235E5D43A02ce9B1.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "USDC-0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      ticker: "USDC",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "USDC-0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      ticker: "USDC",
      synth: true,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "USDT-0x55d398326f99059fF775485246999027B3197955",
      ticker: "USDT",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0x55d398326f99059fF775485246999027B3197955.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "USDT-0x55d398326f99059fF775485246999027B3197955",
      ticker: "USDT",
      synth: true,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0x55d398326f99059fF775485246999027B3197955.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "XRP-0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE",
      ticker: "XRP",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "YFI-0x88f1A5ae2A3BF98AEAF342D26B30a79438c9142e",
      ticker: "YFI",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0x88f1A5ae2A3BF98AEAF342D26B30a79438c9142e.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "ZIL-0xb86AbCb37C3A4B64f74f59301AFF131a1BEcC787",
      ticker: "ZIL",
      synth: false,
    },
    iconUrl: O.some(
      "https://tokens.pancakeswap.finance/images/0xb86AbCb37C3A4B64f74f59301AFF131a1BEcC787.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "FLOKI-0x2B3F34e9D4b127797CE6244Ea341a83733ddd6E4",
      ticker: "FLOKI",
      synth: false,
    },
    iconUrl: O.some(
      "https://assets-cdn.trustwallet.com/blockchains/smartchain/assets/0x2B3F34e9D4b127797CE6244Ea341a83733ddd6E4/logo.png"
    ),
  },
  {
    asset: {
      chain: BSCChain,
      symbol: "GOLD-0xb3a6381070B1a15169DEA646166EC0699fDAeA79",
      ticker: "GOLD",
      synth: false,
    },
    iconUrl: O.some(
      "https://assets-cdn.trustwallet.com/blockchains/smartchain/assets/0xb3a6381070B1a15169DEA646166EC0699fDAeA79/logo.png"
    ),
  },
];
