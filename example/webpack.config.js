/**
 * Created by Rodey on 2017/10/17.
 */

const path = require('path');
const webpack = require('webpack');

module.exports = {
    output: {
        path: path.resolve(__dirname, './build/js'),
        filename: '[name].js'
    },
    devtool: 'source-map',
    // stats: 'none',

    module: {
        rules: [
            {
                test: /\.js$$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['env']
                    }
                }
            }
        ]
    }/*,
    plugins: [
        new webpack.optimize.UglifyJsPlugin({
            compress: {
                warnings: false,
                drop_console: false
            }
        })
    ]*/
};