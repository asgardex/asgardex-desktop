import { dirname, join } from "path";

const path = require('path')

const { GitRevisionPlugin } = require('git-revision-webpack-plugin')

const { version } = require('../package')

const webpack = require('webpack')

const config = {
  features: {
    buildStoriesJson: true,
    breakingChangesV7: true
  },

  core: {
    channelOptions: { allowFunction: false, maxDepth: 10 },
    disableTelemetry: true
  },

  staticDirs: ['../public'],
  stories: ['../src/renderer/**/*.stories.@(ts|tsx)'],

  addons: [
    getAbsolutePath("@storybook/addon-viewport"),
    getAbsolutePath("@storybook/addon-docs"),
    getAbsolutePath("@storybook/preset-create-react-app"),
    {
      name: '@storybook/addon-essentials',
      options: {
        viewport: false,
        docs: false
      }
    },
    '@chromatic-com/storybook'
  ],

  framework: getAbsolutePath("@storybook/react-webpack5"),

  // Extending Storybook’s Webpack config
  // https://storybook.js.org/docs/react/builders/webpack#extending-storybooks-webpack-config
  webpackFinal: async (webpackConfig) => {
    webpackConfig.resolve.fallback = {
      ...webpackConfig.resolve.fallback,
      stream: require.resolve('stream-browserify'),
      crypto: require.resolve('crypto-browserify'),
      os: require.resolve('os-browserify/browser'),
      path: require.resolve('path-browserify'),
      fs: require.resolve('browserify-fs'),
      assert: require.resolve('assert')
    }

    webpackConfig.plugins = [
      ...webpackConfig.plugins,
      new webpack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer']
      }),
      new webpack.DefinePlugin({
        $COMMIT_HASH: JSON.stringify(new GitRevisionPlugin().commithash()),
        $VERSION: JSON.stringify(version),
        $IS_DEV: JSON.stringify(process.env.NODE_ENV !== 'production')
      })
    ]

    webpackConfig.module.rules = [
      ...webpackConfig.module.rules,
      {
        test: /\.css$/,
        use: [
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [require('tailwindcss'), require('autoprefixer')]
              }
            }
          }
        ],
        include: path.resolve(__dirname, '../')
      }
    ]

    return webpackConfig
  }
}

module.exports = config

function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, "package.json")));
}
