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
  N.wire.before(apiPath, async function check_token(env) {
    let token = await N.models.users.TokenLoginByEmail
                          .findOne({ secret_key: env.params.secret_key })
                          .lean(true);

    if (!token || token.session_id !== env.session_id) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_bad_token')
      };
    }

    env.data.token = token;
  });


  // Search for user
  //
  N.wire.before(apiPath, async function fetch_user(env) {
    let token = env.data.token;

    env.data.user = await N.models.users.User.findById(token.user);

    if (!env.data.user) {
      throw {
        code:         N.io.CLIENT_ERROR,
        message:      env.t('err_bad_token'),
        bad_password: false
      };
    }
  });


  // Fetch authprovider
  //
  N.wire.on(apiPath, async function get_authprovider(env) {
    let authProvider = await N.models.users.AuthProvider.findOne()
                             .where('_id').equals(env.data.token.authprovider)
                             .where('exists').equals(true)
                             .lean(true);

    if (!authProvider) {
      // can happen if authprovider becomes disabled after user requests otp,
      // e.g. regular login with a password using vb authprovider
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_bad_token')
      };
    }

    // keep it for logging in later on
    env.data.authProvider = authProvider;
  });


  // Remove current and all other login tokens for this user
  //
  N.wire.after(apiPath, async function remove_token(env) {
    await N.models.users.TokenLoginByEmail.remove({ user: env.data.user._id });
  });


  // Log user in
  //
  N.wire.after(apiPath, async function login(env) {
    // Set login redirect URL.
    env.data.redirect_id = env.data.token.redirect_id;

    await N.wire.emit('internal:users.login', env);

    throw {
      code: N.io.REDIRECT,
      head: {
        Location: env.data.redirect_url
      }
    };
  });
};
