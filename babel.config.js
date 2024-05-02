// babel.config.js
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }], // Target modern Node.js
    '@babel/preset-react', // For JSX
    '@babel/preset-typescript' // For TypeScript
  ],
  plugins: [
    // Add any Babel plugins necessary for additional JavaScript features
  ]
}
