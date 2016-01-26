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
  N.wire.before(apiPath, function verify_captcha(env, callback) {
    if (!N.config.options.recaptcha) {
      callback();
      return;
    }

    var privateKey = N.config.options.recaptcha.private_key,
        clientIp   = env.req.ip,
        response   = env.params['g-recaptcha-response'];

    if (!N.config.options.recaptcha) {
      callback();
      return;
    }

    recaptcha.verify(privateKey, clientIp, response, function (err, valid) {
      if (err) {
        callback(new Error('Captcha service error'));
        return;
      }

      if (!valid) {
        callback({
          code:    N.io.CLIENT_ERROR,
          message: env.t('err_captcha_wrong')
        });
        return;
      }

      callback();
    });
  });


  // Search auth record
  //
  N.wire.before(apiPath, function fetch_auth_link(env, callback) {

    N.models.users.AuthLink
        .findOne({ email: env.params.email, type: 'plain', exists: true })
        .lean(true)
        .exec(function (err, authlink) {

      if (err) {
        callback(err);
        return;
      }

      if (!authlink) {
        callback({
          code:    N.io.CLIENT_ERROR,
          message: env.t('err_email_unknown')
        });
        return;
      }

      env.data.authlink = authlink;

      callback();
    });
  });


  // Create token & send email
  //
  N.wire.on(apiPath, function* create_reset_confirmation(env) {
    let authlink = env.data.authlink;

    let token = yield N.models.users.TokenResetPassword.create({
      authlink_id: authlink._id,
      ip:          env.req.ip
    });

    let general_project_name = yield N.settings.get('general_project_name');

    let link = env.helpers.url_to('users.auth.reset_password.change_show', {
      secret_key: token.secret_key
    });

    yield N.mailer.send({
      to:      authlink.email,
      subject: env.t('email_subject', { project_name: general_project_name }),
      text:    env.t('email_text',    { link })
    });
  });
};
