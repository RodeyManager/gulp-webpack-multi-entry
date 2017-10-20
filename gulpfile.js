'use strict';

const
    path          = require('path'),
    gulp          = require('gulp'),
    jsminer       = require('gulp-jsminer'),
    recache       = require('gulp-recache'),
    gulpWebpack   = require('./index'),
    webpackConfig = require('./example/webpack.config');

gulp.task('build.view.js', () => {
    gulp.src('./example/src/js/**/*View.js')
        .pipe(gulpWebpack(webpackConfig))
        // .pipe(jsminer())
        .pipe(gulp.dest('./example/build/js'));
});

gulp.task('build.view.html', ['build.view.js'], () => {
    gulp.src('./example/src/index.html')
        .pipe(recache({
            // queryKey: '_cv',
            // queryVal: 'script-@hash',
            hashSize: 10
            // basePath: path.resolve(__dirname, 'example/build')
        }))
        .pipe(gulp.dest('./example/build'));
});

gulp.task('default', ['build.view.html']);