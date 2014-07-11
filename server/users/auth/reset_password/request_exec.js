// Creates new password reset token and send it to user's email.


'use strict';


var recaptcha = require('nodeca.core/lib/recaptcha');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    email:                     { type: 'string', required: true }
  , recaptcha_challenge_field: { type: 'string', required: true }
  , recaptcha_response_field:  { type: 'string', required: true }
  });


  N.wire.before(apiPath, function rquest_pass_guest_only(env, callback) {
    N.wire.emit('internal:users.redirect_not_guest', env, callback);
  });


  N.wire.before(apiPath, function verify_captcha(env, callback) {
    var privateKey = N.config.options.recaptcha.private_key
      , clientIp   = env.req.ip
      , challenge  = env.params.recaptcha_challenge_field
      , response   = env.params.recaptcha_response_field;

    recaptcha.verify(privateKey, clientIp, challenge, response, function (err, valid) {
      if (err || !valid) {
        callback({
          code:    N.io.CLIENT_ERROR
        , message: env.t('wrong_captcha_solution')
        });
        return;
      }

      callback();
    });
  });


  // Search auth record
  //
  N.wire.before(apiPath, function fetch_auth_link(env, callback) {
    N.models.users.AuthLink.findOne({
      'email': env.params.email
    , 'type': 'plain'
    }, function (err, authlink) {
      if (err) {
        callback(err);
        return;
      }

      if (!authlink) {
        callback({
          code:    N.io.CLIENT_ERROR
        , message: env.t('unknown_email')
        });
        return;
      }

      env.data.authlink = authlink;

      callback();
    });
  });


  // Main
  //
  N.wire.on(apiPath, function create_reset_confirmation(env, callback) {
    var authlink = env.data.authlink;

    N.models.users.TokenResetPassword.create({
      authlink_id:     authlink._id,
      ip: env.req.ip
    }, function (err, token) {

      if (err) {
        callback(err);
        return;
      }

      N.settings.get('general_project_name', function (err, projectName) {
        if (err) {
          callback(err);
          return;
        }

        var link = env.helpers.url_to('users.auth.reset_password.change_show', {
          secret_key: token.secret_key
        });

        N.mailer.send({
          to:      authlink.email
        , subject: env.t('confirmation_email_subject', { project_name: projectName })
        , text:    env.t('confirmation_email_text',    { link: link })
        }, callback);
      });
    });
  });
};
