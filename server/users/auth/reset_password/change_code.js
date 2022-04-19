// RPC method that verifies key or code entered by user
//


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    // either secret_key or short_code
    secret_key_or_code: { type: 'string', required: true, minLength: 1 }
  });


  // Check token
  //
  N.wire.on(apiPath, async function check_token(env) {
    let token = await N.models.users.TokenResetPassword.findOneAndUpdate(
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

    throw {
      code: N.io.REDIRECT,
      head: {
        Location: N.router.linkTo('users.auth.reset_password.change_show', { secret_key: token.secret_key })
      }
    };
  });
};
