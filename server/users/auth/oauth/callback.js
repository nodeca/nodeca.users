
'use strict';

var _ = require('lodash');


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
      callback({
        code: N.io.REDIRECT,
        head: {
          'Location': N.runtime.router.linkTo('users.auth.oauth.error_show')
        }
      });
      return;
    }
    callback();
  });


  // Redirect to login or registration
  N.wire.after(apiPath, function continue_auth(env, callback) {

    // FIXME: Will be changed
    N.models.users.AuthLink
      .findOne({ 'provider_user_id': env.session.oauth.provider_user_id, 'type': env.params.provider, 'exist': true })
      .select('_id')
      .lean(true)
      .exec(function (err, authlink) {

        if (err) {
          callback(err);
          return;
        }

        // If user exist - redirect to login
        if (authlink) {
          callback({
            code: N.io.REDIRECT,
            head: {
              'Location': N.runtime.router.linkTo('users.auth.login.show')
            }
          });
          return;
        }

        callback({
          code: N.io.REDIRECT,
          head: {
            'Location': N.runtime.router.linkTo('users.auth.register.show')
          }
        });
      });
  });

};
