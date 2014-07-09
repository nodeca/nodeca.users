
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    properties: {
      provider: { type: 'String', required: true }
    },
    additionalProperties: true
  });


  // Redirects to specified URL
  //
  function redirectTo(location, callback) {
    callback({
      code: N.io.REDIRECT,
      head: {
        'Location': location
      }
    });
  }


  N.wire.before(apiPath, function register_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  // If provider return error. Example: user cancelled authorization
  //
  N.wire.before(apiPath, { proiroty: -100 }, function check_oauth_error(env, callback) {

    if (env.params.error) {
      var location = (env.session.oauth_action === 'register') ? 'users.auth.register.show' : 'users.auth.login.show';

      redirectTo(N.runtime.router.linkTo(location), callback);
      return;
    }
    callback();
  });


  // Try to login user
  //
  N.wire.on(apiPath, function finish_auth(env, callback) {

    env.session.oauth = env.data.oauth;

    // Find authlink for oauth data
    N.models.users.AuthLink
        .findOne({
          'provider_user_id': env.data.oauth.provider_user_id,
          'type': env.params.provider,
          'exist' : true
        })
        .lean(true)
        .exec(function (err, authLink) {

      if (err) {
        callback(err);
        return;
      }

      if (!authLink) {
        redirectTo(N.runtime.router.linkTo('users.auth.register.show'), callback);
        return;
      }

        // Find user for oauth data
      N.models.users.User
          .findOne({ '_id': authLink.user_id })
          .lean(true)
          .exec(function (err, user) {

        if (err) {
          callback(err);
          return;
        }

        if (!user) {
          redirectTo(N.runtime.router.linkTo('users.auth.register.show'), callback);
          return;
        }

        env.data.user     = user;
        env.data.authLink = authLink;

        env.data.redirect_id = env.session.redirect_id;
        N.wire.emit('internal:users.login', env, function redirect() {
          redirectTo(env.data.redirect_url, callback);
        });
      });
    });
  });


  // Redirect to registration
  //
  N.wire.after(apiPath, function continue_auth(env, callback) {

    redirectTo(N.runtime.router.linkTo('users.auth.register.show'), callback);

  });

};
