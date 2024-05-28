const { createJestConfig } = require('@craco/craco')

// Use jest config created by `craco`
// https://github.com/gsoft-inc/craco/blob/master/packages/craco/README.md#jest-api
const cracoConfig = require('./craco.config.js')

let jestConfig = createJestConfig(cracoConfig)

jestConfig = {
  ...jestConfig,
  globals: { ...jestConfig.globals, crypto: require('crypto') },
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: ['node_modules/(?!(axios|@ledgerhq/domain-service|@ledgerhq/hw-app-eth)/)'],
  moduleNameMapper: {
    '\\.(css|less)$': '<rootDir>/__mocks__/styleMock.js',
    '@ledgerhq/evm-tools/': '<rootDir>/node_modules/@ledgerhq/evm-tools/lib/selectors',
    '@ledgerhq/domain-service/': '<rootDir>/node_modules/@ledgerhq/domain-service/lib/signers',
    '@ledgerhq/cryptoassets/': '<rootDir>/node_modules/@ledgerhq/cryptoassets/lib/data/evm'
  }
}

module.exports = jestConfig
