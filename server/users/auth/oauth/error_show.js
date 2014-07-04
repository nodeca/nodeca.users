
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});


  N.wire.on(apiPath, function oauth_callback(env, callback) {
    callback();
  });

};
