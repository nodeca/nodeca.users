// Execute login using one-time token sent by email after user
// tries to log in using an empty password.
//
// This is RPC query executed when user types code into input
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    // either secret_key or short_code
    secret_key_or_code: { type: 'string', required: true, minLength: 1 }
  });


  // Check token
  //
  N.wire.before(apiPath, async function check_token(env) {
    let token = await N.models.users.TokenLoginByEmail.findOneAndUpdate(
      { session_id: env.session_id },
      { $inc: { attempts: 1 } },
      { new: true }
    ).lean(true).exec();

    if (!token || !env.session_id) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_invalid_token')
      };
    }

    if (token.attempts > 3) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_too_many_attempts')
      };
    }

    let code_correct = false;

    if (token.secret_key && token.secret_key === env.params.secret_key_or_code) code_correct = true;
    if (token.short_code && token.short_code === env.params.secret_key_or_code) {
      if (Math.abs(Date.now() - token.open_link_ts) < 5 * 60 * 1000) {
        code_correct = true;
      } else {
        throw {
          code:    N.io.CLIENT_ERROR,
          message: env.t('err_expired_code')
        };
      }
    }

    if (!code_correct) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_invalid_code')
      };
    }

    env.data.token = token;
  });


  // Search for user
  //
  N.wire.before(apiPath, async function fetch_user(env) {
    let token = env.data.token;

    env.data.user = await N.models.users.User.findById(token.user).exec();

    if (!env.data.user) {
      throw {
        code:         N.io.CLIENT_ERROR,
        message:      env.t('err_invalid_token'),
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
                             .lean(true)
                             .exec();

    if (!authProvider) {
      // can happen if authprovider becomes disabled after user requests otp,
      // e.g. regular login with a password using vb authprovider
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_invalid_token')
      };
    }

    // keep it for logging in later on
    env.data.authProvider = authProvider;
  });


  // Log user in
  //
  N.wire.after(apiPath, async function login(env) {
    // Remove current and all other login tokens for this user
    await N.models.users.TokenLoginByEmail.deleteMany({ user: env.data.user._id });

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
