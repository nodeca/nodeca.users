// Send email with confirmation link.


'use strict';


var _   = require('lodash');
var url = require('url');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.before(apiPath, function find_user_auth_provider(env, callback) {
    if (!env.runtime.is_member || !env.session.user_id) {
      callback(N.io.NOT_AUTHORIZED);
      return;
    }

    N.models.users.AuthLink
        .findOne({ user_id: env.session.user_id })
        .setOptions({ lean: true })
        .exec(function (err, authlink) {

      if (err) {
        callback(err);
        return;
      }

      if (!authlink) {
        callback(N.io.NOT_AUTHORIZED);
        return;
      }

      var plainProvider = _.find(authlink.providers, function (provider) {
        return 'plain' === provider.type;
      });

      env.data.userId    = authlink.user_id;
      env.data.userEmail = plainProvider.email;
      callback();
    });
  });


  N.wire.before(apiPath, function require_validating_group(env) {
    if (!env.runtime.is_validating) {
      return {
        code: N.io.REDIRECT
      , head: { Location: N.runtime.router.linkTo('users.profile') }
      };
    }
  });


  N.wire.on(apiPath, function confirm_email_request(env, callback) {
    N.models.users.TokenConfirmEmail.findOneAndUpdate(
      { user_id:    env.data.userId }
    , { secret_key: N.models.users.TokenConfirmEmail.generateSecretKey()
      , create_ts:  new Date()      }
    , { upsert:     true            }
    , function (err, token) {

      if (err) {
        callback(err);
        return;
      }

      var link = N.runtime.router.linkTo('users.auth.confirm_email', {
        user_id:    env.data.userId
      , secret_key: token.secret_key
      });

      // Prepend protocol and host if link not contains them.
      link = url.resolve(env.origin.req.fullUrl, link);

      N.mailer.send({
        to:      env.data.userEmail
      , subject: env.helpers.t('users.auth.confirm_email.letter.subject')
      , text:    env.helpers.t('users.auth.confirm_email.letter.text', { link: link })
      }, callback);
    });
  });
};
