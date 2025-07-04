//@ts-check

'use strict';

const path = require('path');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

module.exports = [
  // Extension bundle - runs in Node.js
  {
    name: 'extension',
    mode: 'development',
    target: 'node',
    entry: './src/extension.ts',
    output: {
      filename: 'extension.js',
      path: path.resolve(__dirname, 'dist'),
      libraryTarget: 'commonjs2'
    },
    externals: {
      vscode: 'commonjs vscode'
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    devtool: 'source-map'
  },
  // Webview bundle - runs in browser/webview
  {
    name: 'webview',
    mode: 'development',
    target: 'web',
    entry: './src/webview/index.tsx',
    output: {
      filename: 'webview.js',
      path: path.resolve(__dirname, 'dist')
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js']
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    devtool: 'source-map'
  }
];