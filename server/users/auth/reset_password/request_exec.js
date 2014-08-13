// Creates new password reset token and send it to user's email.


'use strict';


var recaptcha = require('nodeca.core/lib/recaptcha');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    email:                     { type: 'string', required: true }
  , recaptcha_challenge_field: { type: 'string', required: true }
  , recaptcha_response_field:  { type: 'string', required: true }
  });


  //
  // Don't limit logged-in users to change pass. Because
  // user can forget password, but still have cookies to remember it.
  //


  // check captcha
  //
  N.wire.before(apiPath, function verify_captcha(env, callback) {
    var privateKey = N.config.options.recaptcha.private_key
      , clientIp   = env.req.ip
      , challenge  = env.params.recaptcha_challenge_field
      , response   = env.params.recaptcha_response_field;

    recaptcha.verify(privateKey, clientIp, challenge, response, function (err, valid) {
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
  N.wire.on(apiPath, function create_reset_confirmation(env, callback) {
    var authlink = env.data.authlink;

    N.models.users.TokenResetPassword.create({
      authlink_id: authlink._id,
      ip:          env.req.ip
    }, function (err, token) {

      if (err) {
        callback(err);
        return;
      }

      N.settings.get('general_project_name', function (err, general_project_name) {
        if (err) {
          callback(err);
          return;
        }

        var link = env.helpers.url_to('users.auth.reset_password.change_show', {
          secret_key: token.secret_key
        });

        N.mailer.send({
          to:      authlink.email,
          subject: env.t('email_subject', { project_name: general_project_name }),
          text:    env.t('email_text',    { link: link })
        }, callback);
      });
    });
  });
};
