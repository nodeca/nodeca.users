// Show success registration page
//
"use strict";


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
  });

  // Request handler
  //
  N.wire.on(apiPath, function (env, callback) {
    env.response.data.head.title = env.helpers.t(env.method + '.title');
    callback();
  });
};
