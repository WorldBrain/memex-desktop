import type { Configuration } from 'webpack'

import { rules } from './webpack.rules'

const CopyWebpackPlugin = require('copy-webpack-plugin')
const Dotenv = require('dotenv-webpack')

export const mainConfig: Configuration = {
    // existing configuration...
    entry: './src/index.ts',
    module: {
        rules,
    },
    resolve: {
        extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
        alias: {
            sharp$: false,
            'onnxruntime-node$': false,
        },
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: 'src/img', to: 'img' }, // copies all files from 'src/img' to 'img'
            ],
        }),
        new Dotenv(),
    ],
}
