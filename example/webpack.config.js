/**
 * Created by Rodey on 2017/10/17.
 */

const path = require('path');
const webpack = require('webpack');

module.exports = {
    output: {
        path: path.resolve(__dirname, 'build/bt'),
        filename: '[name].js'
    },
    devtool: "inline-source-map",

    module: {
        rules: [
            {
                test: /\.js$|\.jsx$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['env', 'react'],
                        plugins: [
                            'add-module-exports',
                            'transform-export-extensions',
                            'babel-plugin-transform-es2015-modules-commonjs'
                        ]
                    }
                }
            }
        ]
    },
    plugins: [
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false,
                drop_console: false
            }
        })
    ]
};