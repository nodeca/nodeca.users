// Do logout


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function logout(env) {
    env.session = null;
  });
};
