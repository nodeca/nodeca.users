// Sets redirect action: register or login

'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    action: { type: 'string', required: true },
    enum: ['login', 'register']
  });

  N.wire.on(apiPath, function save_action(env, callback) {
    env.session.oauth_action = env.params.action;
    callback();
  });

};
