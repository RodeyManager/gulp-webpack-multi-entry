# gulp-webpack-multi-entry

gulp plugin as webpack mulitple entry file, <a href="https://webpack.js.org">webpack</a>

## options

see <a href="https://webpack.js.org/configuration/">webpack configuration</a>

```javascript
const gulp = require('gulp'),
    gulpWebpack = require('./index'),
    webpackConfig = require('./webpack.config');

gulp.task('default', () => {
    gulp
        .src('./example/src/bt/**/*View.js')
        .pipe(gulpWebpack(webpackConfig))
        .pipe(gulp.dest('./example/build/bt'));
});
```

```javascript
    const
        gulp          = require('gulp'),
        gulpWebpack   = require('./index'),
        webpackConfig = require('./webpack.config'),
        webpack       = require('webpack),
        extend        = require('extend');

    const config = extend(true, webpackConfig, { webpack });

    gulp.task('default', () =>{

        gulp.src('./example/src/bt/**/*View.js')
            .pipe(gulpWebpack(config))
            .pipe(gulp.dest('./example/build/bt'));
    });
```
