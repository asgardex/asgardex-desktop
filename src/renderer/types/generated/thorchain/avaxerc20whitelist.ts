/**
 * AVAX_TOKEN_WHITELIST
 *
 * This file has been generated and then edited.
 * Only add token that iether are pending or active. Too many requests otherwise
 * For synths copy token and flip synth: true
 *
 */

import * as O from "fp-ts/lib/Option";
import { Asset } from "@xchainjs/xchain-util";
import { AVAXChain } from "@xchainjs/xchain-avax";

export const AVAX_TOKEN_WHITELIST: {
  asset: Asset;
  iconUrl: O.Option<string>;
}[] = [
  {
    asset: {
      chain: AVAXChain,
      symbol: "BUSD-0x9C9e5fD8bbc25984B178FdCE6117Defa39d2db39",
      ticker: "BUSD",
      synth: false,
    },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0x9C9e5fD8bbc25984B178FdCE6117Defa39d2db39/logo.png"
    ),
  },
  {
    asset: { chain: AVAXChain, symbol: "BUSD", ticker: "BUSD", synth: false },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0x9C9e5fD8bbc25984B178FdCE6117Defa39d2db39/logo.png"
    ),
  },
  {
    asset: { chain: AVAXChain, symbol: "DAI", ticker: "DAI", synth: false },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0xd586E7F844cEa2F87f50152665BCbc2C279D8d70/logo.png"
    ),
  },
  {
    asset: { chain: AVAXChain, symbol: "LINK", ticker: "LINK", synth: false },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0x5947BB275c521040051D82396192181b413227A3/logo.png"
    ),
  },
  {
    asset: { chain: AVAXChain, symbol: "USDT", ticker: "USDT", synth: false },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0xc7198437980c041c805A1EDcbA50c1Ce5db95118/logo.png"
    ),
  },
  {
    asset: { chain: AVAXChain, symbol: "WBTC", ticker: "WBTC", synth: false },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0x50b7545627a5162F82A992c33b87aDc75187B218/logo.png"
    ),
  },
  {
    asset: { chain: AVAXChain, symbol: "WETH", ticker: "WETH", synth: false },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB/logo.png"
    ),
  },
  {
    asset: {
      chain: AVAXChain,
      symbol: "BNB-0x264c1383EA520f73dd837F915ef3a732e204a493",
      ticker: "BNB",
      synth: false,
    },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0x264c1383EA520f73dd837F915ef3a732e204a493/logo.png"
    ),
  },
  {
    asset: {
      chain: AVAXChain,
      symbol: "USDC-0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      ticker: "USDC",
      synth: false,
    },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E/logo.png"
    ),
  },
  {
    asset: {
      chain: AVAXChain,
      symbol: "USDC-0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      ticker: "USDC",
      synth: true,
    },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E/logo.png"
    ),
  },
  {
    asset: {
      chain: AVAXChain,
      symbol: "USDT-0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
      ticker: "USDT",
      synth: false,
    },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7/logo.png"
    ),
  },
  {
    asset: {
      chain: AVAXChain,
      symbol: "USDT-0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
      ticker: "USDT",
      synth: true,
    },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7/logo.png"
    ),
  },
  {
    asset: {
      chain: AVAXChain,
      symbol: "THOR-0x8F47416CaE600bccF9530E9F3aeaA06bdD1Caa79",
      ticker: "THOR",
      synth: false,
    },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0x8F47416CaE600bccF9530E9F3aeaA06bdD1Caa79/logo.png"
    ),
  },
  {
    asset: { chain: AVAXChain, symbol: "BTC", ticker: "BTC", synth: false },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0x152b9d0FdC40C096757F570A51E494bd4b943E50/logo.png"
    ),
  },
  {
    asset: {
      chain: AVAXChain,
      symbol: "SOL-0xFE6B19286885a4F7F55AdAD09C3Cd1f906D2478F",
      ticker: "SOL",
      synth: false,
    },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0xFE6B19286885a4F7F55AdAD09C3Cd1f906D2478F/logo.png"
    ),
  },
  {
    asset: {
      chain: AVAXChain,
      symbol: "SOL-0xFE6B19286885a4F7F55AdAD09C3Cd1f906D2478F",
      ticker: "SOL",
      synth: true,
    },
    iconUrl: O.some(
      "https://raw.githubusercontent.com/traderjoe-xyz/joe-tokenlists/main/logos/0xFE6B19286885a4F7F55AdAD09C3Cd1f906D2478F/logo.png"
    ),
  },
];
