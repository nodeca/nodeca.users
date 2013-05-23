// Reset user password


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function (env, callback) {
    //FIXME implement me
    callback();
  });
};
