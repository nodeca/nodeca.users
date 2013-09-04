// Creates new password reset token and send it to user's email.


'use strict';


var _         = require('lodash');
var recaptcha = require('nodeca.core/lib/recaptcha');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    email:                     { type: 'string', required: true }
  , recaptcha_challenge_field: { type: 'string', required: true }
  , recaptcha_response_field:  { type: 'string', required: true }
  });

  N.wire.on(apiPath, function (env, callback) {
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

      N.models.users.AuthLink.findOne({
        'providers.email': env.params.email
      , 'providers.type': 'plain'
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

        var provider = _.find(authlink.providers, {
          type: 'plain'
        , email: env.params.email
        });

        N.models.users.TokenResetPassword.create({
          authlink_id:     authlink._id
        , authprovider_id: provider._id
        }, function (err, token) {
          N.settings.get('general_project_name', function (err, projectName) {
            var link = env.helpers.url_to('users.auth.reset_password.change_show', {
              secret_key: token.secret_key
            });

            N.mailer.send({
              to:      provider.email
            , subject: env.t('confirmation_email_subject', { project_name: projectName })
            , text:    env.t('confirmation_email_text',    { link: link })
            }, callback);
          });
        });
      });
    });
  });
};
