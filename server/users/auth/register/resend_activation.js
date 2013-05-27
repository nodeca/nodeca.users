// Resend email with account activation link.


'use strict';


var _ = require('lodash');

var sendActivationToken = require('./_lib/send_activation_token');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});


  N.wire.on(apiPath, function resend_activation(env, callback) {
    env.response.data.head.title = env.helpers.t('users.auth.register.title');

    if (!env.runtime.is_member || !env.session.user_id) {
      callback(N.io.NOT_AUTHORIZED);
      return;
    }

    if (!env.runtime.is_validating) {
      callback({
        code: N.io.REDIRECT
      , head: { Location: N.runtime.router.linkTo('users.profile') }
      });
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

      if (!plainProvider) {
        callback(N.io.NOT_AUTHORIZED);
        return;
      }

      sendActivationToken(N, env, plainProvider.email, callback);
    });
  });
};
