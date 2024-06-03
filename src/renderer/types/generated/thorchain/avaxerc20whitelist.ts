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
