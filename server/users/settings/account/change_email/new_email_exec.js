// Enter new email, send token there to confirm it
//

'use strict';


const email_regex = require('email-regex');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    secret_key: { type: 'string', required: true },
    email:      { type: 'string', required: true }
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
  N.wire.before(apiPath, async function check_token(env) {
    let token = await N.models.users.TokenEmailConfirm.findOne()
                          .where('secret_key').equals(env.params.secret_key)
                          .where('session_id').equals(env.session_id)
                          .where('user').equals(env.user_info.user_id)
                          .lean(true);

    if (!token) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_invalid_token')
      };
    }

    env.data.token = token;
  });


  // Simple syntax check
  //
  N.wire.before(apiPath, async function check_email(env) {
    if (!email_regex({ exact: true }).test(env.params.email)) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_bad_email')
      };
    }
  });


  // Fetch user
  //
  N.wire.before(apiPath, async function fetch_user(env) {
    env.data.user = await N.models.users.User.findById(env.user_info.user_id).lean(true);
  });


  // Send confirmation to the new email
  //
  N.wire.on(apiPath, async function confirm_new_email(env) {
    let token = await N.models.users.TokenEmailConfirmNew.create({
      session_id: env.session_id,
      user:       env.data.user._id,
      new_email:  env.params.email
    });

    let general_project_name = await N.settings.get('general_project_name');

    let link = env.helpers.link_to('users.settings.account.change_email.new_email_verify_exec', {
      secret_key: token.secret_key
    });

    await N.mailer.send({
      to:         env.params.email,
      subject:    env.t('email_subject', { project_name: general_project_name }),
      text:       env.t('email_text',    { link, code: token.secret_key, ip: env.req.ip }),
      safe_error: true
    });
  });


  // Remove current and all other email change tokens for this user
  //
  N.wire.after(apiPath, async function remove_token(env) {
    await N.models.users.TokenEmailConfirm.deleteMany({ user: env.data.user._id });
  });


  // Redirect user to "change done" page
  //
  // Use redirect instead of direct page rendering to avoid "invalid token"
  // error appearing on reload + make it similar to other pages (auth flow,
  // change password, etc.)
  //
  N.wire.after(apiPath, async function redirect_user() {
    throw {
      code: N.io.REDIRECT,
      head: {
        Location: N.router.linkTo('users.settings.account.change_email.new_email_verify')
      }
    };
  });
};
