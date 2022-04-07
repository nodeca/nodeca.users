// Activates user account.
// Check token. If token is correct - create User and AuthProvider records.
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


  // Kick logged-in members
  //
  N.wire.before(apiPath, function register_guest_only(env) {
    return N.wire.emit('internal:users.redirect_not_guest', env);
  });


  // Create default response (with failing state)
  //
  N.wire.before(apiPath, function prepare_response(env) {
    env.res.head.title = env.t('title');
  });


  // Check auth token
  //
  N.wire.before(apiPath, async function check_activation_token_and_user(env) {
    if (env.res.error) return;

    let token = await N.models.users.TokenActivationEmail.findOne()
                          .where('secret_key').equals(env.params.secret_key)
                          .lean(true)
                          .exec();

    if (!token) {
      env.res.error = env.t('err_invalid_token');
      return;
    }

    env.data.token = token;
  });

  //
  // That's almost impossible, but someone could occupy nick/email if user
  // activated account too late. Or if user started registration twice and
  // got 2 emails. So, we check again that nick & emails are unique.
  //

  // Check nick uniqueness
  //
  N.wire.before(apiPath, async function check_nick_uniqueness(env) {
    if (env.res.error) return;

    let token = env.data.token;

    if (await N.models.users.User.similarExists(token.reg_info.nick)) {
      env.res.error = env.t('err_invalid_token');
      return;
    }
  });


  // Check email uniqueness. User email and oauth provider email should be unique
  //
  N.wire.before(apiPath, async function check_email_uniqueness(env) {
    if (env.res.error) return;

    let token = env.data.token;

    if (await N.models.users.AuthProvider.similarEmailExists(token.reg_info.email)) {
      env.res.error = env.t('err_invalid_token');
      return;
    }
  });


  // Create user record and login
  //
  N.wire.on(apiPath, async function create_user(env) {
    if (env.res.error) return;

    // only authorize from the same device
    if (!env.session_id || env.session_id !== env.data.token.session_id) return;

    let token = env.data.token;

    env.data.reg_info = token.reg_info;

    await N.wire.emit('internal:users.user_create', env);

    // authProvider info is needed to create AuthSession
    //
    env.data.authProvider = await N.models.users.AuthProvider.findOne({ user: env.data.user._id });

    await N.wire.emit('internal:users.login', env);

    // Token can be used only once.
    await N.models.users.TokenActivationEmail.deleteOne({ _id: token._id });

    // Use redirect instead of direct page rendering, because
    // we need to reload client environment with the new user data
    //
    throw {
      code: N.io.REDIRECT,
      head: {
        Location: N.router.linkTo('users.auth.register.activate_done')
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

    env.res.short_code = get_short_code();

    await N.models.users.TokenActivationEmail.updateOne(
      { _id: env.data.token._id },
      { $set: {
        short_code: env.res.short_code,
        open_link_ts: new Date()
      } }
    );
  });
};
