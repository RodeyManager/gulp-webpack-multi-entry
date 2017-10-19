/**
 * Created by Rodey on 2017/10/17.
 */

'use strict';

const gutil            = require('gulp-util');
const nodePath         = require('path');
const nodeFS           = require('fs');
const mkdirp           = require('mkdirp');
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
    options      = clone(options) || {};
    let progress = options.progress;
    delete options.progress;

    let config      = options.config || options;
    let callingDone = false;

    done = typeof done === 'function' ? done : doneCallback;

    let webpack = wp || require('webpack');
    let cfs     = [];

    function doneCallback(err, stats){
        if(err) return;
        stats = stats || {};
        if(options.quiet || callingDone){
            return;
        }

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
    }

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
            return compilerStream.apply(this, [file, enc, next, cf]);
        }

        next();
    };

    function compilerStream(file, enc, next, config){
        let self = this;

        config.output          = config.output || {};
        config.watch           = !!options.watch;
        config.output.path     = config.output.path || process.cwd();
        config.output.filename = getFileName(config);

        // 创建实例 webpack compiler
        let wpc = webpack(config);
        running.apply(this, [wpc, file, config]);

        if(options.watch && wpc.compiler){
            wpc = wpc.compiler;
        }
        // 是否显示编译进度
        progress && showProgress(wpc);
        // 编译阶段
        return handleCompiler.apply(this, [wpc, file, config, next]);

    }

    function running(wpc, file){
        wpc.run((err, stats) =>{
            if(err){
                this.emit('error', new gutil.PluginError('webpack-stream', err));
                return;
            }

            if(err){
                this.emit('error', new gutil.PluginError('webpack-stream', err));
                return;
            }
            let jsonStats = stats ? stats.toJson() || {} : {};
            let errors    = jsonStats.errors || [];
            if(errors.length){
                let errorMessage     = errors.reduce(function(resultMessage, nextError){
                    resultMessage += nextError.toString();
                    return resultMessage;
                }, '');
                let compilationError = new gutil.PluginError('webpack-stream', errorMessage);
                if(!options.watch){
                    self.emit('error', compilationError);
                }
                this.emit('compilation-error', compilationError);
            }

            done(err, stats, wpc, file, options);

        });
    }

    function showProgress(wpc){
        wpc.apply(new ProgressPlugin(function(percentage, msg){
            percentage = Math.floor(percentage * 100);
            msg        = percentage + '% ' + msg;
            if(percentage < 10) msg = ' ' + msg;
            gutil.log('webpack', msg);
        }));
    }

    function handleCompiler(wpc, file, config, next){

        // 设置内存操作FileSystem
        let fs = wpc.outputFileSystem = new MemoryFileSystem();

        // 编译完成后读取数据
        wpc.plugin('after-emit', (compilation, callback) =>{

            Object.keys(compilation.assets).forEach(outname =>{
                if(compilation.assets[outname].emitted){
                    if(!/\.map$|\.source$|\.source-map$/.test(outname)){
                        file = recombineFile(file, fs, wpc, outname);
                        this.push(file);
                        next();
                    }else{
                        // file = recombineNewFile(file, fs, wpc, outname);
                        let existsAt = compilation.assets[outname].existsAt;
                        let existsAtPath = nodePath.dirname(existsAt);
                        if(!nodeFS.existsSync(existsAtPath)){
                            mkdirp.sync(existsAtPath);
                        }
                        nodeFS.writeFileSync(existsAt, compilation.assets[outname]._value, 'utf8');
                    }
                }
            });
            callback();
        });

    }

    function getFileName(config){

        let fileInfo = nodePath.parse(config.entry);
        let filename = config.output.filename;
        if(!filename){
            return fileInfo.base;
        }
        return filename = filename.replace(/([\s\S]*?)(\[[name]*?[:\d]?\])([\s\S]*?)/g, "$1" + fileInfo.name + "$3");
    }

    function recombineFile(file, fs, wpc, outname){

        let fileInfo = nodePath.parse(file.path);
        let path     = fs.join(wpc.outputPath, outname);
        if(path.indexOf('?') !== -1){
            path = path.split('?')[0];
        }
        // 内存中读取数据
        file.contents = fs.readFileSync(path);
        fileInfo.base = outname;
        fileInfo.name = outname.replace('.' + fileInfo.ext, '');
        file.path     = nodePath.format(fileInfo);

        return file;
    }

    function recombineNewFile(file, fs, wpc, outname){

        let fileInfo = nodePath.parse(file.path);
        let path     = fs.join(wpc.outputPath, outname);
        if(path.indexOf('?') !== -1){
            path = path.split('?')[0];
        }
        fileInfo.base = outname;
        fileInfo.name = outname.replace('.' + fileInfo.ext, '');

        return new File({
            base: file.base,
            path: nodePath.format(fileInfo),
            contents: fs.readFileSync(path)
        });
    }

    return through2.obj(pipeBuffer);

};

// Expose webpack if asked
Object.defineProperty(module.exports, 'webpack', {
    get: function(){
        return require('webpack');
    }
});