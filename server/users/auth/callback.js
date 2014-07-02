
'use strict';

var _ = require('lodash');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    provider: { type: 'string', required: true },
    state: { type: 'string', required: false },
    code: { type: 'string', required: false }
  });


  N.wire.on(apiPath, function oauth_callback(env, callback) {
    callback();
  });


  N.wire.after(apiPath, function autologin(env, callback) {
    callback({
      code: N.io.REDIRECT,
      head: {
        'Location': N.runtime.router.linkTo('users.auth.register.show')
      }
    });
  });
};
