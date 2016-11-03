// Execute login using one-time token sent by email after user
// tries to log in using an empty password.
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    secret_key: { type: 'string', required: true }
  });


  // Check token
  //
  N.wire.before(apiPath, function* check_token(env) {
    let token = yield N.models.users.TokenLoginByEmail
                          .findOne({ secret_key: env.params.secret_key })
                          .lean(true);

    if (!token || token.ip !== env.req.ip) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_bad_token')
      };
    }

    env.data.token = token;
  });


  // Search for user
  //
  N.wire.before(apiPath, function* fetch_user(env) {
    let token = env.data.token;

    env.data.user = yield N.models.users.User.findById(token.user);

    if (!env.data.user) {
      throw {
        code:         N.io.CLIENT_ERROR,
        message:      env.t('err_bad_token'),
        bad_password: false
      };
    }
  });


  // Fetch authlink
  //
  N.wire.on(apiPath, function* get_authlink(env) {
    let authLink = yield N.models.users.AuthLink.findOne({ user: env.data.user._id, type: 'plain', exists: true });

    if (!authLink) {
      // auth tokens are only issued for users with authlinks,
      // so this never happens
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_bad_token')
      };
    }

    // keep it for logging in later on
    env.data.authLink = authLink;
  });


  // Remove current and all other login tokens for this user
  //
  N.wire.after(apiPath, function* remove_token(env) {
    yield N.models.users.TokenLoginByEmail.remove({ user: env.data.user._id });
  });


  // Log user in
  //
  N.wire.after(apiPath, function* login(env) {
    // Set login redirect URL.
    env.data.redirect_id = env.data.token.redirect_id;

    yield N.wire.emit('internal:users.login', env);

    throw {
      code: N.io.REDIRECT,
      head: {
        Location: env.data.redirect_url
      }
    };
  });
};
