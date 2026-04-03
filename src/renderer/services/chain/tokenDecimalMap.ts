/**
 * Hardcoded token decimal map for all known tokens across supported chains.
 *
 * This map serves as the authoritative source of truth for token decimals,
 * eliminating reliance on Midgard's nativeDecimal field which can be
 * unavailable, delayed, or incorrect.
 *
 * Key format: "CHAIN:lowercase_address"
 * Only tokens with NON-DEFAULT decimals need to be listed here.
 * Default decimals per chain (used when token is not in this map):
 *   - EVM chains (ETH, ARB, AVAX, BSC, BASE): 18
 *   - SOL: 9
 *   - TRON: 6
 *
 * To add a new token: add an entry with the chain, lowercase contract address, and decimal count.
 */

// ────────────────────────────────────────────────
// ETH tokens
// ────────────────────────────────────────────────
const ETH_TOKENS: Record<string, number> = {
  // Stablecoins (6 decimals)
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 6, // USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 6, // USDT
  '0x1abaea1f7c830bd89acc67ec4af516284b1bc33c': 6, // EURC (Circle EUR)
  '0x6c3ea9036406852006290770bedfcaba0e23a0e8': 6, // PYUSD (PayPal USD)

  // Wrapped BTC variants (8 decimals)
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 8, // WBTC
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': 8, // cbBTC (Coinbase BTC)

  // Compound tokens (8 decimals)
  '0xc11b1268c1a384e55c48c2391d8d480264a3a7f4': 8, // cWBTC
  '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9': 8, // cUSDT
  '0x39aa39c021dfbae8fac545936693ac917d5e7563': 8, // cUSDC

  // Aave v2 tokens (match underlying)
  '0xbcca60bb61934080951369a648fb03df4f96263c': 6, // aUSDC
  '0x3ed3b47dd13ec9a98b44e6204a523e766b225811': 6, // aUSDT
  '0x9ba00d6856a4edf4665bca2c2309936572473b7e': 6, // aUSDCv1
  '0x71fc860f7d3a592a4a98740e39db31d25db65ae8': 6, // aUSDTv1
  '0x9ff58f4ffb29fa2266ab25e75e2a8b3503311656': 8, // aWBTC

  // Yearn vault tokens (match underlying)
  '0xd6ad7a6750a7593e092a9b218d66c0a814a3436e': 6, // yUSDCv2
  '0x26ea744e5b887e5205727f55dfbe8685e3b21951': 6, // yUSDCv3
  '0x83f798e925bcd4017eb265844fddabb448f1707d': 6, // yUSDTv2
  '0xe6354ed5bc4b393a5aad09f21c46e101e692d447': 6, // yUSDTv3

  // Cream tokens (8 decimals)
  '0x197070723ce0d3810a0e47f06e935c30a480d4fc': 8, // crWBTC
  '0x44fbebd2f576670a6c33f6fc0b00aa8c5753b322': 8, // crUSDC
  '0x797aab1ce7c01eb727ab980762ba88e7133d2157': 8 // crUSDT

  // 18 decimal tokens (default for ETH, listed for completeness of well-known tokens)
  // WETH, DAI, LUSD, LINK, UNI, AAVE, etc. all use 18 — no entry needed
}

// ────────────────────────────────────────────────
// AVAX tokens
// ────────────────────────────────────────────────
const AVAX_TOKENS: Record<string, number> = {
  // Native USDC/USDT (6 decimals)
  '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e': 6, // USDC
  '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7': 6, // USDT

  // Bridged (Avalanche Bridge) tokens (6 decimals)
  '0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664': 6, // USDC.e
  '0xc7198437980c041c805a1edcba50c1ce5db95118': 6, // USDT.e

  // Bridged BTC (8 decimals)
  '0x50b7545627a5162f82a992c33b87adc75187b218': 8, // WBTC.e

  // fUSDT (Frax bridged) - check if 6
  '0x5b8470fbc6b31038aa07abd3010acffca6e36611': 6, // fUSDT

  // Bridged SOL (9 decimals)
  '0xfe6b19286885a4f7f55adad09c3cd1f906d2478f': 9 // SOL
}

