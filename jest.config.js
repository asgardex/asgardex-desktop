const { createJestConfig } = require('@craco/craco')

// Use jest config created by `craco`
// https://github.com/gsoft-inc/craco/blob/master/packages/craco/README.md#jest-api
const cracoConfig = require('./craco.config.js')

let jestConfig = createJestConfig(cracoConfig)

jestConfig = {
  ...jestConfig,
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest'
  },
  globals: { ...jestConfig.globals, crypto: require('crypto') },
  extensionsToTreatAsEsm: ['.ts'],
  transformIgnorePatterns: ["node_modules/(?!(axios|@xchainjs)/)"],
  moduleNameMapper: {
    '\\.(css|less)$': '<rootDir>/__mocks__/styleMock.js'
  }
}

module.exports = jestConfig
