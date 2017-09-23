// Clients are redirected here after authorisation on 3rd-party oauth server
// Then postponed actions (login/register/add) are finalized


'use strict';


const _ = require('lodash');


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
  N.wire.before(apiPath, { priority: -15 }, function register_guest_only(env) {
    return N.wire.emit('internal:users.redirect_not_guest', env);
  });


  // If provider returned error (for example, user cancelled authorization),
  // return to previous state.
  //
  N.wire.before(apiPath, { priority: -15 }, function check_oauth_error(env) {

    if (env.params.error) {
      var location = (env.session.state.oauth_action === 'register')
                        ? 'users.auth.register.show'
                        : 'users.auth.login.show';

      throw createRedirect(location);
    }
  });


  // Registration only - check oauth email uniqueness
  //
  N.wire.before(apiPath, { priority: -5 }, async function check_email_uniqueness(env) {

    if (env.session.oauth.action !== 'register') return;

    if (await N.models.users.AuthProvider.similarEmailExists(env.data.oauth.email)) {
      // reset oauth state
      env.session = _.omit(env.session, 'oauth');
      throw createRedirect('users.auth.oauth.error_show');
    }
  });


  // We should try to login user for registration too
  //
  N.wire.on(apiPath, async function finish_auth(env) {

    // Find authprovider for oauth data
    let authProvider = await N.models.users.AuthProvider
                            .findOne({
                              provider_user_id: env.data.oauth.provider_user_id,
                              type:             env.params.provider,
                              exist:            true
                            })
                            .lean(true);

    // No AuthProvider - go to registration with this auth data
    if (!authProvider) {
      env.session.oauth = env.session.oauth || {};
      env.session.oauth.info = env.data.oauth;
      throw createRedirect('users.auth.register.show');
    }

      // Find user for oauth data
    let user = await N.models.users.User
                        .findOne({ _id: authProvider.user, exists: true })
                        .lean(true);

    // If AuthProvider exists, but user not found - db is broken,
    // go to registration, but without oauth data.
    if (!user) {
      throw createRedirect('users.auth.register.show');
    }

    env.data.user     = user;
    env.data.authProvider = authProvider;
    env.data.redirect_id = (env.session.oauth || {}).redirect_id;

    await N.wire.emit('internal:users.login', env);

    throw {
      code: N.io.REDIRECT,
      head: {
        Location: env.data.redirect_url
      }
    };
  });
};
