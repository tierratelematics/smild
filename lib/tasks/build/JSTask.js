"use strict";

const Task = require('../Task'),
    gulp = require('gulp'),
    path = require('path'),
    watchify = require('watchify'),
    browserify = require('browserify'),
    babelify = require('babelify'),
    source = require('vinyl-source-stream'),
    gulpif = require('gulp-if'),
    streamify = require('gulp-streamify'),
    uglify = require('gulp-uglify'),
    header = require('gulp-header'),
    transform = require('vinyl-transform'),
    exorcist = require('exorcist'),
    tsify = require('tsify'),
    refresh = require('gulp-livereload'),
    ProjectType = require('../../ProjectType'),
    buffer = require('vinyl-buffer'),
    OptionsParser = require('../../OptionsParser'),
    _ = require('lodash');

class JSTask extends Task {

    constructor(buildManager, taskRunner) {
        super(buildManager, taskRunner);
        this.command = "js";
        this.bundleCounter = 0;
    }

    action() {
        var smildOptions = this._buildManager.options,
            browserifyOptions = {
                entries: [this._getBootstrapperPath()],
                basedir: this._buildManager.CWD,
                debug: !this._buildManager.isRelease(),
                cache: {},
                packageCache: {},
                fullPaths: true
            },
            bundleStream = this._buildManager.isWatching() ? watchify(browserify(browserifyOptions), {
                poll: /^win/.test(process.platform)
            }) : browserify(browserifyOptions);

        if (smildOptions.typescript) {
            bundleStream = bundleStream.plugin(tsify, OptionsParser.parseTypescript().compilerOptions);
        }
        if (smildOptions.babel) {
            bundleStream = bundleStream.transform(babelify, OptionsParser.parseBabel());
        }

        if (this._buildManager.isWatching())
            bundleStream.on('update', () => this.rebundle(bundleStream));

        return this.rebundle(bundleStream);
    }

    _getBootstrapperPath() {
        let target = this._buildManager.currentTarget;
        return path.resolve(
            this._buildManager.options.targets, target,
            'bootstrapper.' + (this._buildManager.options.typescript ? 'ts' : 'js')
        );
    }

    rebundle(bundleStream) {
        return bundleStream.bundle()
            .on('error', function (err) {
                console.error(err.message);
                this.emit("end");
            })
            .pipe(source(this._buildManager.BUNDLE_FILENAME + '.js'))
            .pipe(gulpif(this._buildManager.isRelease(), streamify(uglify(this._buildManager.options.uglifyjs))))
            .pipe(gulpif(this._buildManager.isRelease(), buffer()))
            .pipe(gulpif(this._buildManager.isRelease(), header('/*\n\n${name} : ${version}\n\n*/\n\n', {
                name: this._buildManager.options.projectPackage.name,
                version: this._buildManager.options.projectPackage.version
            })))
            .pipe(gulpif(!this._buildManager.isRelease(), transform(() => {
                return exorcist(this._buildManager.getTemporaryDirectory() + 'js/' + this._buildManager.BUNDLE_FILENAME + '.map.js');
            })))
            .pipe(gulp.dest(this._buildManager.getTemporaryDirectory() + 'js'))
            .pipe(refresh({
                start: this._buildManager.isWatching(),
                port: this._buildManager.options.liveReloadPort
            }))
            .on('data', () => {
                this.bundleCounter++;
                if (this._buildManager.isWatching() && this.bundleCounter > 1) //Don't rebundle on first build since post-build has not run
                    this._taskRunner.run('rebundle-hook');
            });
    }
}

module.exports = JSTask;