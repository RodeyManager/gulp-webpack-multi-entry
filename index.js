/**
 * Created by Rodey on 2017/10/17.
 */

'use strict';

const gutil            = require('gulp-util');
const nodePath         = require('path');
const fs               = require('fs');
const File             = require('vinyl');
const extend           = require('extend');
const MemoryFileSystem = require('memory-fs');
const through2         = require('through2');
const ProgressPlugin   = require('webpack/lib/ProgressPlugin');
const clone            = require('lodash.clone');
const some             = require('lodash.some');

let defaultStatsOptions = {
    colors: gutil.colors.supportsColor,
    hash: false,
    timings: false,
    chunks: false,
    chunkModules: false,
    modules: false,
    children: true,
    version: false,
    cached: false,
    cachedAssets: false,
    reasons: false,
    source: false,
    errorDetails: false
};

const PluginError = gutil.PluginError;
const PLUGIN_NAME = 'gulp-webpack-multi-entry';

module.exports = function(options, wp, done){
    options    = clone(options) || {};
    let { progress } = options;
    delete options.progress;

    let config = options.config || options;

    if(typeof done !== 'function'){
        let callingDone = false;
        done            = function(err, stats){
            if(err){
                // The err is here just to match the API but isnt used
                return;
            }
            stats = stats || {};
            if(options.quiet || callingDone){
                return;
            }

            // Debounce output a little for when in watch mode
            if(options.watch){
                callingDone = true;
                setTimeout(function(){
                    callingDone = false;
                }, 500);
            }

            if(options.verbose){
                gutil.log(stats.toString({
                    colors: gutil.colors.supportsColor
                }));
            }else{
                let statsOptions = (options && options.stats) || {};

                Object.keys(defaultStatsOptions).forEach(function(key){
                    if(typeof statsOptions[key] === 'undefined'){
                        statsOptions[key] = defaultStatsOptions[key];
                    }
                });

                gutil.log(stats.toString(statsOptions));
            }
        };
    }

    let webpack = wp || require('webpack');
    let cfs     = [];

    function pipeBuffer(file, enc, next){
        if(file.isStream()){
            this.emit('error', new PluginError(PLUGIN_NAME, 'Stream content is not supported'));
            return next(null, file);
        }

        if(file.isBuffer()){

            let fileInfo   = nodePath.parse(file.path);
            let cf         = extend(true, {}, config);
            let cwd        = nodePath.resolve(process.cwd());
            let basePath   = nodePath.resolve(cwd, config.output.path);
            cf.entry       = file.path;
            cf.output.path = nodePath.dirname(nodePath.resolve(basePath, file.relative));
            cfs.push(cf);
        }

        next();
    };

    function endStream(cb){
        cfs = cfs.filter(cf => cf.entry);

        let self         = this;
        let handleConfig = (config) => {
            config.output          = config.output || {};
            config.watch           = !!options.watch;
            config.output.path     = config.output.path || process.cwd();
            config.output.filename = getFileName(config);
            config.watch           = options.watch;
            return true;
        };

        let succeeded;
        for(let i = 0; i < cfs.length; i++){
            succeeded = handleConfig(cfs[i]);
            if(!succeeded){
                return false;
            }
        }

        let compiler = webpack(cfs);
        compiler.run((err, stats) => {
            if(err){
                this.emit('error', new gutil.PluginError('webpack-stream', err));
                return;
            }

            if (err) {
                this.emit('error', new gutil.PluginError('webpack-stream', err));
                return;
            }
            let jsonStats = stats ? stats.toJson() || {} : {};
            let errors = jsonStats.errors || [];
            if (errors.length) {
                let errorMessage = errors.reduce(function (resultMessage, nextError) {
                    resultMessage += nextError.toString();
                    return resultMessage;
                }, '');
                let compilationError = new gutil.PluginError('webpack-stream', errorMessage);
                if (!options.watch) {
                    self.emit('error', compilationError);
                }
                this.emit('compilation-error', compilationError);
            }

            done(err, stats);

        });

        if (options.watch && compiler.compiler) {
            compiler = compiler.compiler;
        }

        if (progress) {
            compiler.apply(new ProgressPlugin(function (percentage, msg) {
                percentage = Math.floor(percentage * 100);
                msg = percentage + '% ' + msg;
                if (percentage < 10) msg = ' ' + msg;
                gutil.log('webpack', msg);
            }));
        }

        // let handleCompiler = function(compiler){
        //
        //     let fs = compiler.outputFileSystem = new MemoryFileSystem();
        //
        //     compiler.plugin('after-emit', (compilation, callback) => {
        //         Object.keys(compilation.assets).forEach(outname => {
        //             if(compilation.assets[outname].emitted){
        //                 let file = prepareFile(fs, compiler, outname);
        //                 self.push(file);
        //             }
        //         });
        //         callback();
        //     });
        // };
        //
        // if(Array.isArray(cfs) && options.watch){
        //     compiler.watchings.forEach(compiler => {
        //         handleCompiler(compiler);
        //     });
        // }else if(Array.isArray(cfs)){
        //     compiler.compilers.forEach(compiler => {
        //         handleCompiler(compiler);
        //     });
        // }else{}

    };

    let stream = through2.obj(pipeBuffer, endStream);

    // If entry point manually specified, trigger that
    let hasEntry = Array.isArray(cfs)
        ? some(cfs, c => {
            return c.entry;
        })
        : cfs.entry;
    if(hasEntry){
        stream.end();
    }

    return stream;

};

function getFileName(config){

    let fileInfo = nodePath.parse(config.entry);
    let filename = config.output.filename;
    if(!filename){
        return fileInfo.base;
    }
    return filename = filename.replace(/([\s\S]*?)(\[[name]*?\])([\s\S]*?)/g, "$1" + fileInfo.name + "$3");
}

function prepareFile(fs, compiler, outname){
    let path = fs.join(compiler.outputPath, outname);
    if(path.indexOf('?') !== -1){
        path = path.split('?')[0];
    }

    let contents = fs.readFileSync(path);

    let file = new File({
        base: compiler.outputPath,
        path: nodePath.join(compiler.outputPath, outname),
        contents: contents
    });
    return file;
}

// Expose webpack if asked
Object.defineProperty(module.exports, 'webpack', {
    get: function(){
        return require('webpack');
    }
});