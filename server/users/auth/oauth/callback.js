
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    properties: {
      provider: { type: 'String', required: true }
    },
    additionalProperties: true
  });


  N.wire.before(apiPath, function check_oauth_error(env, callback) {

    // if user cancelled authorization
    if (env.params.error) {
      var location = (env.session.oauth_action === 'register') ? 'users.auth.register.show' : 'users.auth.login.show';

      callback({
        code: N.io.REDIRECT,
        head: {
          'Location': N.runtime.router.linkTo(location)
        }
      });
      return;
    }
    callback();
  });


  // Redirect to login or registration
  N.wire.after(apiPath, function continue_auth(env, callback) {

    var location = (env.session.oauth_action === 'register') ? 'users.auth.register.show' : 'users.auth.login.show';

    callback({
      code: N.io.REDIRECT,
      head: {
        'Location': N.runtime.router.linkTo(location)
      }
    });
  });

};
