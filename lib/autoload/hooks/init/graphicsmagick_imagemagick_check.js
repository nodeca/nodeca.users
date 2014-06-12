// Check is ImageMagick or GraphicsMagick installed

'use strict';

var exec = require('child_process').exec;

module.exports = function (N) {


  // Check binary dependencies
  //
  N.wire.before('init:server', function graphicsmagick_imagemagick_check(__, callback) {

    // Check GraphicsMagick
    exec('gm version', function (err, stdout) {
      if (stdout.indexOf('GraphicsMagick') > 0) {
        // GraphicsMagick installed - continue loading
        callback();
        return;
      }

      // Check ImageMagick
      exec('convert -version', function (err, stdout) {
        if (stdout.indexOf('ImageMagick') > 0) {
          // ImageMagick installed - continue loading
          callback();
          return;
        }

        callback('Can\'t start: You need GraphicsMagick or ImageMagick to run. Make sure that one of packages is installed and can be found via search path.');
      });
    });
  });
};
