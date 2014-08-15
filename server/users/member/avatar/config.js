// Return avatar resize config

'use strict';

var configReader  = require('../../../_lib/uploads_config_reader');

module.exports = function (N, apiPath) {

  var config = configReader(((N.config.options || {}).users || {}).avatars || {});

  N.validate(apiPath, {});


  // Fill avatar size config
  //
  N.wire.on(apiPath, function fill_config(env) {
    env.res.size_config = config;
  });
};
