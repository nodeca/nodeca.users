'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    // Fill when params available
  });


  N.wire.on(apiPath, function (env, callback) {
    //FIXME implement me
    callback();
  });
};