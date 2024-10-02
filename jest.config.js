const path = require('path')

const { createJestConfig } = require('@craco/craco')

// Use jest config created by `craco`
// https://github.com/gsoft-inc/craco/blob/master/packages/craco/README.md#jest-api
const cracoConfig = require('./craco.config.js')

let jestConfig = createJestConfig(cracoConfig)

jestConfig = {
  ...jestConfig,
  setupFiles: ['<rootDir>/setup.jest.js'],
  globals: { ...jestConfig.globals },
  testEnvironment: path.resolve(__dirname, 'jest.environment.js'),
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(axios|@xchainjs/.*|@ledgerhq/domain-service|@ledgerhq/hw-app-eth|@cosmjs/tendermint-rpc|@bitcoin-js/tiny-secp256k1-asmjs|uint8array-tools)/)'
  ],
  moduleNameMapper: {
    '\\.(css|less)$': '<rootDir>/__mocks__/styleMock.js',
    '@ledgerhq/evm-tools/': '<rootDir>/node_modules/@ledgerhq/evm-tools/lib/selectors',
    '@ledgerhq/domain-service/': '<rootDir>/node_modules/@ledgerhq/domain-service/lib/signers',
    '@ledgerhq/cryptoassets/': '<rootDir>/node_modules/@ledgerhq/cryptoassets/lib/data/evm'
  },
  watchPlugins: ['jest-watch-typeahead/filename']
}

module.exports = jestConfig
