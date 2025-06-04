module.exports = {
  appId: 'org.thorchain.asgardex',
  productName: 'ASGARDEX',
  copyright: 'Copyright © 2025 ${author}',

  files: [
    'resources/icon.png',
    'src/renderer/assets/svg/coin-*.svg',
    'build/main/**/*',
    'build/renderer/**/*',
    'build/preload/**/*',
    'node_modules/**/*',
    'package.json'
  ],
  afterSign: 'scripts/notarize.mjs',
  directories: {
    buildResources: 'resources',
    output: 'release'
  },
  mac: {
    artifactName: '${productName}-${version}-${os}-${env.OS_VERSION_SUFFIX}.${ext}',
    target: ['dmg'],
    category: 'public.app-category.finance',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'resources/mac/entitlements.mac.plist',
    entitlementsInherit: 'resources/mac/entitlements.mac.plist'
  },
  dmg: {
    contents: [
      {
        x: 130,
        y: 220
      },
      {
        x: 410,
        y: 220,
        type: 'link',
        path: '/Applications'
      }
    ]
  },
  win: {
    artifactName: '${productName}-${version}-${os}.${ext}',
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      }
    ]
  },
  linux: {
    artifactName: '${productName}-${version}-${os}.${ext}',
    category: 'Finance',
    packageCategory: 'wallet',
    target: [
      {
        target: 'deb',
        arch: ['x64']
      },
      {
        target: 'AppImage',
        arch: ['x64']
      }
    ],
    desktop: {
      Comment: 'ASGARDEX',
      Icon: 'asgardex',
      Name: 'ASGARDEX',
      StartupNotify: 'true',
      Terminal: 'false',
      Type: 'Application',
      Categories: 'Finance'
    }
  },
  publish: {
    provider: 'github',
    owner: 'asgardex',
    repo: 'asgardex-desktop',
    private: false
  }
}
