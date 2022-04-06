// Activates user account.
// Check token. If token is correct - create User and AuthProvider records.
//
// This is RPC query executed when user types code into input
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    // either secret_key or short_code
    secret_key_or_code: { type: 'string', required: true, minLength: 1 }
  });


  // Kick logged-in members
  //
  N.wire.before(apiPath, function register_guest_only(env) {
    return N.wire.emit('internal:users.redirect_not_guest', env);
  });


  // Check auth token
  //
  N.wire.before(apiPath, async function check_activation_token_and_user(env) {
    let token = await N.models.users.TokenActivationEmail.findOneAndUpdate(
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

    // Token can be used only once.
    await N.models.users.TokenActivationEmail.deleteOne({ _id: token._id });
  });

  //
  // That's almost impossible, but someone could occupy nick/email if user
  // activated account too late. Or if user started registration twice and
  // got 2 emails. So, we check again that nick & emails are unique.
  //

  // Check nick uniqueness
  //
  N.wire.before(apiPath, async function check_nick_uniqueness(env) {
    let token = env.data.token;

    if (await N.models.users.User.similarExists(token.reg_info.nick)) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_invalid_token')
      };
    }
  });


  // Check email uniqueness. User email and oauth provider email should be unique
  //
  N.wire.before(apiPath, async function check_email_uniqueness(env) {
    let token = env.data.token;

    if (await N.models.users.AuthProvider.similarEmailExists(token.reg_info.email)) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_invalid_token')
      };
    }
  });


  // Create user record and login
  //
  N.wire.on(apiPath, async function create_user(env) {
    let token = env.data.token;

    env.data.reg_info = token.reg_info;

    await N.wire.emit('internal:users.user_create', env);

    // authProvider info is needed to create AuthSession
    //
    env.data.authProvider = await N.models.users.AuthProvider.findOne({ user: env.data.user._id });

    await N.wire.emit('internal:users.login', env);

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
};
