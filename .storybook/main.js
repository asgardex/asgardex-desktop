import { dirname, join } from 'path'
import { mergeConfig } from 'vite'
import customViteConfig from '../vite.storybook'

const config = {
  core: {
    disableTelemetry: true,
    channelOptions: { allowFunction: false, maxDepth: 10 }
  },
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  staticDirs: ['../public'],
  stories: ['../src/renderer/**/*.stories.@(ts|tsx)'],
  addons: [
    getAbsolutePath('@storybook/addon-viewport'),
    getAbsolutePath('@storybook/addon-docs'),
    {
      name: '@storybook/addon-essentials',
      options: {
        viewport: false,
        docs: false
      }
    },
    '@chromatic-com/storybook'
  ],
  viteFinal: async (config, { configType: _ }) => {
    return mergeConfig(config, customViteConfig)
  }
}

function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, 'package.json')))
}

export default config
