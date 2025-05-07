const path = require('path')

module.exports = {
  testEnvironment: path.resolve(__dirname, 'jest.environment.js'),
  setupFilesAfterEnv: ['<rootDir>/setup.jest.js'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|axios|@xchainjs/.*|@metaplex-foundation/.*|@ledgerhq/domain-service|@ledgerhq/hw-app-eth|@cosmjs/tendermint-rpc|@bitcoin-js/tiny-secp256k1-asmjs|uint8array-tools)/)'
  ],
  moduleNameMapper: {
    '\\.(css|less)$': '<rootDir>/__mocks__/styleMock.js',
    '@ledgerhq/evm-tools/': '<rootDir>/node_modules/@ledgerhq/evm-tools/lib/selectors',
    '@ledgerhq/domain-service/': '<rootDir>/node_modules/@ledgerhq/domain-service/lib/signers',
    '@ledgerhq/cryptoassets/': '<rootDir>/node_modules/@ledgerhq/cryptoassets/lib/data/evm'
  },
  watchPlugins: ['jest-watch-typeahead/filename']
}
