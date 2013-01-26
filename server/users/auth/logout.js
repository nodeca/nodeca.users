// Logout
//
"use strict";


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
  });

  // Request handler
  //
  N.wire.on(apiPath, function (env, callback) {

    env.session = null;

    callback({
      code: N.io.REDIRECT,
      head: { Location: N.runtime.router.linkTo('forum.index') }
    });
  });
};
