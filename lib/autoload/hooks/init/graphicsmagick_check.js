// Check is GraphicsMagick installed
//

'use strict';

var exec = require('child_process').exec;

module.exports = function (N) {

  N.wire.before('init:models', function graphicsmagick_check(__, callback) {

    exec('gm version', function (__, stdout) {

      // Don't check error because condition below is more strict
      if (stdout.indexOf('GraphicsMagick') === -1) {
        callback(new Error("You need GraphicsMagick to run this application. Can't find GraphicsMagick."));
        return;
      }

      callback();
    });
  });
};
