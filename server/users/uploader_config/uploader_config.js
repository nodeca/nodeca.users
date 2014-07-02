// Return uploader settings


'use strict';

var configReader  = require('../../_lib/uploads_config_reader');

module.exports = function (N, apiPath) {

  N.validate(apiPath, {});

  // Fill uploader settings
  //
  N.wire.on(apiPath, function fill_uploader_settings(env) {
    env.res = configReader(((N.config.options || {}).users || {}).media || {});
  });
};
