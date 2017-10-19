'use strict';

const
    gulp          = require('gulp'),
    gulpWebpack   = require('./index'),
    webpackConfig = require('./example/webpack.config');

gulp.task('default', () =>{

    gulp.src('./example/src/bt/**/*View.js')
        .pipe(gulpWebpack(webpackConfig))
        .pipe(gulp.dest('./example/build/bt'));
});