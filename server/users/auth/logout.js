// Logout


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function logout_do(env) {
    env.session = null;
  });
};
