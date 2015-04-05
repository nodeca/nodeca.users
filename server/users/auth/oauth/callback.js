// Clients are redirected here after authorisation on 3rd-party oauth server
// Then postponed actions (login/register/add) are finalized


'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    properties: {
      provider: { type: 'string', required: true }
    },
    additionalProperties: true
  });


  // Redirects to specified URL
  //
  function createRedirect(apiPath) {
    return ({
      code: N.io.REDIRECT,
      head: {
        Location: N.router.linkTo(apiPath)
      }
    });
  }


  // TODO: pass check for adding new account from settings
  //
  N.wire.before(apiPath, { priority: -15 }, function register_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  // If provider returned error (for example, user cancelled authorization),
  // return to previous state.
  //
  N.wire.before(apiPath, { priority: -15 }, function check_oauth_error(env, callback) {

    if (env.params.error) {
      var location = (env.session.state.oauth_action === 'register')
                        ? 'users.auth.register.show'
                        : 'users.auth.login.show';

      callback(createRedirect(location));
      return;
    }
    callback();
  });


  // Registration only - check oauth email uniqueness
  //
  N.wire.before(apiPath, { priority: -5 }, function check_email_uniqueness(env, callback) {

    if (env.session.oauth.action !== 'register') {
      callback();
      return;
    }

    N.models.users.AuthLink
        .findOne({ email : env.data.oauth.email, exists: true })
        .lean(true)
        .exec(function (err, authlink) {

      if (err) {
        callback(err);
        return;
      }

      if (authlink) {
        // reset oauth state
        env.session = _.omit(env.session, 'oauth');

        callback(createRedirect('users.auth.oauth.error_show'));
        return;
      }

      callback();
    });
  });


  // We should try to login user for registration too
  //
  N.wire.on(apiPath, function finish_auth(env, callback) {

    // Find authlink for oauth data
    N.models.users.AuthLink
        .findOne({
          provider_user_id: env.data.oauth.provider_user_id,
          type:             env.params.provider,
          exist:            true
        })
        .lean(true)
        .exec(function (err, authLink) {

      if (err) {
        callback(err);
        return;
      }

      // No AuthLink - go to registration with this auth data
      if (!authLink) {
        env.session.oauth = env.session.oauth || {};
        env.session.oauth.info = env.data.oauth;
        callback(createRedirect('users.auth.register.show'));
        return;
      }

      // Find user for oauth data
      N.models.users.User
          .findOne({ _id: authLink.user_id, exists: true })
          .lean(true)
          .exec(function (err, user) {

        if (err) {
          callback(err);
          return;
        }

        // If AuthLink exists, but user not found - db is broken,
        // go to registration, but without oauth data.
        if (!user) {
          callback(createRedirect('users.auth.register.show'));
          return;
        }

        env.data.user     = user;
        env.data.authLink = authLink;
        env.data.redirect_id = (env.session.oauth || {}).redirect_id;

        N.wire.emit('internal:users.login', env, function () {
          callback({
            code: N.io.REDIRECT,
            head: {
              Location: env.data.redirect_url
            }
          });
        });
      });
    });
  });
};
