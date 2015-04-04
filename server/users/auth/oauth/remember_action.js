// Set action to execute after oauth compleete

'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    action:      { type: 'string', 'enum': [ 'login', 'register' ], required: true },
    redirect_id: { type: 'string', minLength: 1 }
  });

  N.wire.on(apiPath, function remember_action(env, callback) {
    env.session.oauth = {};
    env.session.oauth.action = env.params.action;

    // For login - remember additional data (redirect_id) if exists
    if (env.params.action === 'login') {
      env.session.oauth.redirect_id = env.params.redirect_id;
    }

    callback();
  });

};
