// Creates new password reset token and send it to user's email.


'use strict';


var recaptcha = require('nodeca.core/lib/recaptcha');


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
  N.wire.before(apiPath, function* verify_captcha(env) {
    if (!N.config.options.recaptcha) return;

    let privateKey = N.config.options.recaptcha.private_key,
        clientIp   = env.req.ip,
        response   = env.params['g-recaptcha-response'];

    if (!N.config.options.recaptcha) return;

    let valid = yield recaptcha.verify(privateKey, clientIp, response);

    if (!valid) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_captcha_wrong')
      };
    }
  });


  // Search auth record
  //
  N.wire.before(apiPath, function* fetch_auth_link(env) {

    env.data.authlink = yield N.models.users.AuthLink
                                  .findOne({ email: env.params.email, type: 'plain', exists: true })
                                  .lean(true);

    if (!env.data.authlink) {
      throw {
        code:    N.io.CLIENT_ERROR,
        message: env.t('err_email_unknown')
      };
    }
  });


  // Create token & send email
  //
  N.wire.on(apiPath, function* create_reset_confirmation(env) {
    let authlink = env.data.authlink;

    let token = yield N.models.users.TokenResetPassword.create({
      authlink: authlink._id,
      ip:       env.req.ip
    });

    let general_project_name = yield N.settings.get('general_project_name');

    let link = env.helpers.link_to('users.auth.reset_password.change_show', {
      secret_key: token.secret_key
    });

    yield N.mailer.send({
      to:         authlink.email,
      subject:    env.t('email_subject', { project_name: general_project_name }),
      text:       env.t('email_text',    { link }),
      safe_error: true
    });
  });
};
