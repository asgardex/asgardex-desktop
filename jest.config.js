const { createJestConfig } = require('@craco/craco')

// Use jest config created by `craco`
// https://github.com/gsoft-inc/craco/blob/master/packages/craco/README.md#jest-api
const cracoConfig = require('./craco.config.js')

let jestConfig = createJestConfig(cracoConfig)

jestConfig = {
  ...jestConfig,
  globals: { ...jestConfig.globals, crypto: require('crypto') },
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: ['node_modules/(?!(axios|@xchainjs/.*|@ledgerhq/domain-service|@ledgerhq/hw-app-eth)/)'],
  moduleNameMapper: {
    '\\.(css|less)$': '<rootDir>/__mocks__/styleMock.js',
    '@ledgerhq/evm-tools/': '<rootDir>/node_modules/@ledgerhq/evm-tools/lib/selectors',
    '@ledgerhq/domain-service/': '<rootDir>/node_modules/@ledgerhq/domain-service/lib/signers',
    '@ledgerhq/cryptoassets/': '<rootDir>/node_modules/@ledgerhq/cryptoassets/lib/data/evm'
  },
  watchPlugins: [
    // Remove or comment out the following line if you don't want to use it
    'jest-watch-typeahead/filename'
    // 'jest-watch-typeahead/testname',
  ]
}

module.exports = jestConfig