// ────────────────────────────────────────────────
// ARB tokens
// ────────────────────────────────────────────────
const ARB_TOKENS: Record<string, number> = {
  // Stablecoins (6 decimals)
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 6, // USDC (native)
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 6, // USDT
  '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': 6, // USDC.e (bridged)

  // Wrapped BTC (8 decimals)
  '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': 8, // WBTC

  // Aave v3 tokens on ARB (match underlying)
  '0x724dc807b04555b71ed48a6896b6f41593b8c637': 6, // aUSDC
  '0x6ab707aca953edaefbc4fd23ba73294241490620': 6, // aUSDT
  '0x078f358208685046a11c85e8ad32895ded33a249': 8, // aWBTC
  '0x625e7708f30ca75bfd92586e17077590c60eb4cd': 6 // aUSDCe
}

// ────────────────────────────────────────────────
// BSC tokens
// ────────────────────────────────────────────────
const BSC_TOKENS: Record<string, number> = {
  // BSC uses 18 decimals for both USDC and USDT (Binance-Peg versions)
  // '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 18, // USDC (default)
  // '0x55d398326f99059ff775485246999027b3197955': 18, // USDT (default)
  // No non-default entries needed — BSC stablecoins are 18 decimals
}

// ────────────────────────────────────────────────
// BASE tokens
// ────────────────────────────────────────────────
const BASE_TOKENS: Record<string, number> = {
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 6, // USDC
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': 8 // cbBTC
}

// ────────────────────────────────────────────────
// SOL tokens (default chain decimal = 9)
// ────────────────────────────────────────────────
const SOL_TOKENS: Record<string, number> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 6, // USDC
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 6, // USDT
  '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': 8, // WBTC (Wormhole)
  So11111111111111111111111111111111111111112: 9 // Wrapped SOL
}

// ────────────────────────────────────────────────
// TRON tokens (default chain decimal = 6)
// ────────────────────────────────────────────────
const TRON_TOKENS: Record<string, number> = {
  TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t: 6, // USDT
  TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8: 6, // USDC
  THb4CqiFdwNHsWsQCs4JhzwjMWys4aqCbF: 18, // WETH (non-default!)
  TThzxNRLrW2Brp9DcTQU8i4Wd9udCWEdZ3: 18, // stUSDT (non-default!)
  TGkxzkDKyMeq2T7edKnyjZoFypyzjkkssq: 18 // wstUSDT (non-default!)
}

// ────────────────────────────────────────────────
// Combined map: CHAIN -> { address -> decimals }
// ────────────────────────────────────────────────
const CHAIN_TOKEN_DECIMALS: Record<string, Record<string, number>> = {
  ETH: ETH_TOKENS,
  AVAX: AVAX_TOKENS,
  ARB: ARB_TOKENS,
  BSC: BSC_TOKENS,
  BASE: BASE_TOKENS,
  SOL: SOL_TOKENS,
  TRON: TRON_TOKENS
}

/**
 * Extracts the contract address from an asset symbol.
 * Symbol format: "TICKER-0xAddress" (EVM) or "TICKER-Base58Address" (SOL/TRON)
 */
const extractAddress = (symbol: string): string | null => {
  const dashIndex = symbol.indexOf('-')
  if (dashIndex === -1) return null
  return symbol.slice(dashIndex + 1)
}

/**
 * Looks up the decimal count for a token from the hardcoded map.
 * Returns the decimal if found, or null to fall through to other resolution methods.
 *
 * @param chain - The chain identifier (e.g., 'ETH', 'ARB', 'AVAX')
 * @param symbol - The asset symbol (e.g., 'USDC-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
 * @returns The decimal count if known, or null
 */
export const getTokenDecimal = (chain: string, symbol: string): number | null => {
  const chainMap = CHAIN_TOKEN_DECIMALS[chain]
  if (!chainMap) return null

  const address = extractAddress(symbol)
  if (!address) return null

  // EVM addresses are case-insensitive, SOL/TRON are case-sensitive
  const isEVM = ['ETH', 'ARB', 'AVAX', 'BSC', 'BASE'].includes(chain)
  const normalizedAddress = isEVM ? address.toLowerCase() : address

  const decimal = chainMap[normalizedAddress]
  return decimal !== undefined ? decimal : null
}
