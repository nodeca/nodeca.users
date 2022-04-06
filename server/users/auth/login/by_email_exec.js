// Execute login using one-time token sent by email after user
// tries to log in using an empty password.
//
// This is the page shown when user clicks a link in their email
//

'use strict';


const crypto = require('crypto');


function get_short_code(length = 6) {
  return (crypto.randomBytes(4).readUInt32BE(0) + 10 ** (length + 1)).toString(10).slice(-length);
}


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    secret_key: { type: 'string', required: true }
  });


  // Check token
  //
  N.wire.before(apiPath, async function check_token(env) {
    if (env.res.error) return;

    let token = await N.models.users.TokenLoginByEmail.findOne()
                          .where('secret_key').equals(env.params.secret_key)
                          .lean(true)
                          .exec();

    if (!token) {
      env.res.error = env.t('err_invalid_token');
      return;
    }

    env.data.token = token;
  });


  // Search for user
  //
  N.wire.before(apiPath, async function fetch_user(env) {
    if (env.res.error) return;

    let token = env.data.token;

    env.data.user = await N.models.users.User.findById(token.user).exec();

    if (!env.data.user) {
      env.res.error = env.t('err_invalid_token');
      return;
    }
  });


  // Fetch authprovider
  //
  N.wire.on(apiPath, async function get_authprovider(env) {
    if (env.res.error) return;

    let authProvider = await N.models.users.AuthProvider.findOne()
                             .where('_id').equals(env.data.token.authprovider)
                             .where('exists').equals(true)
                             .lean(true)
                             .exec();

    if (!authProvider) {
      // can happen if authprovider becomes disabled after user requests otp,
      // e.g. regular login with a password using vb authprovider
      env.res.error = env.t('err_invalid_token');
      return;
    }

    // keep it for logging in later on
    env.data.authProvider = authProvider;
  });


  // Log user in
  //
  N.wire.after(apiPath, async function login(env) {
    if (env.res.error) return;

    // only log in from the same device
    if (!env.session_id || env.session_id !== env.data.token.session_id) return;

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


  // Generate code to log in from a different browser
  //
  N.wire.after(apiPath, async function generate_short_code(env) {
    if (env.res.error) return;

    if (env.data.token.short_code) {
      // user opens email link in two different browsers, show code generated in first one
      env.res.short_code = env.data.token.short_code;
      return;
    }

    env.res.head.title = env.t('title');
    env.res.short_code = get_short_code();

    await N.models.users.TokenLoginByEmail.updateOne(
      { _id: env.data.token._id },
      { $set: {
        short_code: env.res.short_code,
        open_link_ts: new Date()
      } }
    );
  });
};
