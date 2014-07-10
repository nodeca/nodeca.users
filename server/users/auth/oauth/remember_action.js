// Sets redirect action: register or login

'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    action: { type: 'string', enum: [ 'login', 'register' ], required: true },
    redirect_id: { type: 'string', required: false }
  });

  N.wire.on(apiPath, function save_action(env, callback) {
    env.session.state = {};
    env.session.state.oauth_action = env.params.action;
    if (env.params.action === 'login') {
      env.session.state.redirect_id = env.params.redirect_id;
    }
    callback();
  });

};
