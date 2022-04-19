// Enter new email, send token there to confirm it
// RPC method that verifies key or code entered by user
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    // either secret_key or short_code
    secret_key_or_code: { type: 'string', required: true, minLength: 1 }
  });


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (!env.user_info.is_member) {
      return N.io.FORBIDDEN;
    }
  });


  // Check token
  //
  N.wire.on(apiPath, async function check_token(env) {
    let token = await N.models.users.TokenEmailConfirm.findOneAndUpdate(
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
        Location: N.router.linkTo('users.settings.account.change_email.new_email_show', {
          secret_key: token.secret_key
        })
      }
    };
  });
};
