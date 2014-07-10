
'use strict';

var _ = require('lodash');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    properties: {
      provider: { type: 'String', required: true }
    },
    additionalProperties: true
  });


  // Redirects to specified URL
  //
  function createRedirect(apiPath) {
    return ({
      code: N.io.REDIRECT,
      head: {
        'Location': N.runtime.router.linkTo(apiPath)
      }
    });
  }


  N.wire.before(apiPath, { proiroty: -15 }, function register_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  // If provider return error. Example: user cancelled authorization
  //
  N.wire.before(apiPath, { proiroty: -15 }, function check_oauth_error(env, callback) {

    if (env.params.error) {
      var location = (env.session.state.oauth_action === 'register')
                        ? 'users.auth.register.show'
                        : 'users.auth.login.show';

      callback(createRedirect(location));
      return;
    }
    callback();
  });


  // Check oauth email uniqueness
  //
  N.wire.before(apiPath, { proiroty: -5 }, function check_email_uniqueness(env, callback) {

    if ((env.session.state.oauth_action === 'login')){
      callback();
      return;
    }

    N.models.users.AuthLink
      .findOne({ 'email' : env.data.oauth.email, 'exist': true })
      .lean(true)
      .exec(function (err, authlink) {

        if (err) {
          callback(err);
          return;
        }

        if (authlink) {
          env.session = _.omit(env.session, 'state');
          callback(createRedirect('users.auth.oauth.error_show'));
          return;
        }

        callback();
      });
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
        callback(createRedirect('users.auth.register.show'));
        return;
      }

        // Find user for oauth data
      N.models.users.User
          .findOne({ '_id': authLink.user_id, exists: 'true' })
          .lean(true)
          .exec(function (err, user) {

        if (err) {
          callback(err);
          return;
        }

        if (!user) {
          callback(createRedirect('users.auth.register.show'));
          return;
        }

        env.data.user     = user;

        env.data.redirect_id = env.session.state.redirect_id;
        N.wire.emit('internal:users.login', env, function redirect() {
          callback({
            code: N.io.REDIRECT,
            head: {
              'Location': env.data.redirect_url
            }
          });
        });
      });
    });
  });


  // Redirect to registration
  //
  N.wire.after(apiPath, function continue_auth(env, callback) {

    callback(createRedirect('users.auth.register.show'));

  });

};
