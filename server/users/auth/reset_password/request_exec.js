// Creates new password reset token and send it to user's email.


'use strict';


const recaptcha = require('nodeca.core/lib/app/recaptcha');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    email:                     { type: 'string', required: true },
    'g-recaptcha-response':    { type: 'string', required: false }
  });


  //
  // Don't limit logged-in users to change pass. Because
  // user can forget password, but still have cookies to remember it.
  //


  // check captcha
  //
  N.wire.before(apiPath, async function verify_captcha(env) {
    if (!N.config.options.recaptcha) return;

    let privateKey = N.config.options.recaptcha.private_key,
        clientIp   = env.req.ip,
        response   = env.params['g-recaptcha-response'];

    if (!N.config.options.recaptcha) return;

    let valid = await recaptcha.verify(privateKey, clientIp, response);

    if (!valid) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_captcha_wrong')
      };
    }
  });


  // Search for user
  //
  N.wire.before(apiPath, async function fetch_user(env) {

    let user = await N.models.users.User
                              .findOne({ email: env.params.email })
                              .lean(true);

    if (!user) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_email_unknown')
      };
    }

    env.data.user = user;
  });


  // Create token & send email
  //
  N.wire.on(apiPath, async function create_reset_confirmation(env) {
    let token = await N.models.users.TokenResetPassword.create({
      user:       env.data.user._id,
      session_id: env.session_id
    });

    let general_project_name = await N.settings.get('general_project_name');

    let link = env.helpers.link_to('users.auth.reset_password.change_show', {
      secret_key: token.secret_key
    });

    await N.mailer.send({
      to:         env.data.user.email,
      subject:    env.t('email_subject', { project_name: general_project_name }),
      text:       env.t('email_text',    { link, code: token.secret_key, ip: env.req.ip }),
      safe_error: true
    });
  });
};
