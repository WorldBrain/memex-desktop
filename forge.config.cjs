const { MakerSquirrel } = require('@electron-forge/maker-squirrel');
const { MakerZIP } = require('@electron-forge/maker-zip');
const { MakerDeb } = require('@electron-forge/maker-deb');
const { MakerRpm } = require('@electron-forge/maker-rpm');
const { AutoUnpackNativesPlugin } = require('@electron-forge/plugin-auto-unpack-natives');
// const { WebpackPlugin } = require('@electron-forge/plugin-webpack');

// const { mainConfig } = require('./webpack.main.config');
// const { rendererConfig } = require('./webpack.renderer.config');

const config = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({}), new MakerZIP({}, ['darwin']), new MakerRpm({}), new MakerDeb({})],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    // new WebpackPlugin({
    //   mainConfig,
    //   renderer: {
    //     config: rendererConfig,
    //     entryPoints: [
    //       {
    //         html: './src/index.html',
    //         js: './src/renderer.ts',
    //         name: 'main_window',
    //         preload: {
    //           js: './src/preload.ts',
    //         },
    //       },
    //     ],
    //   },
    // }),
  ],
};

module.exports = config;