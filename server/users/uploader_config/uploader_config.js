// Return uploader settings


'use strict';

var resizeParse = require('../../_lib/resize_parse');

module.exports = function (N, apiPath) {

  N.validate(apiPath, {});

  // Fill uploader settings
  //
  N.wire.on(apiPath, function fill_uploader_settings(env) {
    env.res = resizeParse(N.config.users.uploads);
  });
};
