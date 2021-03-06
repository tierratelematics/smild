"use strict";

const Task = require('../Task'),
    gulp = require('gulp'),
    mocha = require('gulp-mocha'),
    fs = require('fs');

class DocTask extends Task {

    constructor(buildManager) {
        super(buildManager);
        this.command = "doc";
    }

    action() {
        //Dirty trick to capture Mocha output into a file
        //since gulp-mocha does not pipe the test output
        fs.writeFileSync('./doc.html', '');
        var originalWrite = process.stdout.write;
        process.stdout.write = function (chunk) {
            var textChunk = chunk.toString('utf8');
            if (!textChunk.match(/finished.+after/gmi)) {
                fs.appendFile('./doc.html', chunk);
            }
            originalWrite.apply(this, arguments);
        };

        return gulp.src(this._buildManager.options.test, {read: false})
            .pipe(mocha({
                reporter: 'doc',
                compilers: {
                    ts: require('ts-node/register'),
                    js: require('babel-core/register')
                }
            }));
    }
}

module.exports = DocTask;