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
  afterSign: 'scripts/notarize.js',
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
    entitlementsInherit: 'resources/mac/entitlements.mac.plist',
    notarize: false // Explicitly disable built-in notarization (we use afterSign instead)
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
      },
      {
        target: 'flatpak',
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
  flatpak: {
    // Reverse-DNS app id (matches appId). Used as the Flatpak ref.
    // `license` is a path to the license file, not an SPDX identifier.
    license: 'LICENSE',
    // Pin runtime/base to a current, supported freedesktop release.
    // org.electronjs.Electron2.BaseApp ships matching branches.
    runtimeVersion: '24.08',
    baseVersion: '24.08',
    finishArgs: [
      // Rendering (Wayland + X11 fallback)
      '--socket=wayland',
      '--socket=x11',
      '--share=ipc',
      // GPU / OpenGL
      '--device=dri',
      // Audio
      '--socket=pulseaudio',
      // Network access (RPC, Midgard, etc.)
      '--share=network',
      // System notifications
      '--talk-name=org.freedesktop.Notifications',
      // Hardware wallet (Ledger) USB access via host udev/USB devices
      '--device=all',
      // Read-only access to the native (.deb/AppImage) config dir so the
      // first-run migration can import existing keystores into the sandbox.
      // Use the LITERAL host path, not the `xdg-config` token: the token
      // bind-mounts onto the app's own per-app config dir (so `:ro` would make
      // the whole data dir read-only), whereas the literal path mounts the host
      // dir separately, keeping the app's sandbox data writable.
      // The app's own data lives in the per-app sandbox dir (no grant needed);
      // export/import of keystore files goes through the FileChooser portal.
      // Note: case-sensitive — must match app.name (`ASGARDEX`).
      '--filesystem=~/.config/ASGARDEX:ro'
    ]
  },
  publish: {
    provider: 'github',
    owner: 'asgardex',
    repo: 'asgardex-desktop',
    private: false
  }
}
